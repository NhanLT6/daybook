import type { AppEvent } from '@/interfaces/Event';

import { httpClient } from './httpClient';

// Calendarific API response shape (internal, not exported)
interface CalendarificHoliday {
  name: string;
  description?: string;
  date: {
    iso: string;
  };
}

interface CalendarificResponse {
  meta: { code: number };
  response: {
    holidays?: CalendarificHoliday[];
    error?: { code: number; message: string };
  };
}

/**
 * Fetch Vietnam holidays for a given year from Calendarific.
 * Returns holidays mapped to AppEvent format, or [] on any error.
 */
export async function fetchHolidays(year: number = new Date().getFullYear()): Promise<AppEvent[]> {
  try {
    const response = await httpClient.get<CalendarificResponse>('https://calendarific.com/api/v2/holidays', {
      params: {
        api_key: import.meta.env.VITE_CALENDARIFIC_API_KEY,
        country: 'VN',
        year,
      },
    });
    const data = response.data;

    // ID is not provided by Calendarific — derive deterministically from date + name
    return (data.response.holidays ?? []).map((holiday) => ({
      id: `holiday-${holiday.date.iso}-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: holiday.name,
      date: holiday.date.iso,
      type: 'holiday' as const,
      description: holiday.description,
    }));
  } catch (error) {
    console.error('Failed to fetch holidays from Calendarific:', error);
    return [];
  }
}
