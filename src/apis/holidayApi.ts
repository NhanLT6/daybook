import type { AppEvent } from '@/interfaces/Event';

import { isAxiosError } from 'axios';

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
 * Returns holidays mapped to AppEvent format.
 * Throws with a descriptive message on API errors (422 with error code/message).
 */
export async function fetchHolidays(year: number = new Date().getFullYear()): Promise<AppEvent[]> {
  let data: CalendarificResponse;

  try {
    const response = await httpClient.get<CalendarificResponse>('https://calendarific.com/api/v2/holidays', {
      params: {
        api_key: import.meta.env.VITE_CALENDARIFIC_API_KEY,
        country: 'VN',
        year,
      },
    });
    data = response.data;
  } catch (error) {
    // Extract Calendarific-specific error message when available
    if (isAxiosError(error) && error.response?.data?.response?.error) {
      const { code, message } = error.response.data.response.error;
      throw new Error(`Calendarific API error ${code}: ${message}`);
    }
    throw error;
  }

  // ID is not provided by Calendarific — derive deterministically from date + name
  return (data.response.holidays ?? []).map((holiday) => ({
    id: `holiday-${holiday.date.iso}-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`,
    title: holiday.name,
    date: holiday.date.iso,
    type: 'holiday' as const,
    description: holiday.description,
  }));
}
