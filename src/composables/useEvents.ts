import { computed } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { useCollection } from '@/composables/useCollection';

export function useEvents() {
  const c = useCollection<AppEvent>('events');
  return {
    events: computed(() => c.items.value),
    ready: c.ready,
    addEvent: (e: AppEvent) => c.upsert(e),
    removeEvent: (id: string) => c.remove(id),
    // Clear-then-add: the caller passes the full desired list. Snapshot it first so a
    // failure mid-way can restore what was there rather than leaving the user empty.
    replaceAll: async (list: AppEvent[]) => {
      const previous = c.items.value.map((e) => ({ ...e }));
      await c.clear();
      try {
        await c.addMany(list);
      } catch (err) {
        await c.addMany(previous);
        throw err;
      }
    },
  };
}
