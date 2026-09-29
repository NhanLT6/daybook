export type RepeatFreq = 'day' | 'week' | 'month' | 'year';

/**
 * How an event repeats. `AppEvent.date`/`endDate` describe the FIRST occurrence;
 * every later occurrence copies its length and times. Evaluated by
 * `src/common/eventRecurrence.ts` (rrule under the hood) — never store raw RRULE strings.
 */
export interface RepeatRule {
  freq: RepeatFreq;
  interval: number; // Every N units (>= 1)
  weekdays?: number[]; // Weekly only: 0 = Sun … 6 = Sat (dayjs().day()). Undefined = start date's weekday
  monthlyBy?: 'dayOfMonth' | 'nthWeekday' | 'lastWeekday'; // Monthly only. Undefined = dayOfMonth
  end?: { until: string } | { count: number }; // Undefined = never ends. until: YYYY-MM-DD, inclusive
  skip?: string[]; // Occurrence start dates (YYYY-MM-DD) left out of the series
}

export interface AppEvent {
  id: string // Holiday: "holiday-{date}-{slug}" | Custom: nanoid()
  title: string // Event name
  date: string // Start date: YYYY-MM-DD. For repeating events: first occurrence
  endDate?: string // End date: YYYY-MM-DD. Undefined = single day
  startTime?: string // Start time: HH:mm. Undefined = all-day event
  endTime?: string // End time: HH:mm. Undefined = all-day event
  type: 'holiday' | 'custom'
  description?: string
  repeat?: RepeatRule // Undefined = one-off event
}
