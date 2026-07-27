import { beforeEach, describe, expect, it } from 'vitest';

import { initDb } from '@/db';
import { useCollection } from '@/composables/useCollection';

describe('useCollection', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
    await useCollection('projects').clear();
  });

  it('loads items and reflects add', async () => {
    const c = useCollection<{ id: string; title: string }>('projects');
    await c.ready;
    expect(c.items.value).toEqual([]);
    await c.add({ id: 'A', title: 'A' });
    expect(c.items.value).toEqual([{ id: 'A', title: 'A' }]);
  });

  it('shares one reactive ref across calls (singleton per collection)', async () => {
    const a = useCollection<{ id: string; title: string }>('projects');
    const b = useCollection<{ id: string; title: string }>('projects');
    await a.ready;
    await a.add({ id: 'Z', title: 'Z' });
    expect(b.items.value).toEqual([{ id: 'Z', title: 'Z' }]);
  });

  // Regression: items read back out of `items` are reactive proxies. Writing one
  // straight back to IndexedDB used to throw DataCloneError ("could not be cloned"),
  // which silently destroyed data in clear-then-add flows like useEvents.replaceAll.
  it('accepts records read back out of items (reactive proxies)', async () => {
    const c = useCollection<{ id: string; title: string }>('projects');
    await c.ready;
    await c.add({ id: 'A', title: 'A' });

    const roundTripped = [...c.items.value];
    await c.clear();
    await expect(c.addMany(roundTripped)).resolves.not.toThrow();
    expect(c.items.value).toEqual([{ id: 'A', title: 'A' }]);
  });

  it('upsert accepts a proxy read out of items', async () => {
    const c = useCollection<{ id: string; title: string }>('projects');
    await c.ready;
    await c.add({ id: 'B', title: 'B' });

    const existing = c.items.value[0];
    await expect(c.upsert({ ...existing, title: 'B2' })).resolves.not.toThrow();
    expect(c.items.value).toEqual([{ id: 'B', title: 'B2' }]);
  });
});
