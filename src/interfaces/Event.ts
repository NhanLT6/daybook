export type RepeatFreq = 'day' | 'week' | 'month' | 'year';

/**
 * How an event repeats. `AppEvent.date`/`endDate`/`dates` describe the FIRST occurrence;
 * every later occurrence copies its shape (range length or picked days) and times. Evaluated by
 * `src/common/eventRecurrence.ts` (rrule under the hood) — never store raw RRULE strings.
 */
export interface RepeatRule {
  freq: RepeatFreq;
  interval: number; // Every N units (>= 1)
  monthlyBy?: 'dayOfMonth' | 'nthWeekday' | 'lastWeekday'; // Monthly only. Undefined = dayOfMonth
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
