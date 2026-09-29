import dayjs from 'dayjs';
import { round, sum } from 'lodash';
import type { AppEvent } from '@/interfaces/Event';

/**
 * Sum per-log durations (minutes) into hours, rounded to 1 decimal.
 * Rounds ONCE after summing: rounding each log's hours individually first
 * accumulates per-log drift and inflates the displayed total (e.g. 7h55m → 8.1h).
 */
export const sumMinutesToHours = (minutes: number[]): number => round(sum(minutes) / 60, 1);

export const minutesToHourWithMinutes = (minutes: number): string => {
  if (minutes === 0) return '0m';

  const time = dayjs.duration({ minutes: Math.round(minutes) });
  const hours = Math.floor(time.asHours());
  const remainingMinutes = dayjs
    .duration({ hours: time.asHours() - hours })
    .asMinutes()
    .toFixed(0);

  if (hours === 0) return `${remainingMinutes}m`;

  if (remainingMinutes === '0') return `${hours}h`;

  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Format an event's date/time for display in EventList.
 * Single day all-day:   "Jan 29"
 * Range all-day:        "Jan 29 – Feb 1"
 * Single day timed:     "Jan 29, 09:00 – 11:30"
 * Multi-day timed:      "Jan 29, 09:00 – Feb 1, 17:00"
 * Separate days:        "Jan 29, 30, Feb 2" (+ ", 09:00 – 11:30" when timed)
 */
export function formatEventDate(event: AppEvent): string {
  if (event.dates && event.dates.length > 1) {
    return formatDayList(event.dates, event.startTime ? `${event.startTime} – ${event.endTime}` : undefined);
  }

  const start = dayjs(event.date);
  const hasEnd = event.endDate && event.endDate !== event.date;
  const hasTime = event.startTime !== undefined;

  if (!hasEnd && !hasTime) return start.format('MMM D');

  if (hasEnd && !hasTime) return `${start.format('MMM D')} – ${dayjs(event.endDate).format('MMM D')}`;

  if (!hasEnd && hasTime) return `${start.format('MMM D')}, ${event.startTime} – ${event.endTime}`;

  return `${start.format('MMM D')}, ${event.startTime} – ${dayjs(event.endDate).format('MMM D')}, ${event.endTime}`;
}

// "Jan 29, 30, Feb 2" — the month is only repeated when it changes
function formatDayList(dates: string[], time?: string): string {
  const days = [...dates].sort();
  const text = days
    .map((d, i) => (i > 0 && dayjs(d).isSame(days[i - 1], 'month') ? dayjs(d).format('D') : dayjs(d).format('MMM D')))
    .join(', ');
  return time ? `${text}, ${time}` : text;
}
