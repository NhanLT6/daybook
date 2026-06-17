import { ref } from 'vue'
import { buildAuthHeaders } from './useCrypto'
import type { ServerSettings } from '@/interfaces/ServerSettings'
import type { JiraConfig } from '@/interfaces/JiraConfig'

// Shape of the PUT body — only jira is user-configurable; aiConfig comes from server env vars.
type SavePayload = { jiraConfig: JiraConfig }

const isLoading = ref(false)
const isLoaded = ref(false)
const error = ref<string | null>(null)

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await buildAuthHeaders()
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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
