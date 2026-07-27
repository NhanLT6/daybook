import { createIndexedDbAdapter } from '@/db/adapters/indexedDbAdapter';
import { createLocalStorageAdapter } from '@/db/adapters/localStorageAdapter';
import { runMigrations } from '@/db/migrations';
import { createRepository, type Repository } from '@/db/repository';
import type { CollectionName, StorageAdapter } from '@/db/types';

// The ONE place a backend is named.
const STORAGE_BACKEND: 'indexeddb' | 'localstorage' = 'indexeddb';

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function makeSelectedAdapter(): StorageAdapter {
  if (STORAGE_BACKEND === 'indexeddb' && isIndexedDbAvailable()) return createIndexedDbAdapter();
  if (STORAGE_BACKEND === 'indexeddb') {
    console.warn('[db] IndexedDB unavailable, falling back to localStorage');
  }
  return createLocalStorageAdapter();
}

// `current` is the real backend and can be swapped (indexeddb -> localstorage) if
// opening it fails at init time. `db` below binds to a stable delegating adapter so
// callers holding a reference to `db` transparently see the swapped backend too.
let current: StorageAdapter = makeSelectedAdapter();

// Delegating adapter: repository binds to this stable object; we can swap `current`
// on init failure without invalidating anything that already imported `db`.
const delegating: StorageAdapter = {
  init: () => current.init(),
  getAll: (c) => current.getAll(c),
  put: (c, r) => current.put(c, r),
  putMany: (c, r) => current.putMany(c, r),
  remove: (c, id) => current.remove(c, id),
  clear: (c) => current.clear(c),
  snapshot: () => current.snapshot(),
  restore: (s) => current.restore(s),
};

export const db: Repository = createRepository(delegating);

let initPromise: Promise<void> | null = null;
export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await current.init();
      } catch (err) {
        // Primary backend named IndexedDB but failed to OPEN (private mode / quota /
        // corruption) — fall back to localStorage. If we were already on localStorage,
        // there's nothing left to fall back to, so rethrow.
        if (STORAGE_BACKEND === 'indexeddb') {
          console.warn('[db] IndexedDB init failed, falling back to localStorage', err);
          current = createLocalStorageAdapter();
          await current.init();
        } else {
          throw err;
        }
      }
      await runMigrations(current);
    })();
  }
  return initPromise;
}

// ── Cross-tab + cross-composable change notification ─────────────────────────
type Listener = (c: CollectionName) => void;
const listeners = new Set<Listener>();
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('daybook-db') : null;

if (channel) {
  channel.onmessage = (e: MessageEvent<CollectionName>) => {
    for (const l of listeners) l(e.data);
  };
}

export function notifyDbChange(c: CollectionName): void {
  for (const l of listeners) l(c); // same-tab listeners
  channel?.postMessage(c); // other tabs
}

export function onDbChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
