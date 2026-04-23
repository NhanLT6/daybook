import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JiraConfig } from '../../src/interfaces/JiraConfig.js'
import type { GeminiConfig, ServerSettings } from '../../src/interfaces/ServerSettings.js'

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

const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}

export async function getSettings(machineId: string): Promise<ServerSettings> {
  const stored = await redis.get<ServerSettings>(settingsKey(machineId))
  return stored ?? {
    geminiConfig: DEFAULT_GEMINI_CONFIG,
    jiraConfig: DEFAULT_JIRA_CONFIG,
  }
}

export async function saveSettings(machineId: string, settings: ServerSettings): Promise<void> {
  await redis.set(settingsKey(machineId), settings)
}
