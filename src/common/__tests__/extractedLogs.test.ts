import { describe, expect, it } from 'vitest';

import type { ExtractedLog } from '@/interfaces/aiTools';

import { isUnresolvedRest, resolveExtractedLogs, type ResolveLogsContext } from '../extractedLogs';

const DATE = '2026-10-28';

const ctx = (over: Partial<ResolveLogsContext> = {}): ResolveLogsContext => ({
  projects: ['Team work', 'DS-4475 Redesigned test tracking flow', 'DS-4479 New sign-up form for CF Access'],
  tasks: [
    { project: 'Team work', title: 'Daily meeting' },
    { project: 'Team work', title: 'Code review' },
  ],
  targetMinutes: 480,
  loggedMinutesOn: () => 0,
  ...over,
});

const log = (over: Partial<ExtractedLog>): ExtractedLog => ({ project: 'Team work', date: DATE, ...over });

describe('resolveExtractedLogs', () => {
  // "/log daily 10mins. code review DS-4556 30 mins. 2hours for DS-4475 Redesigned test tracking flow and the
  // rest for DS-4479 New sign-up form for CF Access", the way the model split it up
  it('tidies the reported /log message into consistent entries', () => {
    const resolved = resolveExtractedLogs(
      [
        log({ task: 'Daily meeting', duration: 10 }),
        log({ task: 'Code review', duration: 30, description: 'Review DS-4556' }),
        log({
          project: 'DS-4475',
          task: 'Redesigned test tracking flow',
          duration: 120,
          description: 'Redesigned test tracking flow',
        }),
        log({ project: 'DS-4479 New sign-up form for CF Access', task: 'New sign-up form for CF Access', restOfDay: true }),
      ],
      ctx(),
    );

    expect(resolved).toEqual([
      log({ task: 'Daily meeting', duration: 10, description: undefined }),
      log({ task: 'Code review', duration: 30, description: 'Review DS-4556' }),
      log({ project: 'DS-4475 Redesigned test tracking flow', task: undefined, duration: 120, description: undefined }),
      log({
        project: 'DS-4479 New sign-up form for CF Access',
        task: undefined,
        restOfDay: true,
        duration: 480 - 10 - 30 - 120,
        description: undefined,
      }),
    ]);
  });

  it('snaps names to the user spelling', () => {
    const [entry] = resolveExtractedLogs([log({ project: 'team WORK', task: 'code review', duration: 15 })], ctx());
    expect(entry).toMatchObject({ project: 'Team work', task: 'Code review' });
  });

  it('keeps a ticket key it does not know, as written', () => {
    const [entry] = resolveExtractedLogs([log({ project: 'XY-9 Something new', duration: 15 })], ctx());
    expect(entry.project).toBe('XY-9 Something new');
  });

  it('keeps a real task on a ticket project', () => {
    const [entry] = resolveExtractedLogs(
      [log({ project: 'DS-4475', task: 'Testing', duration: 15 })],
      ctx(),
    );
    expect(entry).toMatchObject({ project: 'DS-4475 Redesigned test tracking flow', task: 'Testing' });
  });

  it('drops a description that only repeats the task', () => {
    const [entry] = resolveExtractedLogs([log({ task: 'Code review', description: 'code review', duration: 30 })], ctx());
    expect(entry.description).toBeUndefined();
  });

  describe('the rest of the day', () => {
    it('subtracts what is already saved that day', () => {
      const resolved = resolveExtractedLogs(
        [log({ duration: 60 }), log({ project: 'DS-4475', restOfDay: true })],
        ctx({ loggedMinutesOn: (d) => (d === DATE ? 100 : 0) }),
      );
      expect(resolved[1].duration).toBe(480 - 100 - 60);
    });

    it('only counts entries on the same date', () => {
      const resolved = resolveExtractedLogs(
        [log({ date: '2026-10-27', duration: 300 }), log({ project: 'DS-4475', restOfDay: true })],
        ctx(),
      );
      expect(resolved[1].duration).toBe(480);
    });

    it('ignores a duration the model worked out itself', () => {
      const resolved = resolveExtractedLogs(
        [log({ duration: 160 }), log({ project: 'DS-4475', restOfDay: true, duration: 220 })],
        ctx(),
      );
      expect(resolved[1].duration).toBe(320);
    });

    it('leaves it unresolved when the day is already full', () => {
      const resolved = resolveExtractedLogs([log({ duration: 500 }), log({ restOfDay: true })], ctx());
      expect(resolved[1].duration).toBeUndefined();
      expect(isUnresolvedRest(resolved[1])).toBe(true);
    });

    it('leaves it unresolved without a daily target', () => {
      const [entry] = resolveExtractedLogs([log({ restOfDay: true })], ctx({ targetMinutes: null }));
      expect(isUnresolvedRest(entry)).toBe(true);
    });
  });
});
