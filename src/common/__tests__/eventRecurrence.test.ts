import { describe, expect, it } from 'vitest';

import type { AppEvent, RepeatRule } from '@/interfaces/Event';

import {
  atOccurrence,
  describeRepeat,
  getNextOccurrence,
  getOccurrences,
  isSameRule,
  repeatPresets,
  validateRepeat,
} from '@/common/eventRecurrence';

const event = (overrides: Partial<AppEvent> = {}): AppEvent => ({
  id: 'e',
  title: 'Host daily',
  date: '2026-10-06', // Tuesday
  type: 'custom',
  ...overrides,
});

const biweekly: RepeatRule = { freq: 'week', interval: 2 };

describe('getOccurrences', () => {
  it('returns every other Tuesday for a biweekly rule', () => {
    expect(getOccurrences(event({ repeat: biweekly }), '2026-10-01', '2026-11-30')).toEqual([
      '2026-10-06',
      '2026-10-20',
      '2026-11-03',
      '2026-11-17',
    ]);
  });

  it('never returns dates before the first occurrence', () => {
    expect(getOccurrences(event({ repeat: biweekly }), '2026-09-01', '2026-10-05')).toEqual([]);
  });

  it('leaves out skipped dates', () => {
    const e = event({ repeat: { ...biweekly, skip: ['2026-10-20'] } });
    expect(getOccurrences(e, '2026-10-01', '2026-11-10')).toEqual(['2026-10-06', '2026-11-03']);
  });

  it('includes a multi-day occurrence that started before the window', () => {
    // Sprint: Mon Oct 5 → Fri Oct 16, every 2 weeks
    const sprint = event({ date: '2026-10-05', endDate: '2026-10-16', repeat: biweekly });
    expect(getOccurrences(sprint, '2026-10-12', '2026-10-25')).toEqual(['2026-10-05', '2026-10-19']);
  });

  it('handles a one-off event', () => {
    expect(getOccurrences(event(), '2026-10-01', '2026-10-31')).toEqual(['2026-10-06']);
    expect(getOccurrences(event(), '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('respects count and until', () => {
    expect(getOccurrences(event({ repeat: { ...biweekly, end: { count: 2 } } }), '2026-10-01', '2027-01-01')).toEqual([
      '2026-10-06',
      '2026-10-20',
    ]);
    expect(
      getOccurrences(event({ repeat: { ...biweekly, end: { until: '2026-11-03' } } }), '2026-10-01', '2027-01-01'),
    ).toEqual(['2026-10-06', '2026-10-20', '2026-11-03']);
  });

  it('supports several weekdays per week', () => {
    const e = event({ date: '2026-10-05', repeat: { freq: 'week', interval: 1, weekdays: [1, 3, 5] } });
    expect(getOccurrences(e, '2026-10-05', '2026-10-11')).toEqual(['2026-10-05', '2026-10-07', '2026-10-09']);
  });

  it('repeats monthly on the nth and last weekday', () => {
    const nth = event({ repeat: { freq: 'month', interval: 1, monthlyBy: 'nthWeekday' } }); // 1st Tuesday
    expect(getOccurrences(nth, '2026-10-01', '2026-12-31')).toEqual(['2026-10-06', '2026-11-03', '2026-12-01']);

    const last = event({ date: '2026-10-30', repeat: { freq: 'month', interval: 1, monthlyBy: 'lastWeekday' } });
    expect(getOccurrences(last, '2026-10-01', '2026-12-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25']);
  });

  it('skips months without the day for day-of-month rules', () => {
    const e = event({ date: '2026-01-31', repeat: { freq: 'month', interval: 1 } });
    expect(getOccurrences(e, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-03-31']);
  });
});

describe('legacy Date-typed dates', () => {
  // The event form used to save the date picker's raw Date objects; those events must keep working
  const legacy = (overrides: Partial<AppEvent> = {}) =>
    event({ date: new Date(2026, 9, 6) as unknown as string, ...overrides });

  it('still appears for one-off events', () => {
    expect(getOccurrences(legacy(), '2026-10-01', '2026-10-31')).toEqual(['2026-10-06']);
    expect(getNextOccurrence(legacy(), '2026-10-01')).toBe('2026-10-06');
  });

  it('repeats from the local calendar day', () => {
    expect(getOccurrences(legacy({ repeat: biweekly }), '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-06',
      '2026-10-20',
    ]);
  });
});

describe('getNextOccurrence', () => {
  it('finds the next occurrence on or after a date', () => {
    const e = event({ repeat: biweekly });
    expect(getNextOccurrence(e, '2026-10-06')).toBe('2026-10-06');
    expect(getNextOccurrence(e, '2026-10-07')).toBe('2026-10-20');
    expect(getNextOccurrence(e, '2025-01-01')).toBe('2026-10-06');
  });

  it('walks past skipped dates', () => {
    const e = event({ repeat: { ...biweekly, skip: ['2026-10-20', '2026-11-03'] } });
    expect(getNextOccurrence(e, '2026-10-07')).toBe('2026-11-17');
  });

  it('counts an occurrence that is still running', () => {
    const sprint = event({ date: '2026-10-05', endDate: '2026-10-16', repeat: biweekly });
    expect(getNextOccurrence(sprint, '2026-10-14')).toBe('2026-10-05');
  });

  it('returns null once the series or one-off event is over', () => {
    expect(getNextOccurrence(event({ repeat: { ...biweekly, end: { count: 1 } } }), '2026-10-07')).toBeNull();
    expect(getNextOccurrence(event(), '2026-10-07')).toBeNull();
  });
});

describe('atOccurrence', () => {
  it('shifts date and endDate while keeping the span', () => {
    const sprint = event({ date: '2026-10-05', endDate: '2026-10-16' });
    expect(atOccurrence(sprint, '2026-10-19')).toMatchObject({ date: '2026-10-19', endDate: '2026-10-30' });
  });
});

describe('validateRepeat', () => {
  it('rejects ranges longer than the repeat gap', () => {
    expect(validateRepeat({ date: '2026-10-05', endDate: '2026-10-14' }, { freq: 'week', interval: 1 })).not.toBe('');
    expect(validateRepeat({ date: '2026-10-05', endDate: '2026-10-16' }, biweekly)).toBe('');
    expect(validateRepeat({ date: '2026-10-05' }, { freq: 'day', interval: 1 })).toBe('');
  });
});

describe('describeRepeat', () => {
  it('reads naturally', () => {
    expect(describeRepeat('2026-10-06', biweekly)).toBe('Every 2 weeks on Tuesday');
    expect(describeRepeat('2026-10-06', { freq: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5] })).toBe(
      'Every weekday (Mon–Fri)',
    );
    expect(describeRepeat('2026-10-06', { freq: 'month', interval: 1, monthlyBy: 'nthWeekday' })).toBe(
      'Every month on the first Tuesday',
    );
    expect(describeRepeat('2026-10-06', { ...biweekly, end: { count: 5 } })).toBe('Every 2 weeks on Tuesday, 5 times');
    expect(describeRepeat('2026-10-06', { freq: 'day', interval: 1, end: { until: '2026-12-31' } })).toBe(
      'Every day, until Dec 31, 2026',
    );
  });
});

describe('repeatPresets / isSameRule', () => {
  it('offers "last weekday" only when the date is the last of its weekday', () => {
    expect(repeatPresets('2026-10-06').some((p) => p.value.monthlyBy === 'lastWeekday')).toBe(false);
    expect(repeatPresets('2026-10-27').some((p) => p.value.monthlyBy === 'lastWeekday')).toBe(true);
  });

  it('matches rules regardless of weekday order and skip list', () => {
    expect(
      isSameRule(
        { freq: 'week', interval: 1, weekdays: [5, 1], skip: ['2026-10-09'] },
        { freq: 'week', interval: 1, weekdays: [1, 5] },
      ),
    ).toBe(true);
    expect(isSameRule(biweekly, { freq: 'week', interval: 1 })).toBe(false);
  });
});
