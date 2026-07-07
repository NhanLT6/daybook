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
});
