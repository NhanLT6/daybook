import { computed } from 'vue';

import { nanoid } from 'nanoid';

import type { Category } from '@/interfaces/Category';

import { useCollection } from '@/composables/useCollection';

const defaultCategories: Category[] = [{ id: 'work', name: 'Work', displayOrder: 0 }];

export function useCategories() {
  const c = useCollection<Category>('categories');

  // Seed default once, only if the store has never been populated.
  void c.ready.then(() => {
    if (c.items.value.length === 0) void c.addMany(defaultCategories);
  });

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
