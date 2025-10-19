import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import type { JiraConfig } from '@/interfaces/JiraConfig';

export interface DateFormatOption {
  label: string;
  value: string;
  example: string;
}

export interface FirstDayOfWeekOption {
  label: string;
  value: number; // 0 = Sunday, 1 = Monday, etc.
}

export interface WeekendPattern {
  label: string;
  value: number[]; // Array of dayjs day values
  description: string;
}

export const dateFormatOptions: DateFormatOption[] = [
  { label: 'MM/DD/YYYY (US)', value: 'MM/DD/YYYY', example: '12/25/2024' },
  { label: 'DD/MM/YYYY (UK)', value: 'DD/MM/YYYY', example: '25/12/2024' },
  { label: 'YYYY/MM/DD (ISO)', value: 'YYYY/MM/DD', example: '2024/12/25' },
  { label: 'DD-MM-YYYY', value: 'DD-MM-YYYY', example: '25-12-2024' },
  { label: 'MM-DD-YYYY', value: 'MM-DD-YYYY', example: '12-25-2024' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD', example: '2024-12-25' },
];

export const firstDayOfWeekOptions: FirstDayOfWeekOption[] = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

export const weekendPatterns: WeekendPattern[] = [
  { label: 'Saturday & Sunday', value: [6, 0], description: 'Western standard (Sat-Sun)' },
  { label: 'Friday & Saturday', value: [5, 6], description: 'Middle East/North Africa' },
  { label: 'Friday, Saturday & Sunday', value: [5, 6, 0], description: 'Extended weekend' },
  { label: 'Saturday only', value: [6], description: 'Single day weekend' },
  { label: 'Sunday only', value: [0], description: 'Single day weekend' },
  { label: 'No weekend', value: [], description: 'No designated weekend days' },
];

export const useSettingsStore = defineStore('settings', () => {
  // Date display format (for UI display only, not import/export)
  const dateDisplayFormat = useStorage('dateDisplayFormat', 'MM/DD/YYYY');

  // First day of week for calendar (0 = Sunday, 1 = Monday, etc.)
  // v-calendar uses 1-7 where 1=Sunday, so we need to convert
  const firstDayOfWeek = useStorage('firstDayOfWeek', 1); // Default Monday

  // Weekend days configuration (dayjs day values: 0=Sunday, 1=Monday, etc.)
  const weekendDays = useStorage('weekendDays', [5, 6, 0]); // Default Fri, Sat, Sun

  // Use default tasks setting
  const useDefaultTasks = useStorage('useDefaultTasks', true);

  // Jira integration configuration
  const jiraConfig = useStorage<JiraConfig>('jiraConfig', {
    enabled: false,
    domain: '',
    email: '',
    apiToken: '',
    projectKey: '',
    statuses: 'To Do;In Progress;In Review;Done;QA', // Default statuses separated by semicolon
  });

  // Convert our 0-6 value to v-calendar's 1-7 format
  const vCalendarFirstDay = computed(() => {
    return firstDayOfWeek.value === 0 ? 1 : firstDayOfWeek.value + 1;
  });

  // Convert dayjs weekend days (0-6) to v-calendar format (1-7)
  const vCalendarWeekendDays = computed(() => {
    return weekendDays.value.map(day => day === 0 ? 1 : day + 1);
  });

  return {
    dateDisplayFormat,
    firstDayOfWeek,
    weekendDays,
    useDefaultTasks,
    jiraConfig,
    vCalendarFirstDay,
    vCalendarWeekendDays,
    dateFormatOptions,
    firstDayOfWeekOptions,
    weekendPatterns,
  };
});