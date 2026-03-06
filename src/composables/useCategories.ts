import { computed } from 'vue';

import { useStorage } from '@vueuse/core';

import { nanoid } from 'nanoid';

import type { Category } from '@/interfaces/Category';
import { storageKeys } from '@/common/storageKeys';

const defaultCategories: Category[] = [{ id: 'work', name: 'Work', displayOrder: 0 }];

export function useCategories() {
  const categories = useStorage<Category[]>(storageKeys.categories, defaultCategories);

  // Sorted by displayOrder for consistent rendering
  const sortedCategories = computed(() => [...categories.value].sort((a, b) => a.displayOrder - b.displayOrder));

  const getCategoryById = (id: string | undefined): Category | undefined =>
    id ? categories.value.find((c) => c.id === id) : undefined;

  const getCategoryName = (id: string | undefined): string => getCategoryById(id)?.name ?? 'Uncategorized';

  const addCategory = (name: string): Category => {
    const maxOrder = categories.value.reduce((max, c) => Math.max(max, c.displayOrder), -1);
    const newCategory: Category = { id: nanoid(), name: name.trim(), displayOrder: maxOrder + 1 };
    categories.value.push(newCategory);
    return newCategory;
  };

  const renameCategory = (id: string, newName: string) => {
    const cat = categories.value.find((c) => c.id === id);
    if (cat) cat.name = newName.trim();
  };

  // Deleting a category leaves its projects as "Uncategorized" (no cascade)
  const deleteCategory = (id: string) => {
    categories.value = categories.value.filter((c) => c.id !== id);
  };

  return {
    categories,
    sortedCategories,
    getCategoryById,
    getCategoryName,
    addCategory,
    renameCategory,
    deleteCategory,
  };
}
