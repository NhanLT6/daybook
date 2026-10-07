import dayjs, { type Dayjs } from 'dayjs';

import { RRule, type Options, type Weekday } from 'rrule';

import type { AppEvent, MonthlyDayKind, MonthlyNth, RepeatRule, WorkCalendar } from '@/interfaces/Event';

/**
 * Repeating events: our stored `RepeatRule` is a friendly, typed layer; rrule only does the date math.
 *
 * Dates are YYYY-MM-DD strings everywhere. rrule works on JS Dates and recommends "floating" UTC
 * dates, so each string is mapped to UTC midnight and read back with toISOString() — this keeps
 * results independent of the viewer's timezone. Times (HH:mm) never enter rrule; every occurrence
 * reuses the event's startTime/endTime.
 *
 * Work days (weekend days + holidays, see WorkCalendar) are something rrule can't know about, so two
 * features run on our side of it: "the nth work day" monthly rules are walked month by month
 * (workdayStarts), and `onNonWorkday` skips or moves the occurrences rrule produces (shiftOffDay).
 */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NTH_NAMES: Record<MonthlyNth, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' };
const FREQ_UNIT: Record<RepeatRule['freq'], string> = { day: 'day', week: 'week', month: 'month', year: 'year' };

// rrule weekdays start on Monday (MO = 0); dayjs().day() starts on Sunday (0)
const RRULE_WEEKDAYS: Weekday[] = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

// How far an occurrence may move to reach a work day — longer runs of days off (Tet) still fit
const MAX_SHIFT = 31;

// How far ahead getNextOccurrence looks, one year at a time, before calling a series over
const MAX_YEARS = 50;

// Used when a caller has no work calendar at hand (tests, validation): Sat–Sun weekend, no holidays
const DEFAULT_WORK_CALENDAR: WorkCalendar = { weekendDays: [0, 6], holidays: new Set() };

// Events created through the date picker before dates were normalized hold a JS Date at runtime
// despite the `string` type — funnel every read through toDay so both shapes work.
const toDay = (date: string | Date): string => dayjs(date).format('YYYY-MM-DD');

const toUtcDate = (date: string): Date => new Date(`${toDay(date)}T00:00:00Z`);
const fromUtcDate = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: string, days: number): string => dayjs(date).add(days, 'day').format('YYYY-MM-DD');

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

/**
 * The rule in its current shape: converts a legacy `monthlyBy` (saved before `monthlyOn` existed) using the
 * series' start date, which those rules took their weekday and position from. A 5th weekday becomes the last.
 */
export function normalizeRule(rule: RepeatRule, date: string): RepeatRule {
  const { monthlyBy, ...rest } = rule;
  if (rule.freq !== 'month' || rest.monthlyOn || !monthlyBy || monthlyBy === 'dayOfMonth') return rest;
  const weekday = dayjs(toDay(date)).day() as MonthlyDayKind;
  const nth = nthWeekdayOfMonth(toDay(date));
  const monthlyOn: RepeatRule['monthlyOn'] =
    monthlyBy === 'lastWorkday'
      ? { nth: -1, day: 'workday' }
      : { nth: monthlyBy === 'lastWeekday' || nth > 4 ? -1 : (nth as MonthlyNth), day: weekday };
  return { ...rest, monthlyOn };
}

const isWorkday = (day: Dayjs, calendar: WorkCalendar) =>
  !calendar.weekendDays.includes(day.day()) && !calendar.holidays.has(day.format('YYYY-MM-DD'));

/** The nth (or last, -1) work day of the date's month; null when the month has fewer work days. */
export function nthWorkdayOfMonth(
  date: string,
  nth: MonthlyNth,
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR,
): string | null {
  const first = dayjs(toDay(date)).startOf('month');
  const workdays = Array.from({ length: first.daysInMonth() }, (_, i) => first.add(i, 'day')).filter((day) =>
    isWorkday(day, calendar),
  );
  const day = nth === -1 ? workdays.at(-1) : workdays[nth - 1];
  return day ? day.format('YYYY-MM-DD') : null;
}

const isWorkdayPosition = (rule: RepeatRule) => rule.freq === 'month' && rule.monthlyOn?.day === 'workday';

/**
 * Starts of a "the nth work day" series within [from, to], walked month by month. The start date only
 * bounds the series: the first occurrence is the first match on or after it. `end.count` counts from the
 * series start, like rrule does.
 */
function workdayStarts(date: string, rule: RepeatRule, calendar: WorkCalendar, from: string, to: string): string[] {
  const start = toDay(date);
  const nth = rule.monthlyOn!.nth;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const until = rule.end && 'until' in rule.end ? rule.end.until : null;
  let remaining = rule.end && 'count' in rule.end ? Math.max(1, Math.floor(rule.end.count)) : Infinity;

  const starts: string[] = [];
  const last = dayjs(to).endOf('month');
  for (let month = dayjs(start).startOf('month'); remaining > 0 && !month.isAfter(last); month = month.add(interval, 'month')) {
    const day = nthWorkdayOfMonth(month.format('YYYY-MM-DD'), nth, calendar);
    if (!day || day < start) continue;
    if (until && day > until) break;
    remaining--;
    if (day >= from && day <= to) starts.push(day);
  }
  return starts;
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
    case 'month': {
      options.freq = RRule.MONTHLY;
      const on = rule.monthlyOn;
      if (on?.day === 'day') {
        // Negative month days count back from the end (-1 = last day), so it follows month length
        options.bymonthday = [on.nth];
      } else if (on && on.day !== 'workday') {
        options.byweekday = [RRULE_WEEKDAYS[on.day].nth(on.nth)];
      } else {
        // Months without this day (e.g. the 31st) are skipped, per RFC 5545. Work days never get here.
        options.bymonthday = [start.date()];
      }
      break;
    }
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

/** Series starts within [from, to], before work-day adjustment and skips. */
function rawStarts(date: string, rule: RepeatRule, from: string, to: string, calendar: WorkCalendar): string[] {
  if (isWorkdayPosition(rule)) return workdayStarts(date, rule, calendar, from, to);
  return toRRule(toDay(date), rule)
    .between(toUtcDate(from), toUtcDate(to), true)
    .map(fromUtcDate);
}

// onNonWorkday only applies to single-day events: there's no sensible move for a range or a set of days
const nonWorkdayMode = (event: EventShape, rule: RepeatRule) =>
  rule.onNonWorkday && spanDays(event) === 0 && !isWorkdayPosition(rule) ? rule.onNonWorkday : undefined;

/** The day itself when it's a work day; else null to skip it, or the nearest work day before / after. */
function shiftOffDay(day: string, mode: NonNullable<RepeatRule['onNonWorkday']>, calendar: WorkCalendar) {
  let current = dayjs(day);
  if (isWorkday(current, calendar)) return day;
  if (mode === 'skip') return null;
  for (let i = 0; i < MAX_SHIFT; i++) {
    current = current.add(mode === 'before' ? -1 : 1, 'day');
    if (isWorkday(current, calendar)) return current.format('YYYY-MM-DD');
  }
  return null;
}

/**
 * Occurrence starts overlapping [from, to] for a repeating event, after work-day adjustment and skips.
 * Moving to a nearby work day keeps the order, so the result stays sorted.
 */
function occurrencesIn(event: AppEvent, rule: RepeatRule, from: string, to: string, calendar: WorkCalendar) {
  const span = spanDays(event);
  const mode = nonWorkdayMode(event, rule);
  // Occurrences starting up to `span` days before the window still reach into it; moved ones may come from
  // up to MAX_SHIFT days outside it
  const pad = mode && mode !== 'skip' ? MAX_SHIFT : 0;
  let starts = rawStarts(event.date, rule, addDays(from, -span - pad), addDays(to, pad), calendar);
  if (mode) starts = [...new Set(starts.map((d) => shiftOffDay(d, mode, calendar)).filter((d) => d !== null))];

  const skip = new Set(rule.skip ?? []);
  return starts.filter((d) => d >= addDays(from, -span) && d <= to && !skip.has(d));
}

/**
 * Start dates of every occurrence that overlaps [from, to] (inclusive), skipped dates excluded.
 * One-off events return their own date when it overlaps. Use this for anything window-based
 * (calendar dots, "what's on this week"). `calendar` matters for work-day rules and onNonWorkday.
 */
export function getOccurrences(
  event: AppEvent,
  from: string,
  to: string,
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR,
): string[] {
  if (!event.repeat) {
    const start = toDay(event.date);
    return start <= to && addDays(start, spanDays(event)) >= from ? [start] : [];
  }
  return occurrencesIn(event, normalizeRule(event.repeat, event.date), from, to, calendar);
}

/**
 * The first occurrence still running on or after `from` (default: today) — an occurrence that
 * started earlier but hasn't ended yet counts. Null once the series (or one-off event) is over.
 * `calendar` matters for work-day rules and onNonWorkday.
 */
export function getNextOccurrence(
  event: AppEvent,
  from: string = dayjs().format('YYYY-MM-DD'),
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR,
): string | null {
  if (!event.repeat) {
    const start = toDay(event.date);
    return addDays(start, spanDays(event)) >= from ? start : null;
  }

  const rule = normalizeRule(event.repeat, event.date);
  const limit = dayjs(from).add(MAX_YEARS, 'year').format('YYYY-MM-DD');
  // A series with an end stops being searched past its last start (+ the furthest a move can take it)
  let endBound: string | null = null;
  if (rule.end && 'until' in rule.end) endBound = rule.end.until;
  if (rule.end && 'count' in rule.end) {
    endBound = rawStarts(event.date, rule, toDay(event.date), limit, calendar).at(-1) ?? null;
    if (!endBound) return null;
  }
  if (endBound) endBound = addDays(endBound, MAX_SHIFT);

  // One year at a time: most series hit in the first window, and a never-ending one stays cheap
  for (let chunkFrom = from; chunkFrom <= limit; chunkFrom = addDays(chunkFrom, 366)) {
    const chunkTo = addDays(chunkFrom, 365);
    const hit = occurrencesIn(event, rule, chunkFrom, chunkTo, calendar)[0];
    if (hit) return hit;
    if (endBound !== null && chunkTo >= endBound) return null;
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

  const date = toDay(event.date);
  const normalized = { ...normalizeRule(rule, date), end: { count: 50 } };
  const starts = rawStarts(date, normalized, date, dayjs(date).add(MAX_YEARS, 'year').format('YYYY-MM-DD'), DEFAULT_WORK_CALENDAR);
  for (let i = 1; i < starts.length; i++) {
    if (dayjs(starts[i]).diff(dayjs(starts[i - 1]), 'day') <= span) return 'The event is longer than the time between repeats';
  }
  return '';
}

/** "work day", "Tuesday", "day" — the kind of day a monthly position counts. */
export const describeDayKind = (day: MonthlyDayKind): string =>
  day === 'day' ? 'day' : day === 'workday' ? 'work day' : WEEKDAY_NAMES[day];

/** "first", "second", … "last". */
export const describeNth = (nth: MonthlyNth): string => NTH_NAMES[nth];

const NON_WORKDAY_TEXT: Record<NonNullable<RepeatRule['onNonWorkday']>, string> = {
  skip: ', skipping days off',
  before: ', or the work day before if off',
  after: ', or the work day after if off',
};

/**
 * Human-readable summary, e.g. "Every 2 weeks on Tuesday, until Dec 31". `days` are the picked days
 * of the first occurrence (see eventDays) — or just its start date.
 */
export function describeRepeat(days: string | string[], repeat: RepeatRule): string {
  const picked = Array.isArray(days) ? days : [days];
  const rule = normalizeRule(repeat, picked[0]);
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
    if (rule.monthlyOn) text += ` on the ${describeNth(rule.monthlyOn.nth)} ${describeDayKind(rule.monthlyOn.day)}`;
    else if (picked.length > 1) text += ` on days ${joinList(picked.map((d) => String(dayjs(d).date())))}`;
    else text += start.date() === 1 ? ' on the first day' : ` on day ${start.date()}`;
  } else if (rule.freq === 'year') {
    text += ` on ${joinList(picked.map((d) => dayjs(d).format('MMM D')))}`;
  }

  const mode = nonWorkdayMode({ date: picked[0], dates: picked }, rule);
  if (mode) text += NON_WORKDAY_TEXT[mode];

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
 * The last work day is offered for any single day (the form moves the start onto it).
 * Ranges get "When it ends" first, replacing the plain preset for the same rule.
 */
export function repeatPresets(event: EventShape, weekendDays?: number[]): RepeatPreset[] {
  const days = eventDays(event);
  const date = days[0];
  const single = days.length === 1;
  const weekday = dayjs(date).day() as MonthlyDayKind;
  const nth = nthWeekdayOfMonth(date);
  const backToBack = backToBackRule(event, weekendDays);
  const monthlyOn = (on: RepeatRule['monthlyOn']): RepeatRule => ({ freq: 'month', interval: 1, monthlyOn: on });
  const presets: RepeatRule[] = [
    { freq: 'day', interval: 1 },
    { freq: 'week', interval: 1 },
    { freq: 'week', interval: 2 },
    // A 5th weekday is always the last one, which the next preset covers
    ...(single && nth <= 4 ? [monthlyOn({ nth: nth as MonthlyNth, day: weekday })] : []),
    ...(single && isLastWeekdayOfMonth(date) ? [monthlyOn({ nth: -1, day: weekday })] : []),
    { freq: 'month', interval: 1 },
    ...(single && !event.endDate ? [monthlyOn({ nth: -1, day: 'workday' })] : []),
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

/**
 * True when two rules produce the same series (ignores skip list), used to match a preset. Both must be
 * normalized (normalizeRule), as the form's rules are.
 */
export function isSameRule(a: RepeatRule, b: RepeatRule): boolean {
  const norm = (r: RepeatRule) =>
    JSON.stringify({
      freq: r.freq,
      interval: r.interval,
      monthlyOn: r.freq === 'month' && r.monthlyOn ? `${r.monthlyOn.nth}:${r.monthlyOn.day}` : null,
      onNonWorkday: r.onNonWorkday ?? null,
      end: r.end,
    });
  return norm(a) === norm(b);
}
