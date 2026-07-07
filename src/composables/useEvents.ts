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
    replaceAll: async (list: AppEvent[]) => {
      await c.clear();
      await c.addMany(list);
    },
  };
}
