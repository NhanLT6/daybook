import { beforeEach, describe, expect, it } from 'vitest';

import type { StorageAdapter } from '@/db/types';

interface Row {
  id: string;
  v: number;
}

// Shared behavior every StorageAdapter must satisfy. Run against each adapter.
export function runAdapterContract(makeAdapter: () => StorageAdapter, reset: () => Promise<void>): void {
  describe('StorageAdapter contract', () => {
    let adapter: StorageAdapter;

    beforeEach(async () => {
      await reset();
      adapter = makeAdapter();
      await adapter.init();
    });

    it('returns empty array for an unseen collection', async () => {
      expect(await adapter.getAll('timeLogs')).toEqual([]);
    });

    it('put then getAll round-trips a record', async () => {
      await adapter.put<Row>('projects', { id: 'a', v: 1 });
      expect(await adapter.getAll<Row>('projects')).toEqual([{ id: 'a', v: 1 }]);
    });

    it('put upserts by id (no duplicates)', async () => {
      await adapter.put<Row>('projects', { id: 'a', v: 1 });
      await adapter.put<Row>('projects', { id: 'a', v: 2 });
      expect(await adapter.getAll<Row>('projects')).toEqual([{ id: 'a', v: 2 }]);
    });

    it('putMany writes multiple and upserts', async () => {
      await adapter.putMany<Row>('tasks', [
        { id: 'a', v: 1 },
        { id: 'b', v: 1 },
      ]);
      await adapter.putMany<Row>('tasks', [{ id: 'b', v: 9 }]);
      const rows = (await adapter.getAll<Row>('tasks')).sort((x, y) => x.id.localeCompare(y.id));
      expect(rows).toEqual([
        { id: 'a', v: 1 },
        { id: 'b', v: 9 },
      ]);
    });

    it('remove deletes by id', async () => {
      await adapter.putMany<Row>('tasks', [
        { id: 'a', v: 1 },
        { id: 'b', v: 1 },
      ]);
      await adapter.remove('tasks', 'a');
      expect(await adapter.getAll<Row>('tasks')).toEqual([{ id: 'b', v: 1 }]);
    });

    it('clear empties one collection only', async () => {
      await adapter.put<Row>('tasks', { id: 'a', v: 1 });
      await adapter.put<Row>('projects', { id: 'p', v: 1 });
      await adapter.clear('tasks');
      expect(await adapter.getAll<Row>('tasks')).toEqual([]);
      expect(await adapter.getAll<Row>('projects')).toEqual([{ id: 'p', v: 1 }]);
    });

    it('snapshot then restore reproduces all collections', async () => {
      await adapter.put<Row>('events', { id: 'e', v: 5 });
      const snap = await adapter.snapshot();
      await adapter.clear('events');
      await adapter.restore(snap);
      expect(await adapter.getAll<Row>('events')).toEqual([{ id: 'e', v: 5 }]);
    });

    it('restore replaces existing data (not merge)', async () => {
      await adapter.put<Row>('events', { id: 'old', v: 1 });
      await adapter.restore({
        schemaVersion: 1,
        collections: {
          timeLogs: [],
          projects: [],
          tasks: [],
          pinnedProjects: [],
          categories: [],
          events: [{ id: 'new', v: 2 }],
        },
      });
      expect(await adapter.getAll<Row>('events')).toEqual([{ id: 'new', v: 2 }]);
    });
  });
}
