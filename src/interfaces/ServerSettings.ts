import type { JiraConfig } from '@/interfaces/JiraConfig'

/** How AI runs: the deployment's shared gateway, the user's own Gemini key, or not at all. */
export type AiMode = 'default' | 'own' | 'off'

export interface AiConfig {
  enabled: boolean // Legacy: "own key is on". Kept in step with mode === 'own' by the Settings page
  apiKey: string
  model: string // Gemini model for the user's own key
  mode?: AiMode // Absent on settings saved before the mode choice existed — see resolveAiMode
}

export interface ServerSettings {
  aiConfig: AiConfig
  jiraConfig: JiraConfig
}

/** What GET /api/settings returns: the stored settings plus a deployment flag. */
export interface ServerSettingsResponse extends ServerSettings {
  aiGatewayAvailable: boolean // The deployment runs a shared AI gateway, so AI works without the user's own key
}

/**
 * The mode a stored config means. Configs saved before `mode` existed keep their old behaviour: the
 * user's own key when one was switched on, otherwise the shared gateway if the deployment has one, else off.
 */
export function resolveAiMode(config: AiConfig, gatewayAvailable: boolean): AiMode {
  if (config.mode) return config.mode
  if (config.enabled && config.apiKey) return 'own'
  return gatewayAvailable ? 'default' : 'off'
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}
