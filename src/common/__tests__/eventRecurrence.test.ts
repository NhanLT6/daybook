import { describe, expect, it } from 'vitest';

import type { AppEvent, RepeatRule } from '@/interfaces/Event';

import {
  atOccurrence,
  backToBackRule,
  daysFromMonthEnd,
  describeDayFromEnd,
  describeRepeat,
  getNextOccurrence,
  getOccurrences,
  isSameRule,
  lastWorkdayOfMonth,
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

  it('repeats monthly on the nth and last weekday', () => {
    const nth = event({ repeat: { freq: 'month', interval: 1, monthlyBy: 'nthWeekday' } }); // 1st Tuesday
    expect(getOccurrences(nth, '2026-10-01', '2026-12-31')).toEqual(['2026-10-06', '2026-11-03', '2026-12-01']);

    const last = event({ date: '2026-10-30', repeat: { freq: 'month', interval: 1, monthlyBy: 'lastWeekday' } });
    expect(getOccurrences(last, '2026-10-01', '2026-12-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25']);
  });

  it('repeats monthly on the same distance from month end', () => {
    // Last day: follows month length, including a leap-year February
    const last = event({ date: '2027-12-31', repeat: { freq: 'month', interval: 1, monthlyBy: 'dayFromEnd' } });
    expect(getOccurrences(last, '2028-01-01', '2028-04-30')).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ]);

    // 3rd to last day (Oct 29)
    const third = event({ date: '2026-10-29', repeat: { freq: 'month', interval: 1, monthlyBy: 'dayFromEnd' } });
    expect(getOccurrences(third, '2026-10-01', '2027-03-31')).toEqual([
      '2026-10-29',
      '2026-11-28',
      '2026-12-29',
      '2027-01-29',
      '2027-02-26',
      '2027-03-29',
    ]);
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

describe('month-end helpers', () => {
  it('measures the distance from month end', () => {
    expect(daysFromMonthEnd('2026-10-31')).toBe(0);
    expect(daysFromMonthEnd('2026-10-29')).toBe(2);
    expect(daysFromMonthEnd('2028-02-01')).toBe(28);
  });

  it('names the day counting back from month end', () => {
    expect(describeDayFromEnd('2026-10-31')).toBe('last day');
    expect(describeDayFromEnd('2026-10-30')).toBe('2nd to last day');
    expect(describeDayFromEnd('2026-10-29')).toBe('3rd to last day');
    expect(describeDayFromEnd('2026-10-21')).toBe('11th to last day');
  });

  it('describes first-day and last-day rules', () => {
    expect(describeRepeat('2026-10-01', { freq: 'month', interval: 1 })).toBe('Every month on the first day');
    expect(describeRepeat('2026-10-31', { freq: 'month', interval: 1, monthlyBy: 'dayFromEnd' })).toBe(
      'Every month on the last day',
    );
  });

  it('leaves from-month-end out of the presets (Custom panel only)', () => {
    expect(repeatPresets({ date: '2026-10-31' }).some((p) => p.value.monthlyBy === 'dayFromEnd')).toBe(false);
  });
});

describe('last work day of the month', () => {
  const lastWorkday: RepeatRule = { freq: 'month', interval: 1, monthlyBy: 'lastWorkday' };
  const satSun = { weekendDays: [6, 0], holidays: new Set<string>() };

  it('steps back over weekend days and holidays', () => {
    // Sat Oct 31 2026 → Fri Oct 30; with a Fri–Sun weekend → Thu Oct 29
    expect(lastWorkdayOfMonth('2026-10-05', satSun)).toBe('2026-10-30');
    expect(lastWorkdayOfMonth('2026-10-05', { ...satSun, weekendDays: [5, 6, 0] })).toBe('2026-10-29');
    // Fri Apr 30 2027 is a holiday → Thu Apr 29
    expect(lastWorkdayOfMonth('2027-04-01', { ...satSun, holidays: new Set(['2027-04-30']) })).toBe('2027-04-29');
    expect(lastWorkdayOfMonth('2026-10-05', { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: new Set() })).toBeNull();
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
      repeatPresets(shape).some((p) => p.value.monthlyBy === 'lastWorkday');
    expect(offered({ date: '2026-10-05' })).toBe(true);
    expect(offered({ date: '2026-10-05', endDate: '2026-10-07' })).toBe(false);
    expect(offered({ date: '2026-10-05', dates: ['2026-10-05', '2026-10-09'] })).toBe(false);
  });
});

describe('repeatPresets / isSameRule', () => {
  it('offers "last weekday" only when the date is the last of its weekday', () => {
    expect(repeatPresets({ date: '2026-10-06' }).some((p) => p.value.monthlyBy === 'lastWeekday')).toBe(false);
    expect(repeatPresets({ date: '2026-10-27' }).some((p) => p.value.monthlyBy === 'lastWeekday')).toBe(true);
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
