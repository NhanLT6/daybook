import { beforeEach, describe, expect, it } from 'vitest';

import { createLocalStorageAdapter } from '@/db/adapters/localStorageAdapter';
import { getSchemaVersion } from '@/db/dbMeta';
import { runMigrations } from '@/db/migrations';

describe('migration 001: legacy localStorage -> unified collections', () => {
  beforeEach(() => localStorage.clear());

  function seedLegacy() {
    localStorage.setItem(
      'timeLogs-2026-06',
      JSON.stringify([{ id: 'l1', date: '06/15/2026', project: 'Alpha', task: 'Dev', duration: 2, type: 'log' }]),
    );
    localStorage.setItem(
      'timeLogs-2026-07',
      JSON.stringify([{ id: 'l2', date: '07/01/2026', project: 'Beta', task: 'QA', type: 'plan' }]),
    );
    localStorage.setItem('projects-2026-06', JSON.stringify([{ title: 'Alpha' }]));
    localStorage.setItem('projects-2026-07', JSON.stringify([{ title: 'Alpha' }, { title: 'Beta' }]));
    localStorage.setItem('tasks-2026-07', JSON.stringify([{ project: 'Alpha', title: 'Dev' }]));
    localStorage.setItem('pinnedProjects-2026-07', JSON.stringify(['Alpha']));
    localStorage.setItem('categories', JSON.stringify([{ id: 'work', name: 'Work', displayOrder: 0 }]));
    localStorage.setItem('events', JSON.stringify([{ id: 'e1', title: 'NY', date: '2026-01-01', type: 'custom' }]));
  }

  it('imports, normalizes dates to ISO, and dedupes', async () => {
    seedLegacy();
    const adapter = createLocalStorageAdapter();
    await adapter.init();
    await runMigrations(adapter);

    const logs = (await adapter.getAll('timeLogs')).sort((a: any, b: any) => a.id.localeCompare(b.id));
    expect(logs).toEqual([
      { id: 'l1', date: '2026-06-15', project: 'Alpha', task: 'Dev', duration: 2, type: 'log' },
      { id: 'l2', date: '2026-07-01', project: 'Beta', task: 'QA', type: 'plan' },
    ]);

    const projects = (await adapter.getAll('projects')).map((p: any) => p.id).sort();
    expect(projects).toEqual(['Alpha', 'Beta']);

    expect(await adapter.getAll('tasks')).toEqual([{ id: 'Alpha::Dev', project: 'Alpha', title: 'Dev' }]);
    expect(await adapter.getAll('pinnedProjects')).toEqual([{ id: 'Alpha' }]);
    expect(getSchemaVersion()).toBe(1);
  });

  it('is idempotent (second run is a no-op)', async () => {
    seedLegacy();
    const adapter = createLocalStorageAdapter();
    await adapter.init();
    await runMigrations(adapter);
    await runMigrations(adapter);
    expect(await adapter.getAll('timeLogs')).toHaveLength(2);
  });

  it('leaves legacy keys intact', async () => {
    seedLegacy();
    const adapter = createLocalStorageAdapter();
    await adapter.init();
    await runMigrations(adapter);
    expect(localStorage.getItem('timeLogs-2026-06')).not.toBeNull();
  });
});
