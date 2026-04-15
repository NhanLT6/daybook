import type { JiraConfig } from '@/interfaces/JiraConfig'

export interface GeminiConfig {
  enabled: boolean
  apiKey: string
  model: string
}

export interface ServerSettings {
  geminiConfig: GeminiConfig
  jiraConfig: JiraConfig
}

export const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}
