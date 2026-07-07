import { beforeEach, describe, expect, it } from 'vitest';

import { db, initDb } from '@/db';

describe('db singleton', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
  });

  it('initializes and serves an empty collection', async () => {
    expect(await db.projects.all()).toEqual([]);
  });

  it('persists across a write', async () => {
    await db.projects.add({ id: 'X', title: 'X' });
    expect(await db.projects.all()).toEqual([{ id: 'X', title: 'X' }]);
  });
});
