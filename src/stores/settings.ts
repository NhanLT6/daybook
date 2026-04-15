import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import type { JiraConfig } from '@/interfaces/JiraConfig'
import type { GeminiConfig } from '@/interfaces/ServerSettings'
import { DEFAULT_GEMINI_CONFIG } from '@/interfaces/ServerSettings'

export interface DateFormatOption {
  label: string
  value: string
  example: string
}

export interface FirstDayOfWeekOption {
  label: string
  value: number // 0 = Sunday, 1 = Monday, etc.
}

export interface WeekendPattern {
  label: string
  value: number[] // Array of dayjs day values
  description: string
}

export const dateFormatOptions: DateFormatOption[] = [
  { label: 'MM/DD/YYYY (US)', value: 'MM/DD/YYYY', example: '12/25/2024' },
  { label: 'DD/MM/YYYY (UK)', value: 'DD/MM/YYYY', example: '25/12/2024' },
  { label: 'YYYY/MM/DD (ISO)', value: 'YYYY/MM/DD', example: '2024/12/25' },
  { label: 'DD-MM-YYYY', value: 'DD-MM-YYYY', example: '25-12-2024' },
  { label: 'MM-DD-YYYY', value: 'MM-DD-YYYY', example: '12-25-2024' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD', example: '2024-12-25' },
]

export const firstDayOfWeekOptions: FirstDayOfWeekOption[] = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]

export const weekendPatterns: WeekendPattern[] = [
  { label: 'Saturday & Sunday', value: [6, 0], description: 'Western standard (Sat-Sun)' },
  { label: 'Friday & Saturday', value: [5, 6], description: 'Middle East/North Africa' },
  { label: 'Friday, Saturday & Sunday', value: [5, 6, 0], description: 'Extended weekend' },
  { label: 'Saturday only', value: [6], description: 'Single day weekend' },
  { label: 'Sunday only', value: [0], description: 'Single day weekend' },
  { label: 'No weekend', value: [], description: 'No designated weekend days' },
]

const DEFAULT_JIRA_CONFIG: JiraConfig = {
  enabled: false,
  domain: '',
  email: '',
  apiToken: '',
  projectKey: '',
  statuses: 'To Do;In Progress;In Review;Done;QA',
}

export const useSettingsStore = defineStore('settings', () => {
  // ── Local preferences (stay in localStorage) ─────────────────────────
  // Date display format (for UI display only, not import/export)
  const dateDisplayFormat = useStorage('dateDisplayFormat', 'MM/DD/YYYY')

  // First day of week for calendar (0 = Sunday, 1 = Monday, etc.)
  // v-calendar uses 1-7 where 1=Sunday, so we need to convert
  const firstDayOfWeek = useStorage('firstDayOfWeek', 1) // Default Monday

  // Weekend days configuration (dayjs day values: 0=Sunday, 1=Monday, etc.)
  const weekendDays = useStorage('weekendDays', [5, 6, 0]) // Default Fri, Sat, Sun

  const useDefaultTasks = useStorage('useDefaultTasks', true)

  const useCategories = useStorage('useCategories', false)

  // ── Server-managed credentials (populated via populateFromServer) ────
  // These are plain refs — not persisted in localStorage
  const jiraConfig = ref<JiraConfig>({ ...DEFAULT_JIRA_CONFIG })
  const geminiConfig = ref<GeminiConfig>({ ...DEFAULT_GEMINI_CONFIG })

  /**
   * Called from App.vue after /api/settings is fetched.
   * Replaces the in-memory jiraConfig and geminiConfig with server values.
   */
  function populateFromServer(serverJira: JiraConfig, serverGemini: GeminiConfig) {
    jiraConfig.value = serverJira
    geminiConfig.value = serverGemini
  }

  // ── Computed ──────────────────────────────────────────────────────────
  // Convert our 0-6 value to v-calendar's 1-7 format
  const vCalendarFirstDay = computed(() =>
    firstDayOfWeek.value === 0 ? 1 : firstDayOfWeek.value + 1,
  )

  // Convert dayjs weekend days (0-6) to v-calendar format (1-7)
  const vCalendarWeekendDays = computed(() =>
    weekendDays.value.map((day) => (day === 0 ? 1 : day + 1)),
  )

  return {
    dateDisplayFormat,
    firstDayOfWeek,
    weekendDays,
    useDefaultTasks,
    useCategories,
    jiraConfig,
    geminiConfig,
    populateFromServer,
    vCalendarFirstDay,
    vCalendarWeekendDays,
    dateFormatOptions,
    firstDayOfWeekOptions,
    weekendPatterns,
  }
})
