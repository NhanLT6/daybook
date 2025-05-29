// src/services/holidays.ts
import axios from 'axios';

export interface Holiday {
  date: string; // ISO date e.g. "2025-04-30"
  localName: string; // Vietnamese name e.g. "Ngày Giải phóng"
  name: string; // English name e.g. "Reunification Day"
  countryCode: string; // "VN"
  type: string; // "Public"
  // other fields returned by the API are omitted for brevity
}

export async function fetchVnHolidays(year: number = new Date().getFullYear()): Promise<Holiday[]> {
  const { data } = await axios.get<Holiday[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/VN`);
  return data;
}
