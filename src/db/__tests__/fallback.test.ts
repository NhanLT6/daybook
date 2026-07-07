import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock must be declared before importing '@/db' — vi.mock is hoisted above imports,
// so createIndexedDbAdapter() always returns this rejecting stub for every test in
// this file. Kept in its own file (separate from index.test.ts) because '@/db' binds
// its adapter once at module load; sharing a file with unmocked tests would leak the
// mock (or vice versa) via Vitest's module cache.
vi.mock('@/db/adapters/indexedDbAdapter', () => ({
  createIndexedDbAdapter: () => ({
    init: () => Promise.reject(new Error('IndexedDB open failed (simulated: private mode / quota / corruption)')),
    getAll: () => {
      throw new Error('not reached');
    },
    put: () => {
      throw new Error('not reached');
    },
    putMany: () => {
      throw new Error('not reached');
    },
    remove: () => {
      throw new Error('not reached');
    },
    clear: () => {
      throw new Error('not reached');
    },
    snapshot: () => {
      throw new Error('not reached');
    },
    restore: () => {
      throw new Error('not reached');
    },
    close: () => {
      throw new Error('not reached');
    },
  }),
}));

import { db, initDb } from '@/db';

describe('db fallback on IndexedDB open failure', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves initDb and serves reads/writes via localStorage instead of rejecting', async () => {
    await expect(initDb()).resolves.toBeUndefined();

    await db.projects.add({ id: 'X', title: 'X' });
    expect(await db.projects.all()).toEqual([{ id: 'X', title: 'X' }]);
  });
});
