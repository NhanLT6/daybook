import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

import { db, initDb } from '@/db';
import { useBackup } from '@/composables/useBackup';

describe('useBackup', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
    await db.events.clear();
  });

  it('importBackup replaces the store from a snapshot file', async () => {
    const snap = {
      schemaVersion: 1,
      collections: {
        timeLogs: [],
        projects: [],
        tasks: [],
        pinnedProjects: [],
        categories: [],
        events: [{ id: 'e', title: 'X', date: '2026-01-01', type: 'custom' }],
      },
    };
    const file = new File([JSON.stringify(snap)], 'backup.json', { type: 'application/json' });
    await useBackup().importBackup(file);
    expect(await db.events.all()).toEqual([{ id: 'e', title: 'X', date: '2026-01-01', type: 'custom' }]);
  });
});
