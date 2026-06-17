import { beforeEach, describe, expect, it } from 'vitest';

import { createPinia, setActivePinia } from 'pinia';

import { accumulateMinutesByProject, applyLines, buildCatchUpItems, deriveItemId, formatEffort, isAiAvailable, shouldSkipCatchUp, useCatchUpSummary } from '@/composables/useCatchUpSummary';
import type { CatchUpItem, CatchUpRenderItem } from '@/composables/useCatchUpSummary';
import { useNotificationCenterStore } from '@/stores/notificationCenter';

describe('useCatchUpSummary helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('skips catch-up when AI is unavailable', () => {
    expect(shouldSkipCatchUp('2026-05-29', null, { enabled: false, model: 'gemini-2.5-flash' })).toBe(true);
  });

  it('skips catch-up when dismissed today', () => {
    expect(
      shouldSkipCatchUp('2026-05-29', '2026-05-29', { enabled: true, model: 'gemini-2.5-flash' }),
    ).toBe(true);
  });

  it('allows catch-up when AI is available and not dismissed', () => {
    const config = { enabled: true, model: 'gemini-2.5-flash' };

    expect(isAiAvailable(config)).toBe(true);
    expect(shouldSkipCatchUp('2026-05-29', null, config)).toBe(false);
  });

  it('enqueues a ready catch-up notification', () => {
    const { enqueueCatchUp } = useCatchUpSummary();
    const notificationCenter = useNotificationCenterStore();

    const items: CatchUpRenderItem[] = [{ project: 'DS-1 Thing', text: 'Did the thing', ongoing: false }];
    enqueueCatchUp(items, '2026-05-29');

    expect(notificationCenter.queueCount).toBe(1);
    expect(notificationCenter.activeItem?.kind).toBe('catchup');
    expect(notificationCenter.activeItem?.payload?.items).toEqual(items);
  });
});

describe('deriveItemId', () => {
  it('is stable for the same project string', () => {
    expect(deriveItemId('DS-4272 Cross-channel notification synchronization')).toBe(
      deriveItemId('DS-4272 Cross-channel notification synchronization'),
    );
  });

  it('differs for different project strings', () => {
    expect(deriveItemId('DS-4272 Sync')).not.toBe(deriveItemId('DS-4319 Teams'));
  });
});

describe('formatEffort', () => {
  it('formats 15h as 1d 7h', () => {
    expect(formatEffort(15 * 60)).toBe('1d 7h');
  });

  it('drops zero hours (16h -> 2d)', () => {
    expect(formatEffort(16 * 60)).toBe('2d');
  });

  it('formats 18h as 2d 2h', () => {
    expect(formatEffort(18 * 60)).toBe('2d 2h');
  });
});

describe('accumulateMinutesByProject', () => {
  it('sums duration per project across logs', () => {
    const logs = [
      { id: '1', date: '2026-06-10', project: 'A', task: 'a', duration: 120 },
      { id: '2', date: '2026-06-11', project: 'A', task: 'a', duration: 60 },
      { id: '3', date: '2026-06-11', project: 'B', task: 'b', duration: 30 },
    ];
    const totals = accumulateMinutesByProject(logs);
    expect(totals.get('A')).toBe(180);
    expect(totals.get('B')).toBe(30);
  });
});

describe('buildCatchUpItems', () => {
  const didLogs = [
    { id: '1', date: '2026-06-12', project: 'DS-4272 Sync', task: 'Sync Teams', duration: 90 },
    { id: '2', date: '2026-06-12', project: 'DS-4272 Sync', task: 'Sync Slack', duration: 30 },
    { id: '3', date: '2026-06-12', project: 'DS-4319 Teams fail', task: 'CTA label', duration: 200 },
  ];

  it('groups logs by project into one item each', () => {
    const items = buildCatchUpItems(didLogs, new Map());
    expect(items).toHaveLength(2);
    const sync = items.find((i: CatchUpItem) => i.project === 'DS-4272 Sync');
    expect(sync?.logs).toHaveLength(2);
    expect(sync?.windowMinutes).toBe(120);
  });

  it('orders by did-window minutes descending', () => {
    const items = buildCatchUpItems(didLogs, new Map());
    expect(items[0].project).toBe('DS-4319 Teams fail'); // 200 > 120
  });

  it('flags ongoing when accumulated >= 15h, ignoring those under', () => {
    const accumulated = new Map([
      ['DS-4272 Sync', 16 * 60],
      ['DS-4319 Teams fail', 5 * 60],
    ]);
    const items = buildCatchUpItems(didLogs, accumulated);
    expect(items.find((i: CatchUpItem) => i.project === 'DS-4272 Sync')?.ongoing).toBe(true);
    expect(items.find((i: CatchUpItem) => i.project === 'DS-4319 Teams fail')?.ongoing).toBe(false);
  });

  it('does not flag a project that is heavy only outside the window', () => {
    // accumulated map only contains in-window totals; an out-of-window project is absent
    const items = buildCatchUpItems(didLogs, new Map([['DS-4272 Sync', 120]]));
    expect(items.every((i: CatchUpItem) => i.ongoing)).toBe(false);
  });
});

describe('applyLines', () => {
  const items: CatchUpItem[] = [
    { id: 'a', project: 'P1', logs: [], windowMinutes: 60, accumulatedMinutes: 16 * 60, ongoing: true },
    { id: 'b', project: 'P2', logs: [], windowMinutes: 30, accumulatedMinutes: 60, ongoing: false },
  ];

  it('zips AI text onto items by id regardless of order', () => {
    const rendered = applyLines(items, [
      { id: 'b', text: 'Did P2 work' },
      { id: 'a', text: 'Did P1 work' },
    ]);
    expect(rendered[0]).toEqual({ project: 'P1', text: 'Did P1 work', ongoing: true, effortLabel: '2d' });
    expect(rendered[1]).toEqual({ project: 'P2', text: 'Did P2 work', ongoing: false, effortLabel: undefined });
  });

  it('falls back to the project label when an id is missing', () => {
    const rendered = applyLines(items, [{ id: 'a', text: 'Did P1 work' }]);
    expect(rendered[1].text).toBe('P2');
  });
});
