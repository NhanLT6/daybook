import { ref } from 'vue'
import { authHeaders } from './useAuth'
import type { ServerSettings } from '@/interfaces/ServerSettings'
import type { JiraConfig } from '@/interfaces/JiraConfig'

// PUT body — either section may be omitted; the server keeps the stored value for anything absent.
type SavePayload = Partial<ServerSettings>

const isLoading = ref(false)
const isLoaded = ref(false)
const error = ref<string | null>(null)

/** Thrown when the caller is signed out, so callers can skip a certain 401. */
export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to use server-stored settings')
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const auth = await authHeaders()
  if (!auth) throw new NotSignedInError()
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(options.headers as Record<string, string> | undefined),
    },
  })
}

export function useServerSettings() {
  const loadSettings = async (): Promise<ServerSettings | null> => {
    isLoading.value = true
    error.value = null
    try {
      const res = await apiFetch('/api/settings')
      if (!res.ok) throw new Error(`Settings load failed: ${res.status}`)
      return (await res.json()) as ServerSettings
    } catch (e) {
      // Signed out is an ordinary state, not a failure worth showing.
      if (e instanceof NotSignedInError) return null
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
      return null
    } finally {
      isLoading.value = false
      isLoaded.value = true
    }
  }

  const saveSettings = async (payload: SavePayload): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Settings save failed: ${res.status}`)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save settings'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * One-time migration: if Jira config exists in localStorage, move it to the
   * server and clear localStorage. Called once during app startup.
   */
  const migrateJiraFromLocalStorage = async (
    currentJiraConfig: JiraConfig,
    serverSettings: ServerSettings,
  ): Promise<JiraConfig> => {
    const raw = localStorage.getItem('jiraConfig')
    if (!raw) return serverSettings.jiraConfig

    try {
      const localConfig = JSON.parse(raw) as JiraConfig
      // Only migrate if the local config has actual data
      if (!localConfig.email && !localConfig.apiToken) return serverSettings.jiraConfig

      await saveSettings({ jiraConfig: localConfig })
      localStorage.removeItem('jiraConfig')
      return localConfig
    } catch {
      return serverSettings.jiraConfig
    }
  }

  return {
    isLoading,
    isLoaded,
    error,
    loadSettings,
    saveSettings,
    migrateJiraFromLocalStorage,
  }
}
