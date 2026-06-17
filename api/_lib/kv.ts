import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JiraConfig } from '../../src/interfaces/JiraConfig.js'

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

// Stored shape may include legacy geminiConfig from before env-var migration — ignore it.
interface StoredSettings {
  jiraConfig?: JiraConfig
}

export async function getJiraConfig(machineId: string): Promise<JiraConfig> {
  const stored = await redis.get<StoredSettings>(settingsKey(machineId))
  return stored?.jiraConfig ?? DEFAULT_JIRA_CONFIG
}

export async function saveJiraConfig(machineId: string, jiraConfig: JiraConfig): Promise<void> {
  await redis.set(settingsKey(machineId), { jiraConfig })
}
