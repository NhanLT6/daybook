export type RepeatFreq = 'day' | 'week' | 'month' | 'year';

/**
 * How an event repeats. `AppEvent.date`/`endDate`/`dates` describe the FIRST occurrence;
 * every later occurrence copies its shape (range length or picked days) and times. Evaluated by
 * `src/common/eventRecurrence.ts` (rrule under the hood) — never store raw RRULE strings.
 */
export interface RepeatRule {
  freq: RepeatFreq;
  interval: number; // Every N units (>= 1)
  // Monthly only. Undefined = dayOfMonth. dayFromEnd keeps the start date's distance from month end (0 = last day).
  // lastWorkday = the month's last day that is neither a weekend day nor a holiday (see WorkCalendar)
  monthlyBy?: 'dayOfMonth' | 'nthWeekday' | 'lastWeekday' | 'dayFromEnd' | 'lastWorkday';
  end?: { until: string } | { count: number }; // Undefined = never ends. until: YYYY-MM-DD, inclusive
  skip?: string[]; // Occurrence start dates (YYYY-MM-DD) left out of the series
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
