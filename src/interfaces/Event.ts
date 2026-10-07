export type RepeatFreq = 'day' | 'week' | 'month' | 'year';

/** Which one of the month's matching days: first to fourth, or the last (-1). */
export type MonthlyNth = 1 | 2 | 3 | 4 | -1;

/** What "the <nth> ___ of the month" counts: any day, a work day, or a weekday (dayjs number, 0 = Sunday). */
export type MonthlyDayKind = 'day' | 'workday' | 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * How an event repeats. `AppEvent.date`/`endDate`/`dates` describe the FIRST occurrence;
 * every later occurrence copies its shape (range length or picked days) and times. Evaluated by
 * `src/common/eventRecurrence.ts` (rrule under the hood) — never store raw RRULE strings.
 */
export interface RepeatRule {
  freq: RepeatFreq;
  interval: number; // Every N units (>= 1)
  // Monthly only: "the <nth> <day>" of each month (the last work day, the second Tuesday), whatever the start
  // date is. Undefined = the start date's day of month.
  monthlyOn?: { nth: MonthlyNth; day: MonthlyDayKind };
  // Single-day events only: an occurrence on a weekend day or holiday is skipped, or moved to the work day
  // before / after. Undefined = kept as is. Never set with a work-day monthlyOn (always on a work day).
  onNonWorkday?: 'skip' | 'before' | 'after';
  end?: { until: string } | { count: number }; // Undefined = never ends. until: YYYY-MM-DD, inclusive
  skip?: string[]; // Occurrence start dates (YYYY-MM-DD) left out of the series
  // Legacy, read only: how monthly rules were saved before monthlyOn. normalizeRule() converts it; never written.
  monthlyBy?: 'dayOfMonth' | 'nthWeekday' | 'lastWeekday' | 'lastWorkday';
}

export interface AppEvent {
  id: string // Holiday: "holiday-{date}-{slug}" | Custom: nanoid()
  title: string // Event name
  date: string // Start date: YYYY-MM-DD. For repeating events: first occurrence
  endDate?: string // End date: YYYY-MM-DD. Undefined = single day
  dates?: string[] // Separate days (YYYY-MM-DD, sorted, first === date) picked in Multiple mode. Excludes endDate
  startTime?: string // Start time: HH:mm. Undefined = all-day event
  endTime?: string // End time: HH:mm. Undefined = all-day event
  type: 'holiday' | 'custom'
  description?: string
  repeat?: RepeatRule // Undefined = one-off event
}

/**
 * Which days count as work days, for rules like "the last work day of the month". Read live from the
 * Settings weekend days and the holiday events (see useWorkCalendar), never stored on the rule, so a
 * series follows newly fetched holidays and weekend changes.
 */
export interface WorkCalendar {
  weekendDays: number[]; // dayjs day numbers (0 = Sunday)
  holidays: ReadonlySet<string>; // YYYY-MM-DD
}
