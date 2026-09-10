import { computed } from 'vue';

import type { Note } from '@/interfaces/Note';

import { useCollection } from '@/composables/useCollection';

export function useNotes() {
  const c = useCollection<Note>('notes');
  const notes = computed(() => [...c.items.value].sort((a, b) => a.order - b.order));
  return {
    notes,
    ready: c.ready,
    saveNote: (n: Note) => c.upsert(n),
    removeNote: (id: string) => c.remove(id),
    // Persist a new display order: order = index.
    reorder: (ids: string[]) => {
      const byId = new Map(c.items.value.map((n) => [n.id, n]));
      return c.addMany(ids.map((id, order) => ({ ...byId.get(id)!, order })));
    },
    nextTopOrder: () => (notes.value[0]?.order ?? 0) - 1,
  };
}
