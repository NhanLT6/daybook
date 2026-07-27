import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JiraConfig } from '../../src/interfaces/JiraConfig.js'
import type { AiConfig, ServerSettings } from '../../src/interfaces/ServerSettings.js'

// vercel dev doesn't reliably inject .env.development.local into the function
// runtime, so we load it explicitly. dotenv skips vars already in process.env.
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
dotenv.config({ path: resolve(root, '.env.development.local') })
dotenv.config({ path: resolve(root, '.env.local') })

const redis = Redis.fromEnv()

const settingsKey = (machineId: string) => `settings:${machineId}`

const DEFAULT_JIRA_CONFIG: JiraConfig = {
  enabled: false,
  domain: '',
  email: '',
  apiToken: '',
  projectKey: '',
  statuses: 'To Do;In Progress;In Review;Done;QA',
}

const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}

// Stored shape predates the aiConfig rename, so geminiConfig may still be on disk.
interface StoredSettings {
  jiraConfig?: JiraConfig
  aiConfig?: AiConfig
  geminiConfig?: AiConfig
}

export async function getSettings(machineId: string): Promise<ServerSettings> {
  const stored = await redis.get<StoredSettings>(settingsKey(machineId))
  return {
    jiraConfig: stored?.jiraConfig ?? DEFAULT_JIRA_CONFIG,
    aiConfig: stored?.aiConfig ?? stored?.geminiConfig ?? DEFAULT_AI_CONFIG,
  }
}

export async function saveSettings(machineId: string, settings: ServerSettings): Promise<void> {
  await redis.set(settingsKey(machineId), {
    jiraConfig: settings.jiraConfig,
    aiConfig: settings.aiConfig,
  })
}
