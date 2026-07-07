import { beforeEach, describe, expect, it } from 'vitest';

import { initDb } from '@/db';
import { useTimeLogs } from '@/composables/useTimeLogs';

describe('useTimeLogs', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
    const t = useTimeLogs();
    await t.ready;
    await t.clear();
  });

  it('filters by month and range on ISO dates', async () => {
    const t = useTimeLogs();
    await t.addMany([
      { id: 'a', date: '2026-06-30', project: 'P', task: 'T', type: 'log', duration: 1 },
      { id: 'b', date: '2026-07-01', project: 'P', task: 'T', type: 'log', duration: 1 },
      { id: 'c', date: '2026-07-15', project: 'P', task: 'T', type: 'log', duration: 1 },
    ]);
    expect(t.forMonth('2026-07').map((l) => l.id).sort()).toEqual(['b', 'c']);
    expect(t.inRange('2026-06-30', '2026-07-01').map((l) => l.id).sort()).toEqual(['a', 'b']);
  });
});
