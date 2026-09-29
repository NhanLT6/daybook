import { computed, toRaw } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { cloneDeep } from 'lodash';

import { useCollection } from '@/composables/useCollection';

// IndexedDB can't store Vue proxies, and useCollection's toRaw only unwraps the top level —
// events carry a nested `repeat` object, so hand the db plain deep copies.
const plain = (e: AppEvent): AppEvent => cloneDeep(toRaw(e));

export function useEvents() {
  const c = useCollection<AppEvent>('events');
  return {
    events: computed(() => c.items.value),
    ready: c.ready,
    addEvent: (e: AppEvent) => c.upsert(plain(e)),
    removeEvent: (id: string) => c.remove(id),
    // Clear-then-add: the caller passes the full desired list. Snapshot it first so a
    // failure mid-way can restore what was there rather than leaving the user empty.
    replaceAll: async (list: AppEvent[]) => {
      const previous = c.items.value.map(plain);
      await c.clear();
      try {
        await c.addMany(list.map(plain));
      } catch (err) {
        await c.addMany(previous);
        throw err;
      }
    },
  };
}
