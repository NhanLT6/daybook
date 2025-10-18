// Public Holiday API integration
import { httpClient } from './httpClient';

// Holiday interface based on Nager.Date API
export interface Holiday {
  date: string; // ISO date e.g. "2025-04-30"
  localName: string; // Vietnamese name e.g. "Ngày Giải phóng"
  name: string; // English name e.g. "Reunification Day"
  countryCode: string; // "VN"
  type: string; // "Public"
  // other fields returned by the API are omitted for brevity
}

// Fetch Vietnam public holidays for a given year
export async function fetchVnHolidays(year: number = new Date().getFullYear()): Promise<Holiday[]> {
  const { data } = await httpClient.get<Holiday[]>(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/VN`,
  );
  return data;
}
