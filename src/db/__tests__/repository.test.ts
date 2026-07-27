import { beforeEach, describe, expect, it } from 'vitest';

import { createLocalStorageAdapter } from '@/db/adapters/localStorageAdapter';
import { createRepository } from '@/db/repository';

describe('repository', () => {
  beforeEach(() => localStorage.clear());

  it('exposes a typed collection that round-trips records', async () => {
    const db = createRepository(createLocalStorageAdapter());
    await db.projects.add({ id: 'Alpha', title: 'Alpha' });
    expect(await db.projects.all()).toEqual([{ id: 'Alpha', title: 'Alpha' }]);
  });

  it('upsert replaces by id', async () => {
    const db = createRepository(createLocalStorageAdapter());
    await db.categories.add({ id: 'c1', name: 'Work', displayOrder: 0 });
    await db.categories.upsert({ id: 'c1', name: 'Personal', displayOrder: 0 });
    expect(await db.categories.all()).toEqual([{ id: 'c1', name: 'Personal', displayOrder: 0 }]);
  });

  it('export/import round-trips the whole db', async () => {
    const db = createRepository(createLocalStorageAdapter());
    await db.events.add({ id: 'e1', title: 'Holiday', date: '2026-01-01', type: 'custom' });
    const snap = await db.export();
    await db.events.clear();
    await db.import(snap);
    expect(await db.events.all()).toEqual([{ id: 'e1', title: 'Holiday', date: '2026-01-01', type: 'custom' }]);
  });
});
