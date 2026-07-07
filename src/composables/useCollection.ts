import { type Ref, ref } from 'vue';

import { db, notifyDbChange, onDbChange } from '@/db';
import type { CollectionName, IdRecord } from '@/db/types';

interface CollectionState<T extends IdRecord> {
  items: Ref<T[]>;
  loading: Ref<boolean>;
  ready: Promise<void>;
  reload: () => Promise<void>;
}

// One reactive state per collection, created once and shared by every caller.
const states = new Map<CollectionName, CollectionState<IdRecord>>();

function getState<T extends IdRecord>(name: CollectionName): CollectionState<T> {
  const existing = states.get(name);
  if (existing) return existing as unknown as CollectionState<T>;

  const items = ref([]) as Ref<T[]>;
  const loading = ref(true);

  const reload = async () => {
    items.value = (await db[name].all()) as T[];
    loading.value = false;
  };

  const ready = reload();

  // Reload when another composable/tab mutates this collection.
  onDbChange((changed) => {
    if (changed === name) void reload();
  });

  const state: CollectionState<T> = { items, loading, ready, reload };
  states.set(name, state as unknown as CollectionState<IdRecord>);
  return state;
}

export function useCollection<T extends IdRecord>(name: CollectionName) {
  const state = getState<T>(name);

  const mutate = async (fn: () => Promise<void>) => {
    await fn();
    await state.reload();
    notifyDbChange(name); // other tabs/composables
  };

  return {
    items: state.items,
    loading: state.loading,
    ready: state.ready,
    reload: state.reload,
    add: (r: T) => mutate(() => db[name].add(r as never)),
    addMany: (r: T[]) => mutate(() => db[name].addMany(r as never)),
    upsert: (r: T) => mutate(() => db[name].upsert(r as never)),
    remove: (id: string) => mutate(() => db[name].remove(id)),
    clear: () => mutate(() => db[name].clear()),
  };
}
