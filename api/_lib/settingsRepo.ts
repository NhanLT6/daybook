import { neon } from '@neondatabase/serverless'

import type { JiraConfig } from '../../src/interfaces/JiraConfig.js'
import type { AiConfig, ServerSettings } from '../../src/interfaces/ServerSettings.js'
import { neonConnectionString } from './env.js'

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

const sql = () => neon(neonConnectionString())

interface SettingsRow {
  jira_config: Partial<JiraConfig> | null
  ai_config: Partial<AiConfig> | null
}

/**
 * Settings for one Neon Auth user. Every query is scoped by userId, which only
 * ever comes from a verified JWT — that scoping is the access boundary, since the
 * connection is owner-level and bypasses RLS.
 */
export async function getSettings(userId: string): Promise<ServerSettings> {
  const rows = (await sql()`
    select jira_config, ai_config
    from public.user_settings
    where user_id = ${userId}
  `) as SettingsRow[]

  const row = rows[0]
  return {
    jiraConfig: { ...DEFAULT_JIRA_CONFIG, ...(row?.jira_config ?? {}) },
    aiConfig: { ...DEFAULT_AI_CONFIG, ...(row?.ai_config ?? {}) },
  }
}

export async function saveSettings(userId: string, settings: ServerSettings): Promise<void> {
  await sql()`
    insert into public.user_settings (user_id, jira_config, ai_config)
    values (${userId}, ${JSON.stringify(settings.jiraConfig)}::jsonb, ${JSON.stringify(settings.aiConfig)}::jsonb)
    on conflict (user_id) do update
      set jira_config = excluded.jira_config,
          ai_config   = excluded.ai_config
  `
}
