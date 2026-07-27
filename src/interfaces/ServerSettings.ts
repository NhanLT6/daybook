import type { JiraConfig } from '@/interfaces/JiraConfig'

export interface AiConfig {
  enabled: boolean
  apiKey: string
  model: string
}

export interface ServerSettings {
  aiConfig: AiConfig
  jiraConfig: JiraConfig
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}
