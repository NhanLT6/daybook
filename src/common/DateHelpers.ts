import dayjs from 'dayjs';
import type { AppEvent } from '@/interfaces/Event';

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
 */
export function formatEventDate(event: AppEvent): string {
  const start = dayjs(event.date);
  const hasEnd = event.endDate && event.endDate !== event.date;
  const hasTime = event.startTime !== undefined;

  if (!hasEnd && !hasTime) return start.format('MMM D');

  if (hasEnd && !hasTime) return `${start.format('MMM D')} – ${dayjs(event.endDate).format('MMM D')}`;

  if (!hasEnd && hasTime) return `${start.format('MMM D')}, ${event.startTime} – ${event.endTime}`;

  return `${start.format('MMM D')}, ${event.startTime} – ${dayjs(event.endDate).format('MMM D')}, ${event.endTime}`;
}
