import type { AppEvent } from '@/interfaces/Event';

import { httpClient } from './httpClient';

// Calendarific API response shape (internal, not exported)
interface CalendarificDate {
  iso: string;
}

interface CalendarificHoliday {
  id: string;
  name: string;
  description?: string;
  date: CalendarificDate;
}

interface CalendarificResponse {
  holidays: CalendarificHoliday[];
}

/**
 * Fetch Vietnam holidays for a given year from Calendarific.
 * Returns holidays mapped to AppEvent format.
 */
export async function fetchHolidays(year: number = new Date().getFullYear()): Promise<AppEvent[]> {
  const { data } = await httpClient.get<CalendarificResponse>('https://api.calendarific.com/api/v1/holidays', {
    params: {
      api_key: import.meta.env.VITE_CALENDARIFIC_API_KEY,
      country: 'VN',
      year,
    },
  });

  return data.holidays.map((holiday) => ({
    id: `holiday-${holiday.date.iso}-${holiday.id}`,
    title: holiday.name,
    date: holiday.date.iso,
    type: 'holiday' as const,
    description: holiday.description,
  }));
}
