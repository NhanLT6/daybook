import dayjs, { type Dayjs } from 'dayjs';

import { RRule, type Options, type Weekday } from 'rrule';

import type { AppEvent, RepeatRule, WorkCalendar } from '@/interfaces/Event';

/**
 * Repeating events: our stored `RepeatRule` is a friendly, typed layer; rrule only does the date math.
 *
 * Dates are YYYY-MM-DD strings everywhere. rrule works on JS Dates and recommends "floating" UTC
 * dates, so each string is mapped to UTC midnight and read back with toISOString() — this keeps
 * results independent of the viewer's timezone. Times (HH:mm) never enter rrule; every occurrence
 * reuses the event's startTime/endTime.
 */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];
const FREQ_UNIT: Record<RepeatRule['freq'], string> = { day: 'day', week: 'week', month: 'month', year: 'year' };

// rrule weekdays start on Monday (MO = 0); dayjs().day() starts on Sunday (0)
const RRULE_WEEKDAYS: Weekday[] = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

// Cap on consecutive skipped dates walked past when looking for the next occurrence
const MAX_SCAN = 500;

// Used when a caller has no work calendar at hand (tests, validation): Sat–Sun weekend, no holidays
const DEFAULT_WORK_CALENDAR: WorkCalendar = { weekendDays: [0, 6], holidays: new Set() };

// Events created through the date picker before dates were normalized hold a JS Date at runtime
// despite the `string` type — funnel every read through toDay so both shapes work.
const toDay = (date: string | Date): string => dayjs(date).format('YYYY-MM-DD');

const toUtcDate = (date: string): Date => new Date(`${toDay(date)}T00:00:00Z`);
const fromUtcDate = (date: Date): string => date.toISOString().slice(0, 10);

type EventShape = Pick<AppEvent, 'date' | 'endDate' | 'dates'>;

/** Days picked for one occurrence: the separate `dates` of a multiple-day event, else just its start. */
export const eventDays = (event: Pick<AppEvent, 'date' | 'dates'>): string[] =>
  event.dates && event.dates.length > 1 ? [...new Set(event.dates.map(toDay))].sort() : [toDay(event.date)];

/** Number of extra days an occurrence spans (0 for single-day events). */
export const spanDays = (event: EventShape): number => {
  const days = eventDays(event);
  if (days.length > 1) return dayjs(days.at(-1)).diff(dayjs(days[0]), 'day');
  return event.endDate ? Math.max(0, dayjs(event.endDate).diff(dayjs(event.date), 'day')) : 0;
};

// Monday-first order for listing weekdays (dayjs().day() puts Sunday at 0)
const mondayFirst = (day: number) => (day + 6) % 7;

// "a", "a and b", "a, b and c"
const joinList = (items: string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Which week of the month a date falls in: 1–5 ("the 2nd Tuesday"). */
export const nthWeekdayOfMonth = (date: string): number => Math.ceil(dayjs(date).date() / 7);

/** True when the date is the last of its weekday in the month ("the last Friday"). */
export const isLastWeekdayOfMonth = (date: string): boolean =>
  dayjs(date).add(7, 'day').month() !== dayjs(date).month();

/** Days between a date and the last day of its month: 0 on the last day, 1 on the day before it. */
export const daysFromMonthEnd = (date: string): number => dayjs(date).endOf('month').date() - dayjs(date).date();

/** True when the date sits nearer the end of its month than the start — the dates "from month end" suits. */
export const isNearMonthEnd = (date: string): boolean => daysFromMonthEnd(date) < dayjs(date).date() - 1;

const ordinalSuffix = (n: number): string => {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
};

/** "last day", "2nd to last day", "3rd to last day"… for a date's distance from month end. */
export const describeDayFromEnd = (date: string): string => {
  const n = daysFromMonthEnd(date) + 1;
  return n === 1 ? 'last day' : `${n}${ordinalSuffix(n)} to last day`;
};

const isWorkday = (day: Dayjs, calendar: WorkCalendar) =>
  !calendar.weekendDays.includes(day.day()) && !calendar.holidays.has(day.format('YYYY-MM-DD'));

/** Last day of the date's month that is neither a weekend day nor a holiday; null when the month has none. */
export function lastWorkdayOfMonth(date: string, calendar: WorkCalendar = DEFAULT_WORK_CALENDAR): string | null {
  const first = dayjs(toDay(date)).startOf('month');
  for (let day = first.endOf('month').startOf('day'); !day.isBefore(first); day = day.subtract(1, 'day')) {
    if (isWorkday(day, calendar)) return day.format('YYYY-MM-DD');
  }
  return null;
}

// Work-day rules depend on holidays, which rrule can't know about, so they're walked here month by month
const isWorkdayRule = (rule?: RepeatRule) => rule?.freq === 'month' && rule.monthlyBy === 'lastWorkday';

/**
 * Occurrence start dates of a work-day series in order, before `skip` is applied (so skips still count
 * toward `end.count`, as with rrule). The start date only bounds the series: the first occurrence is
 * the first last-work-day on or after it. Stops at the series end or after the month containing `through`.
 */
function* workdaySeries(event: AppEvent, calendar: WorkCalendar, through: string): Generator<string> {
  const rule = event.repeat!;
  const start = toDay(event.date);
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const until = rule.end && 'until' in rule.end ? rule.end.until : null;
  let remaining = rule.end && 'count' in rule.end ? Math.max(1, Math.floor(rule.end.count)) : Infinity;

  const last = dayjs(through).endOf('month');
  for (let month = dayjs(start).startOf('month'); remaining > 0 && !month.isAfter(last); month = month.add(interval, 'month')) {
    const day = lastWorkdayOfMonth(month.format('YYYY-MM-DD'), calendar);
    if (!day || day < start) continue;
    if (until && day > until) return;
    remaining--;
    yield day;
  }
}

function toRRule(date: string, rule: RepeatRule): RRule {
  const start = dayjs(date);
  const options: Partial<Options> = {
    dtstart: toUtcDate(date),
    interval: Math.max(1, Math.floor(rule.interval || 1)),
  };

  switch (rule.freq) {
    case 'day':
      options.freq = RRule.DAILY;
      break;
    case 'week':
      // Only the first picked day drives rrule; the rest follow it (see atOccurrence)
      options.freq = RRule.WEEKLY;
      options.byweekday = [RRULE_WEEKDAYS[start.day()]];
      break;
    case 'month':
      options.freq = RRule.MONTHLY;
      if (rule.monthlyBy === 'nthWeekday') {
        options.byweekday = [RRULE_WEEKDAYS[start.day()].nth(nthWeekdayOfMonth(date))];
      } else if (rule.monthlyBy === 'lastWeekday') {
        options.byweekday = [RRULE_WEEKDAYS[start.day()].nth(-1)];
      } else if (rule.monthlyBy === 'dayFromEnd') {
        // Negative month days count back from the end (-1 = last day), so the date follows month length
        options.bymonthday = [-(daysFromMonthEnd(date) + 1)];
      } else {
        // Months without this day (e.g. the 31st) are skipped, per RFC 5545
        options.bymonthday = [start.date()];
      }
      break;
    case 'year':
      options.freq = RRule.YEARLY;
      options.bymonth = [start.month() + 1];
      options.bymonthday = [start.date()];
      break;
  }

  if (rule.end && 'until' in rule.end) options.until = toUtcDate(rule.end.until);
  if (rule.end && 'count' in rule.end) options.count = Math.max(1, Math.floor(rule.end.count));

  return new RRule(options);
}

/**
 * Start dates of every occurrence that overlaps [from, to] (inclusive), skipped dates excluded.
 * One-off events return their own date when it overlaps. Use this for anything window-based
 * (calendar dots, "what's on this week"). `calendar` only matters for work-day rules.
 */
export function getOccurrences(
  event: AppEvent,
  from: string,
  to: string,
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR,
): string[] {
  const span = spanDays(event);

  if (!event.repeat) {
    const start = toDay(event.date);
    const end = dayjs(start).add(span, 'day').format('YYYY-MM-DD');
    return start <= to && end >= from ? [start] : [];
  }

  // Occurrences starting up to `span` days before the window still reach into it
  const searchFrom = dayjs(from).subtract(span, 'day').format('YYYY-MM-DD');
  const skip = new Set(event.repeat.skip ?? []);

  if (isWorkdayRule(event.repeat)) {
    return [...workdaySeries(event, calendar, to)].filter((d) => d >= searchFrom && d <= to && !skip.has(d));
  }

  return toRRule(event.date, event.repeat)
    .between(toUtcDate(searchFrom), toUtcDate(to), true)
    .map(fromUtcDate)
    .filter((d) => !skip.has(d));
}

/**
 * The first occurrence still running on or after `from` (default: today) — an occurrence that
 * started earlier but hasn't ended yet counts. Null once the series (or one-off event) is over.
 * `calendar` only matters for work-day rules.
 */
export function getNextOccurrence(
  event: AppEvent,
  from: string = dayjs().format('YYYY-MM-DD'),
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR,
): string | null {
  const span = spanDays(event);

  if (!event.repeat) {
    const start = toDay(event.date);
    return dayjs(start).add(span, 'day').format('YYYY-MM-DD') >= from ? start : null;
  }

  if (isWorkdayRule(event.repeat)) {
    const skip = new Set(event.repeat.skip ?? []);
    // Bounded by MAX_SCAN months past `from`, so a calendar with no work days at all can't loop forever
    const through = dayjs(from).add(MAX_SCAN, 'month').format('YYYY-MM-DD');
    for (const day of workdaySeries(event, calendar, through)) {
      if (dayjs(day).add(span, 'day').format('YYYY-MM-DD') >= from && !skip.has(day)) return day;
    }
    return null;
  }

  // Occurrences starting up to `span` days before `from` are still running on it
  const rrule = toRRule(event.date, event.repeat);
  const skip = new Set(event.repeat.skip ?? []);
  let cursor = toUtcDate(dayjs(from).subtract(span, 'day').format('YYYY-MM-DD'));
  let inclusive = true;

  for (let i = 0; i < MAX_SCAN; i++) {
    const hit = rrule.after(cursor, inclusive);
    if (!hit) return null;
    if (!skip.has(fromUtcDate(hit))) return fromUtcDate(hit);
    cursor = hit;
    inclusive = false;
  }
  return null;
}

/**
 * Copy of the event moved to a given occurrence, so date formatters/renderers work unchanged.
 * Ranges keep their length. Multiple-day events keep their spacing: monthly/yearly series keep each
 * day's day-of-month (the 5th and 20th stay the 5th and 20th), shorter ones shift by whole days.
 */
export function atOccurrence(event: AppEvent, occurrence: string): AppEvent {
  const start = toDay(event.date);
  const byMonth = event.repeat?.freq === 'month' || event.repeat?.freq === 'year';
  const months = dayjs(occurrence).diff(dayjs(start), 'month');
  const days = dayjs(occurrence).diff(dayjs(start), 'day');
  const shift = (day: string) =>
    (byMonth ? dayjs(day).add(months, 'month') : dayjs(day).add(days, 'day')).format('YYYY-MM-DD');

  return {
    ...event,
    date: occurrence,
    ...(event.endDate ? { endDate: dayjs(occurrence).add(spanDays(event), 'day').format('YYYY-MM-DD') } : {}),
    ...(event.dates && event.dates.length > 1 ? { dates: eventDays(event).map(shift) } : {}),
  };
}

/**
 * Returns an error message when occurrences of a multi-day event would overlap each other
 * (e.g. a 10-day range repeating weekly), otherwise ''.
 */
export function validateRepeat(event: EventShape, rule: RepeatRule): string {
  const span = spanDays(event);
  if (span === 0) return '';
  if (isWorkdayRule(rule)) return 'Only a single day can repeat on the last work day';

  const starts = toRRule(event.date, { ...rule, end: { count: 50 } }).all();
  for (let i = 1; i < starts.length; i++) {
    const gap = dayjs(fromUtcDate(starts[i])).diff(dayjs(fromUtcDate(starts[i - 1])), 'day');
    if (gap <= span) return 'The event is longer than the time between repeats';
  }
  return '';
}

/**
 * Human-readable summary, e.g. "Every 2 weeks on Tuesday, until Dec 31". `days` are the picked days
 * of the first occurrence (see eventDays) — or just its start date.
 */
export function describeRepeat(days: string | string[], rule: RepeatRule): string {
  const picked = Array.isArray(days) ? days : [days];
  const start = dayjs(picked[0]);
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const unit = FREQ_UNIT[rule.freq];
  let text = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

  if (rule.freq === 'week') {
    const weekdays = [...new Set(picked.map((d) => dayjs(d).day()))].sort((a, b) => mondayFirst(a) - mondayFirst(b));
    const isWorkweek = weekdays.join() === '1,2,3,4,5';
    if (isWorkweek && interval === 1) text = 'Every weekday (Mon–Fri)';
    else text += ` on ${isWorkweek ? 'weekdays' : joinList(weekdays.map((d) => WEEKDAY_NAMES[d]))}`;
  } else if (rule.freq === 'month') {
    const weekday = WEEKDAY_NAMES[start.day()];
    if (rule.monthlyBy === 'nthWeekday') text += ` on the ${ORDINALS[nthWeekdayOfMonth(picked[0]) - 1]} ${weekday}`;
    else if (rule.monthlyBy === 'lastWeekday') text += ` on the last ${weekday}`;
    else if (rule.monthlyBy === 'dayFromEnd') text += ` on the ${describeDayFromEnd(picked[0])}`;
    else if (rule.monthlyBy === 'lastWorkday') text += ' on the last work day';
    else if (picked.length > 1) text += ` on days ${joinList(picked.map((d) => String(dayjs(d).date())))}`;
    else text += start.date() === 1 ? ' on the first day' : ` on day ${start.date()}`;
  } else if (rule.freq === 'year') {
    text += ` on ${joinList(picked.map((d) => dayjs(d).format('MMM D')))}`;
  }

  if (rule.end && 'until' in rule.end) text += `, until ${dayjs(rule.end.until).format('MMM D, YYYY')}`;
  if (rule.end && 'count' in rule.end) text += `, ${rule.end.count} ${rule.end.count === 1 ? 'time' : 'times'}`;

  return text;
}

/**
 * Rule that starts the next occurrence of a range as soon as this one ends — back-to-back sprints.
 * The next one starts on the same weekday when only weekend days lie between (a Mon→Fri sprint restarts
 * on Monday, every 2 weeks); otherwise the day right after the end (every N days). Null for anything
 * but a range. `weekendDays` are dayjs day numbers (0 = Sunday), the app's weekend setting.
 */
export function backToBackRule(event: EventShape, weekendDays: number[] = [0, 6]): RepeatRule | null {
  if (!event.endDate || eventDays(event).length > 1) return null;
  const length = spanDays(event) + 1;
  if (length < 2) return null;

  const weeks = Math.ceil(length / 7);
  const end = dayjs(toDay(event.date)).add(length - 1, 'day');
  const gap = Array.from({ length: weeks * 7 - length }, (_, i) => end.add(i + 1, 'day').day());
  return gap.every((day) => weekendDays.includes(day))
    ? { freq: 'week', interval: weeks }
    : { freq: 'day', interval: length };
}

export interface RepeatPreset {
  title: string;
  value: RepeatRule;
  backToBack?: boolean; // The "When it ends" pick: follows the range if its dates change
}

/**
 * Quick picks for the Repeat dropdown, derived from the chosen date(s). Only rules the event's shape
 * allows are offered — e.g. no "every week" for a 12-day sprint, no "nth weekday" for several days.
 * Month end is offered as the last work day; the calendar's last day (dayFromEnd) often falls on a
 * weekend, so it's left to the form's Custom panel.
 * Ranges get "When it ends" first, replacing the plain preset for the same rule.
 */
export function repeatPresets(event: EventShape, weekendDays?: number[]): RepeatPreset[] {
  const days = eventDays(event);
  const date = days[0];
  const single = days.length === 1;
  const backToBack = backToBackRule(event, weekendDays);
  const presets: RepeatRule[] = [
    { freq: 'day', interval: 1 },
    { freq: 'week', interval: 1 },
    { freq: 'week', interval: 2 },
    ...(single ? [{ freq: 'month', interval: 1, monthlyBy: 'nthWeekday' } as RepeatRule] : []),
    ...(single && isLastWeekdayOfMonth(date)
      ? [{ freq: 'month', interval: 1, monthlyBy: 'lastWeekday' } as RepeatRule]
      : []),
    { freq: 'month', interval: 1, monthlyBy: 'dayOfMonth' },
    // Offered for any single day: the form moves the start to the first last-work-day on or after it
    ...(single ? [{ freq: 'month', interval: 1, monthlyBy: 'lastWorkday' } as RepeatRule] : []),
    { freq: 'year', interval: 1 },
  ];
  return [
    ...(backToBack
      ? [
          {
            title: `When it ends (${lowerFirst(describeRepeat(days, backToBack))})`,
            value: backToBack,
            backToBack: true,
          },
        ]
      : []),
    ...presets
      .filter((value) => !validateRepeat(event, value) && !(backToBack && isSameRule(value, backToBack)))
      .map((value) => ({ title: describeRepeat(days, value), value })),
  ];
}

/** True when two rules produce the same series (ignores skip list), used to match a preset. */
export function isSameRule(a: RepeatRule, b: RepeatRule): boolean {
  const norm = (r: RepeatRule) =>
    JSON.stringify({
      freq: r.freq,
      interval: r.interval,
      monthlyBy: r.freq === 'month' ? (r.monthlyBy ?? 'dayOfMonth') : undefined,
      end: r.end,
    });
  return norm(a) === norm(b);
}
