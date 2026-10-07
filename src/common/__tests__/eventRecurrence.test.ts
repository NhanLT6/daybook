import { describe, expect, it } from 'vitest';

import type { AppEvent, RepeatRule } from '@/interfaces/Event';

import {
  atOccurrence,
  backToBackRule,
  describeRepeat,
  getNextOccurrence,
  getOccurrences,
  isSameRule,
  normalizeRule,
  nthWorkdayOfMonth,
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

  it('repeats a set of separately picked days together', () => {
    // Mon, Wed, Fri of one week, every week
    const e = event({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-07', '2026-10-09'], repeat: { freq: 'week', interval: 1 } });
    expect(getOccurrences(e, '2026-10-05', '2026-10-18')).toEqual(['2026-10-05', '2026-10-12']);
    expect(atOccurrence(e, '2026-10-12').dates).toEqual(['2026-10-12', '2026-10-14', '2026-10-16']);
    // A window touching only the Friday of an occurrence still returns that occurrence
    expect(getOccurrences(e, '2026-10-16', '2026-10-16')).toEqual(['2026-10-12']);
  });

  it('keeps day-of-month for separately picked days repeating monthly', () => {
    const e = event({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-20'], repeat: { freq: 'month', interval: 1 } });
    expect(atOccurrence(e, '2026-11-05').dates).toEqual(['2026-11-05', '2026-11-20']);
  });

  it('reads legacy nth / last weekday rules', () => {
    const nth = event({ repeat: { freq: 'month', interval: 1, monthlyBy: 'nthWeekday' } }); // 1st Tuesday
    expect(getOccurrences(nth, '2026-10-01', '2026-12-31')).toEqual(['2026-10-06', '2026-11-03', '2026-12-01']);

    const last = event({ date: '2026-10-30', repeat: { freq: 'month', interval: 1, monthlyBy: 'lastWeekday' } });
    expect(getOccurrences(last, '2026-10-01', '2026-12-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25']);
  });

  it('repeats monthly on the last day, following month length', () => {
    const last = event({ date: '2027-12-31', repeat: { freq: 'month', interval: 1, monthlyOn: { nth: -1, day: 'day' } } });
    expect(getOccurrences(last, '2028-01-01', '2028-04-30')).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ]);
  });

  it('repeats on a monthly position whatever the start date is', () => {
    // Second Tuesday, from a Wednesday start: Oct 13, Nov 10
    const second = event({ date: '2026-10-07', repeat: { freq: 'month', interval: 1, monthlyOn: { nth: 2, day: 2 } } });
    expect(getOccurrences(second, '2026-10-01', '2026-11-30')).toEqual(['2026-10-13', '2026-11-10']);
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
    const monToFri = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    expect(describeRepeat(monToFri, { freq: 'week', interval: 1 })).toBe('Every weekday (Mon–Fri)');
    // Sunday lists last (Monday-first week)
    expect(describeRepeat(['2026-10-04', '2026-10-05', '2026-10-09'], biweekly)).toBe(
      'Every 2 weeks on Monday, Friday and Sunday',
    );
    expect(describeRepeat(['2026-10-05', '2026-10-20'], { freq: 'month', interval: 1 })).toBe(
      'Every month on days 5 and 20',
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

describe('normalizeRule', () => {
  it('converts legacy monthlyBy using the start date', () => {
    const month = { freq: 'month', interval: 1 } as const;
    expect(normalizeRule({ ...month, monthlyBy: 'nthWeekday' }, '2026-10-13')).toEqual({ ...month, monthlyOn: { nth: 2, day: 2 } });
    expect(normalizeRule({ ...month, monthlyBy: 'lastWeekday' }, '2026-10-30')).toEqual({ ...month, monthlyOn: { nth: -1, day: 5 } });
    // A 5th weekday becomes the last
    expect(normalizeRule({ ...month, monthlyBy: 'nthWeekday' }, '2026-10-30')).toEqual({ ...month, monthlyOn: { nth: -1, day: 5 } });
    expect(normalizeRule({ ...month, monthlyBy: 'lastWorkday' }, '2026-10-30')).toEqual({
      ...month,
      monthlyOn: { nth: -1, day: 'workday' },
    });
    expect(normalizeRule({ ...month, monthlyBy: 'dayOfMonth' }, '2026-10-30')).toEqual(month);
  });

  it('describes positions', () => {
    expect(describeRepeat('2026-10-01', { freq: 'month', interval: 1 })).toBe('Every month on the first day');
    expect(describeRepeat('2026-10-07', { freq: 'month', interval: 1, monthlyOn: { nth: -1, day: 'day' } })).toBe(
      'Every month on the last day',
    );
    expect(describeRepeat('2026-10-07', { freq: 'month', interval: 2, monthlyOn: { nth: 1, day: 'workday' } })).toBe(
      'Every 2 months on the first work day',
    );
  });
});

describe('weekends and holidays (onNonWorkday)', () => {
  const calendar = { weekendDays: [6, 0], holidays: new Set(['2026-11-25']) };
  // Day 25: Oct 25 2026 is a Sunday, Nov 25 a holiday (Wed), Dec 25 a Friday
  const on25 = (onNonWorkday?: RepeatRule['onNonWorkday']) =>
    event({ date: '2026-10-25', repeat: { freq: 'month', interval: 1, ...(onNonWorkday ? { onNonWorkday } : {}) } });

  it('keeps, skips or moves occurrences on days off', () => {
    expect(getOccurrences(on25(), '2026-10-01', '2026-12-31', calendar)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
    expect(getOccurrences(on25('skip'), '2026-10-01', '2026-12-31', calendar)).toEqual(['2026-12-25']);
    expect(getOccurrences(on25('before'), '2026-10-01', '2026-12-31', calendar)).toEqual(['2026-10-23', '2026-11-24', '2026-12-25']);
    expect(getOccurrences(on25('after'), '2026-10-01', '2026-12-31', calendar)).toEqual(['2026-10-26', '2026-11-26', '2026-12-25']);
  });

  it('finds moved occurrences across window edges', () => {
    // Oct 25 moved back to Fri Oct 23: still found from a window that starts on the 23rd
    expect(getOccurrences(on25('before'), '2026-10-23', '2026-10-23', calendar)).toEqual(['2026-10-23']);
    expect(getNextOccurrence(on25('before'), '2026-10-20', calendar)).toBe('2026-10-23');
    expect(getNextOccurrence(on25('skip'), '2026-10-01', calendar)).toBe('2026-12-25');
  });

  it('skips moved dates listed in skip', () => {
    const series = event({ date: '2026-10-25', repeat: { freq: 'month', interval: 1, onNonWorkday: 'before', skip: ['2026-10-23'] } });
    expect(getNextOccurrence(series, '2026-10-01', calendar)).toBe('2026-11-24');
  });

  it('applies to single days only, and says so in the summary', () => {
    const range = event({ date: '2026-10-24', endDate: '2026-10-25', repeat: { freq: 'month', interval: 1, onNonWorkday: 'skip' } });
    expect(getOccurrences(range, '2026-10-01', '2026-10-31', calendar)).toEqual(['2026-10-24']);
    expect(describeRepeat('2026-10-25', { freq: 'month', interval: 1, onNonWorkday: 'before' })).toBe(
      'Every month on day 25, or the work day before if off',
    );
    expect(describeRepeat('2026-10-25', { freq: 'week', interval: 1, onNonWorkday: 'skip' })).toBe(
      'Every week on Sunday, skipping days off',
    );
  });

  it('ends a counted series', () => {
    const twice = event({ date: '2026-10-25', repeat: { freq: 'month', interval: 1, onNonWorkday: 'after', end: { count: 2 } } });
    expect(getNextOccurrence(twice, '2026-12-01', calendar)).toBeNull();
  });
});

describe('last work day of the month', () => {
  const lastWorkday: RepeatRule = { freq: 'month', interval: 1, monthlyOn: { nth: -1, day: 'workday' } };
  const satSun = { weekendDays: [6, 0], holidays: new Set<string>() };

  it('steps back over weekend days and holidays', () => {
    // Sat Oct 31 2026 → Fri Oct 30; with a Fri–Sun weekend → Thu Oct 29
    expect(nthWorkdayOfMonth('2026-10-05', -1, satSun)).toBe('2026-10-30');
    // Oct 1 2026 is a Thursday: 1st work day Oct 1, 2nd Oct 2, 3rd Mon Oct 5
    expect(nthWorkdayOfMonth('2026-10-20', 1, satSun)).toBe('2026-10-01');
    expect(nthWorkdayOfMonth('2026-10-20', 3, satSun)).toBe('2026-10-05');
    expect(nthWorkdayOfMonth('2026-10-05', -1, { ...satSun, weekendDays: [5, 6, 0] })).toBe('2026-10-29');
    // Fri Apr 30 2027 is a holiday → Thu Apr 29
    expect(nthWorkdayOfMonth('2027-04-01', -1, { ...satSun, holidays: new Set(['2027-04-30']) })).toBe('2027-04-29');
    expect(nthWorkdayOfMonth('2026-10-05', -1, { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: new Set() })).toBeNull();
  });

  it('repeats on each month\'s last work day, following the calendar', () => {
    const series = event({ date: '2026-10-30', repeat: lastWorkday });
    expect(getOccurrences(series, '2026-10-01', '2027-04-30', satSun)).toEqual([
      '2026-10-30',
      '2026-11-30',
      '2026-12-31',
      '2027-01-29',
      '2027-02-26',
      '2027-03-31',
      '2027-04-30',
    ]);

    const withHoliday = { ...satSun, holidays: new Set(['2027-04-30']) };
    expect(getOccurrences(series, '2027-04-01', '2027-04-30', withHoliday)).toEqual(['2027-04-29']);
    expect(getNextOccurrence(series, '2027-04-01', withHoliday)).toBe('2027-04-29');
  });

  it('starts at the first last-work-day on or after the start date', () => {
    const series = event({ date: '2026-10-05', repeat: { ...lastWorkday, interval: 2 } });
    expect(getNextOccurrence(series, '2026-10-01', satSun)).toBe('2026-10-30');
    expect(getOccurrences(series, '2026-10-01', '2027-02-28', satSun)).toEqual([
      '2026-10-30',
      '2026-12-31',
      '2027-02-26',
    ]);
  });

  it('honours skip, until and count', () => {
    const skipped = event({ date: '2026-10-30', repeat: { ...lastWorkday, skip: ['2026-11-30'] } });
    expect(getNextOccurrence(skipped, '2026-11-01', satSun)).toBe('2026-12-31');

    const until = event({ date: '2026-10-30', repeat: { ...lastWorkday, end: { until: '2026-12-30' } } });
    expect(getOccurrences(until, '2026-10-01', '2027-03-31', satSun)).toEqual(['2026-10-30', '2026-11-30']);

    // A skipped occurrence still counts toward `count`, as with rrule rules
    const twice = event({ date: '2026-10-30', repeat: { ...lastWorkday, end: { count: 2 }, skip: ['2026-10-30'] } });
    expect(getOccurrences(twice, '2026-10-01', '2027-03-31', satSun)).toEqual(['2026-11-30']);
    expect(getNextOccurrence(twice, '2026-12-01', satSun)).toBeNull();
  });

  it('never loops when no day is a work day', () => {
    const series = event({ date: '2026-10-30', repeat: lastWorkday });
    expect(getNextOccurrence(series, '2026-10-01', { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: new Set() })).toBeNull();
  });

  it('describes and offers the rule for a single day only', () => {
    expect(describeRepeat('2026-10-30', lastWorkday)).toBe('Every month on the last work day');
    const offered = (shape: Parameters<typeof repeatPresets>[0]) =>
      repeatPresets(shape).some((p) => p.value.monthlyOn?.day === 'workday');
    expect(offered({ date: '2026-10-05' })).toBe(true);
    expect(offered({ date: '2026-10-05', endDate: '2026-10-07' })).toBe(false);
    expect(offered({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-09'] })).toBe(false);
  });
});

describe('repeatPresets / isSameRule', () => {
  it('offers "last weekday" only when the date is the last of its weekday', () => {
    const offersLast = (date: string) => repeatPresets({ date }).some((p) => p.value.monthlyOn?.nth === -1 && p.value.monthlyOn.day !== 'workday');
    expect(offersLast('2026-10-06')).toBe(false);
    expect(offersLast('2026-10-27')).toBe(true);
  });

  it('only offers rules the dates fit', () => {
    // A 12-day sprint can't repeat daily or weekly
    const sprint = repeatPresets({ date: '2026-10-05', endDate: '2026-10-16' }).map((p) => p.title);
    expect(sprint).toEqual([
      'When it ends (every 2 weeks on Monday)',
      'Every month on the first Monday',
      'Every month on day 5',
      'Every year on Oct 5',
    ]);

    // Several picked days: no "nth weekday" (it describes one start day)
    const days = repeatPresets({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-09'] }).map((p) => p.title);
    expect(days).toEqual([
      'Every week on Monday and Friday',
      'Every 2 weeks on Monday and Friday',
      'Every month on days 5 and 9',
      'Every year on Oct 5 and Oct 9',
    ]);
  });

  it('offers "When it ends" only for ranges, in place of the plain preset for the same rule', () => {
    const [first, ...rest] = repeatPresets({ date: '2026-10-05', endDate: '2026-10-16' });
    expect(first).toMatchObject({ backToBack: true, value: { freq: 'week', interval: 2 } });
    expect(rest.some((p) => isSameRule(p.value, first.value))).toBe(false);

    expect(repeatPresets({ date: '2026-10-05' }).some((p) => p.backToBack)).toBe(false);
    expect(repeatPresets({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-09'] }).some((p) => p.backToBack)).toBe(
      false,
    );
  });

  it('matches rules regardless of the skip list', () => {
    expect(
      isSameRule(
        { freq: 'week', interval: 1, skip: ['2026-10-09'] },
        { freq: 'week', interval: 1 },
      ),
    ).toBe(true);
    expect(isSameRule(biweekly, { freq: 'week', interval: 1 })).toBe(false);
  });
});

describe('backToBackRule', () => {
  it('restarts a Mon→Fri sprint on Monday when only the weekend lies between', () => {
    // 2-week sprint Mon Oct 5 → Fri Oct 16
    expect(backToBackRule({ date: '2026-10-05', endDate: '2026-10-16' })).toEqual({ freq: 'week', interval: 2 });
    // 1-week Mon → Fri
    expect(backToBackRule({ date: '2026-10-05', endDate: '2026-10-09' })).toEqual({ freq: 'week', interval: 1 });
  });

  it('restarts the day after a range that fills whole weeks', () => {
    // Mon Oct 5 → Sun Oct 18
    expect(backToBackRule({ date: '2026-10-05', endDate: '2026-10-18' })).toEqual({ freq: 'week', interval: 2 });
  });

  it('follows the weekend setting', () => {
    // Mon → Thu with a Fri–Sun weekend restarts Monday; with Sat–Sun, Friday is a gap day
    const monThu = { date: '2026-10-05', endDate: '2026-10-15' };
    expect(backToBackRule(monThu, [5, 6, 0])).toEqual({ freq: 'week', interval: 2 });
    expect(backToBackRule(monThu, [6, 0])).toEqual({ freq: 'day', interval: 11 });
  });

  it('restarts the very next day when weekdays would be left out', () => {
    // Wed Oct 7 → Mon Oct 12 (6 days): Tuesday isn't a weekend day
    const rule = backToBackRule({ date: '2026-10-07', endDate: '2026-10-12' });
    expect(rule).toEqual({ freq: 'day', interval: 6 });
    expect(
      getOccurrences(event({ date: '2026-10-07', endDate: '2026-10-12', repeat: rule! }), '2026-10-01', '2026-10-31'),
    ).toEqual(['2026-10-07', '2026-10-13', '2026-10-19', '2026-10-25', '2026-10-31']);
  });

  it('is null for anything but a range', () => {
    expect(backToBackRule({ date: '2026-10-05' })).toBeNull();
    expect(backToBackRule({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-09'] })).toBeNull();
  });
});
