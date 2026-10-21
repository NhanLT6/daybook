import type { JiraConfig } from '@/interfaces/JiraConfig'

/** How AI runs: the deployment's shared gateway or the user's own Gemini key (BYOK). */
export type AiMode = 'default' | 'own'

export interface AiConfig {
  enabled: boolean // Legacy: "own key is on". Kept in step with mode === 'own' by the Settings page
  apiKey: string
  model: string // Gemini model for the user's own key
  // Absent on settings saved before the mode choice existed; 'off' was removed and now reads as shared — see resolveAiMode
  mode?: AiMode | 'off'
}

export interface ServerSettings {
  aiConfig: AiConfig
  jiraConfig: JiraConfig
}

/** What GET /api/settings returns: the stored settings with their secrets masked (see maskSecret). */
export type ServerSettingsResponse = ServerSettings

// Saved secrets never leave the server. The browser gets this prefix plus the last 4 characters,
// and sending the masked value back means "keep the saved one". Real tokens never contain "•".
const SECRET_MASK = '••••••••'

export const maskSecret = (secret: string): string => (secret ? `${SECRET_MASK}${secret.slice(-4)}` : '')

export const isMaskedSecret = (value: string | undefined): boolean => !!value?.startsWith(SECRET_MASK)

/**
 * The mode a stored config means. Configs saved before `mode` existed keep using the user's own key
 * when one was switched on; everything else (including the removed 'off') runs on the shared gateway.
 */
export function resolveAiMode(config: AiConfig): AiMode {
  if (config.mode === 'own') return 'own'
  if (!config.mode && config.enabled && config.apiKey) return 'own'
  return 'default'
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  apiKey: '',
  model: 'gemini-2.5-flash',
}
