import { kv } from '@vercel/kv'
import type { JiraConfig } from '../../src/interfaces/JiraConfig'
import type { GeminiConfig, ServerSettings } from '../../src/interfaces/ServerSettings'

const settingsKey = (machineId: string) => `settings:${machineId}`

const DEFAULT_JIRA_CONFIG: JiraConfig = {
  enabled: false,
  domain: '',
  email: '',
  apiToken: '',
  projectKey: '',
  statuses: 'To Do;In Progress;In Review;Done;QA',
}

const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}

export async function getSettings(machineId: string): Promise<ServerSettings> {
  const stored = await kv.get<ServerSettings>(settingsKey(machineId))
  return stored ?? {
    geminiConfig: DEFAULT_GEMINI_CONFIG,
    jiraConfig: DEFAULT_JIRA_CONFIG,
  }
}

export async function saveSettings(machineId: string, settings: ServerSettings): Promise<void> {
  await kv.set(settingsKey(machineId), settings)
}
