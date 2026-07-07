import { beforeEach, describe, expect, it, vi } from 'vitest';

const SEEDED_FLAG_KEY = 'daybook:categoriesSeeded';

// The seed check runs inside a fire-and-forget `c.ready.then(...)` that
// useCategories() doesn't expose, so tests poll for the resulting state instead
// of awaiting a promise directly.
async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

// Give an (incorrect) reseed a fair chance to run before asserting it didn't happen.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('useCategories', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the module registry so useCategories' module-level `seedAttempted`
    // guard (and useCollection's module-level state) starts clean each test —
    // every test gets a genuine "first mount", independent of import order.
    vi.resetModules();
  });

  it('seeds the default "Work" category on a fresh install', async () => {
    const { initDb } = await import('@/db');
    await initDb();
    const { useCollection } = await import('@/composables/useCollection');
    await useCollection('categories').clear();

    const { useCategories } = await import('@/composables/useCategories');
    const { categories } = useCategories();
    await waitFor(() => categories.value.length > 0);

    expect(categories.value).toEqual([{ id: 'work', name: 'Work', displayOrder: 0 }]);
    expect(localStorage.getItem(SEEDED_FLAG_KEY)).toBe('1');
  });

  it('does not resurrect "Work" after the user deletes their last category (regression)', async () => {
    const { initDb } = await import('@/db');
    await initDb();
    const { useCollection } = await import('@/composables/useCollection');
    await useCollection('categories').clear();

    const { useCategories } = await import('@/composables/useCategories');

    // First mount of the session: fresh install seeds the default.
    const first = useCategories();
    await waitFor(() => first.categories.value.length > 0);
    expect(first.categories.value.map((cat) => cat.id)).toEqual(['work']);

    // User deletes their last category.
    first.deleteCategory('work');
    await waitFor(() => first.categories.value.length === 0);
    expect(localStorage.getItem(SEEDED_FLAG_KEY)).toBe('1');

    // Navigating to another view calls useCategories() again within the same
    // session — this is the exact repro from the bug report.
    const second = useCategories();
    await settle();
    expect(second.categories.value).toEqual([]);

    // Simulate a full page reload: a fresh module world (fresh in-memory guards),
    // but the persisted flag and the underlying (fake-)IndexedDB data both survive.
    // This is the actual correctness guarantee — without it, only same-session
    // calls would be protected, and a browser refresh would resurrect 'Work'.
    vi.resetModules();
    const dbAfterReload = await import('@/db');
    await dbAfterReload.initDb();
    const { useCategories: useCategoriesAfterReload } = await import('@/composables/useCategories');
    const third = useCategoriesAfterReload();
    await settle();
    expect(third.categories.value).toEqual([]);
  });

  it('does not seed when the persisted flag is already set, even with an empty collection', async () => {
    const { initDb } = await import('@/db');
    await initDb();
    const { useCollection } = await import('@/composables/useCollection');
    await useCollection('categories').clear();
    localStorage.setItem(SEEDED_FLAG_KEY, '1');

    const { useCategories } = await import('@/composables/useCategories');
    const { categories } = useCategories();
    await settle();

    expect(categories.value).toEqual([]);
  });
});
