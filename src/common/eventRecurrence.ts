import dayjs from 'dayjs';
import { RRule, type Options, type Weekday } from 'rrule';

import type { AppEvent, RepeatRule } from '@/interfaces/Event';

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

const toUtcDate = (date: string): Date => new Date(`${date}T00:00:00Z`);
const fromUtcDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Number of extra days an occurrence spans (0 for single-day events). */
export const spanDays = (event: Pick<AppEvent, 'date' | 'endDate'>): number =>
  event.endDate ? Math.max(0, dayjs(event.endDate).diff(dayjs(event.date), 'day')) : 0;

/** Which week of the month a date falls in: 1–5 ("the 2nd Tuesday"). */
export const nthWeekdayOfMonth = (date: string): number => Math.ceil(dayjs(date).date() / 7);

/** True when the date is the last of its weekday in the month ("the last Friday"). */
export const isLastWeekdayOfMonth = (date: string): boolean =>
  dayjs(date).add(7, 'day').month() !== dayjs(date).month();

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
      options.freq = RRule.WEEKLY;
      options.byweekday = (rule.weekdays?.length ? rule.weekdays : [start.day()]).map((d) => RRULE_WEEKDAYS[d]);
      break;
    case 'month':
      options.freq = RRule.MONTHLY;
      if (rule.monthlyBy === 'nthWeekday') {
        options.byweekday = [RRULE_WEEKDAYS[start.day()].nth(nthWeekdayOfMonth(date))];
      } else if (rule.monthlyBy === 'lastWeekday') {
        options.byweekday = [RRULE_WEEKDAYS[start.day()].nth(-1)];
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
 * (calendar dots, "what's on this week").
 */
export function getOccurrences(event: AppEvent, from: string, to: string): string[] {
  const span = spanDays(event);

  if (!event.repeat) {
    const end = dayjs(event.date).add(span, 'day').format('YYYY-MM-DD');
    return event.date <= to && end >= from ? [event.date] : [];
  }

  // Occurrences starting up to `span` days before the window still reach into it
  const searchFrom = dayjs(from).subtract(span, 'day').format('YYYY-MM-DD');
  const skip = new Set(event.repeat.skip ?? []);

  return toRRule(event.date, event.repeat)
    .between(toUtcDate(searchFrom), toUtcDate(to), true)
    .map(fromUtcDate)
    .filter((d) => !skip.has(d));
}

/**
 * The first occurrence still running on or after `from` (default: today) — an occurrence that
 * started earlier but hasn't ended yet counts. Null once the series (or one-off event) is over.
 */
export function getNextOccurrence(event: AppEvent, from: string = dayjs().format('YYYY-MM-DD')): string | null {
  const span = spanDays(event);

  if (!event.repeat) return dayjs(event.date).add(span, 'day').format('YYYY-MM-DD') >= from ? event.date : null;

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

/** Copy of the event moved to a given occurrence, so date formatters/renderers work unchanged. */
export function atOccurrence(event: AppEvent, occurrence: string): AppEvent {
  const span = spanDays(event);
  return {
    ...event,
    date: occurrence,
    ...(event.endDate ? { endDate: dayjs(occurrence).add(span, 'day').format('YYYY-MM-DD') } : {}),
  };
}

/**
 * Returns an error message when occurrences of a multi-day event would overlap each other
 * (e.g. a 10-day range repeating weekly), otherwise ''.
 */
export function validateRepeat(event: Pick<AppEvent, 'date' | 'endDate'>, rule: RepeatRule): string {
  const span = spanDays(event);
  if (span === 0) return '';

  const starts = toRRule(event.date, { ...rule, end: { count: 50 } }).all();
  for (let i = 1; i < starts.length; i++) {
    const gap = dayjs(fromUtcDate(starts[i])).diff(dayjs(fromUtcDate(starts[i - 1])), 'day');
    if (gap <= span) return 'The event is longer than the time between repeats';
  }
  return '';
}

/** Human-readable summary, e.g. "Every 2 weeks on Tuesday, until Dec 31". */
export function describeRepeat(date: string, rule: RepeatRule): string {
  const start = dayjs(date);
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const unit = FREQ_UNIT[rule.freq];
  let text = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

  if (rule.freq === 'week') {
    const days = [...(rule.weekdays?.length ? rule.weekdays : [start.day()])].sort((a, b) => a - b);
    const isWorkweek = days.join() === '1,2,3,4,5';
    if (isWorkweek && interval === 1) text = 'Every weekday (Mon–Fri)';
    else text += ` on ${isWorkweek ? 'weekdays' : days.map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
  } else if (rule.freq === 'month') {
    const weekday = WEEKDAY_NAMES[start.day()];
    if (rule.monthlyBy === 'nthWeekday') text += ` on the ${ORDINALS[nthWeekdayOfMonth(date) - 1]} ${weekday}`;
    else if (rule.monthlyBy === 'lastWeekday') text += ` on the last ${weekday}`;
    else text += ` on day ${start.date()}`;
  } else if (rule.freq === 'year') {
    text += ` on ${start.format('MMM D')}`;
  }

  if (rule.end && 'until' in rule.end) text += `, until ${dayjs(rule.end.until).format('MMM D, YYYY')}`;
  if (rule.end && 'count' in rule.end) text += `, ${rule.end.count} ${rule.end.count === 1 ? 'time' : 'times'}`;

  return text;
}

/** Quick picks for the Repeat dropdown, derived from the chosen start date. */
export function repeatPresets(date: string): { title: string; value: RepeatRule }[] {
  const presets: RepeatRule[] = [
    { freq: 'day', interval: 1 },
    { freq: 'week', interval: 1 },
    { freq: 'week', interval: 2 },
    { freq: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5] },
    { freq: 'month', interval: 1, monthlyBy: 'nthWeekday' },
    ...(isLastWeekdayOfMonth(date) ? [{ freq: 'month', interval: 1, monthlyBy: 'lastWeekday' } as RepeatRule] : []),
    { freq: 'month', interval: 1, monthlyBy: 'dayOfMonth' },
    { freq: 'year', interval: 1 },
  ];
  return presets.map((value) => ({ title: describeRepeat(date, value), value }));
}

/** True when two rules produce the same series (ignores skip list), used to match a preset. */
export function isSameRule(a: RepeatRule, b: RepeatRule): boolean {
  const norm = (r: RepeatRule) =>
    JSON.stringify({
      freq: r.freq,
      interval: r.interval,
      weekdays: r.freq === 'week' && r.weekdays?.length ? [...r.weekdays].sort() : undefined,
      monthlyBy: r.freq === 'month' ? (r.monthlyBy ?? 'dayOfMonth') : undefined,
      end: r.end,
    });
  return norm(a) === norm(b);
}
