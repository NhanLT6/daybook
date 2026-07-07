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

function selectAdapter(): StorageAdapter {
  if (STORAGE_BACKEND === 'indexeddb' && isIndexedDbAvailable()) return createIndexedDbAdapter();
  if (STORAGE_BACKEND === 'indexeddb') {
    console.warn('[db] IndexedDB unavailable, falling back to localStorage');
  }
  return createLocalStorageAdapter();
}

const adapter = selectAdapter();
export const db: Repository = createRepository(adapter);

let initPromise: Promise<void> | null = null;
export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await adapter.init();
      await runMigrations(adapter);
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
