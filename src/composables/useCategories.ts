import { computed } from 'vue';

import { nanoid } from 'nanoid';

import type { Category } from '@/interfaces/Category';

import { useCollection } from '@/composables/useCollection';

const defaultCategories: Category[] = [{ id: 'work', name: 'Work', displayOrder: 0 }];

// Persisted marker: seeding must happen at most once, EVER — this matches the old
// useStorage-backed behavior, where a default was written only the first time the
// storage key never existed. Without a persisted flag, an empty collection (e.g.
// the user deleted their last category) looks identical to a fresh install, and
// every later mount of useCategories() would silently resurrect 'Work'.
const SEEDED_FLAG_KEY = 'daybook:categoriesSeeded';

// In-memory guard so concurrent mounts within one session don't each attach their
// own seed check. This is just an optimization on top of the persisted flag above,
// which is what actually guarantees correctness across reloads.
let seedAttempted = false;

export function useCategories() {
  const c = useCollection<Category>('categories');

  // Seed default once, ever. Skip entirely once the persisted flag is set, so an
  // empty collection after the user deletes their last category is never mistaken
  // for a fresh install.
  if (!seedAttempted) {
    seedAttempted = true;
    if (localStorage.getItem(SEEDED_FLAG_KEY) !== '1') {
      void c.ready.then(async () => {
        if (c.items.value.length === 0) await c.addMany(defaultCategories);
        // Mark seeded regardless of whether we actually added anything: migrated
        // users who already had categories at this point must also be flagged, so
        // they never get a default resurrected after clearing their categories out.
        localStorage.setItem(SEEDED_FLAG_KEY, '1');
      });
    }
  }

  const categories = computed(() => c.items.value);
  const sortedCategories = computed(() => [...c.items.value].sort((a, b) => a.displayOrder - b.displayOrder));

  const getCategoryById = (id: string | undefined): Category | undefined =>
    id ? c.items.value.find((x) => x.id === id) : undefined;
  const getCategoryName = (id: string | undefined): string => getCategoryById(id)?.name ?? 'Uncategorized';

  const addCategory = (name: string): Category => {
    const maxOrder = c.items.value.reduce((max, x) => Math.max(max, x.displayOrder), -1);
    const created: Category = { id: nanoid(), name: name.trim(), displayOrder: maxOrder + 1 };
    void c.add(created);
    return created;
  };

  const renameCategory = (id: string, newName: string) => {
    const cat = c.items.value.find((x) => x.id === id);
    if (cat) void c.upsert({ ...cat, name: newName.trim() });
  };

  const deleteCategory = (id: string) => {
    void c.remove(id);
  };

  return { categories, sortedCategories, getCategoryById, getCategoryName, addCategory, renameCategory, deleteCategory };
}
