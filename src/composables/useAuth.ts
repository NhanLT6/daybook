import { computed, ref } from 'vue'

import { useEventListener } from '@vueuse/core'

// createAuthClient returns the Better Auth client bare; createInternalNeonAuth wraps
// it as { adapter, getJWTToken } — and getJWTToken is what our own API needs for the
// Authorization header, so that is the one to build on.
import { createInternalNeonAuth } from '@neondatabase/auth'

/**
 * Neon Auth wrapper. Identity is only needed for the server-backed features
 * (AI chat, catch-up, Jira sync, stored credentials) — logging time works fully
 * signed out against the local IndexedDB store, so nothing here gates the app.
 */

export interface AuthUser {
  id: string
  email?: string
  name?: string
  image?: string
}

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined

// One client for the whole app. Absent config is not fatal: the app still runs
// locally, the signed-out state just never becomes signed-in.
const client = authUrl ? createInternalNeonAuth(authUrl) : null

export const isAuthConfigured = !!client

const user = ref<AuthUser | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

function toUser(raw: unknown): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as Record<string, unknown>
  if (typeof u.id !== 'string') return null
  return {
    id: u.id,
    email: typeof u.email === 'string' ? u.email : undefined,
    name: typeof u.name === 'string' ? u.name : undefined,
    image: typeof u.image === 'string' ? u.image : undefined,
  }
}

function messageOf(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return err instanceof Error && err.message ? err.message : fallback
}

async function loadSession(): Promise<void> {
  if (!client) return
  try {
    const result = await client.adapter.getSession()
    user.value = toUser((result as { data?: { user?: unknown } })?.data?.user)
  } catch {
    // A missing or expired session is the normal signed-out case, not an error
    // worth surfacing — the UI simply shows the sign-in affordance.
    user.value = null
  }
}

/**
 * Pick up a session the first load missed. Reloading right after sign-up can
 * read "no session" even though a later load finds it, and nothing asked again,
 * so the app stayed signed out. Only ever upgrades signed-out → signed-in: a
 * failed or empty re-check never signs anyone out.
 */
async function recheckSession(): Promise<void> {
  if (!client || user.value) return
  try {
    const result = await client.adapter.getSession()
    const found = toUser((result as { data?: { user?: unknown } })?.data?.user)
    if (found) user.value = found
  } catch {
    // Still signed out; the next focus tries again.
  }
}

const RECHECK_DELAY_MS = 2000

// Resolve the initial session once, at module load, so callers can await a
// settled auth state instead of racing it. A signed-out start gets one delayed
// re-check, and returning to the tab re-checks too (Better Auth's own session
// store refetches on focus for the same reason).
const ready: Promise<void> = loadSession().then(() => {
  if (client && !user.value) setTimeout(() => void recheckSession(), RECHECK_DELAY_MS)
})
if (client) {
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') void recheckSession()
  })
}

async function run<T>(fallbackMessage: string, fn: () => Promise<T>): Promise<boolean> {
  if (!client) {
    error.value = 'Sign-in is not configured on this deployment.'
    return false
  }
  isLoading.value = true
  error.value = null
  try {
    const result = (await fn()) as { error?: { message?: string } | null } | undefined
    if (result?.error) {
      error.value = result.error.message ?? fallbackMessage
      return false
    }
    await loadSession()
    return true
  } catch (err) {
    error.value = messageOf(err, fallbackMessage)
    return false
  } finally {
    isLoading.value = false
  }
}

export function useAuth() {
  const signInEmail = (email: string, password: string) =>
    run('Could not sign in', () => client!.adapter.signIn.email({ email, password }))

  const signUpEmail = (email: string, password: string, name: string) =>
    run('Could not create the account', () => client!.adapter.signUp.email({ email, password, name }))

  const signInGoogle = () =>
    run('Could not sign in with Google', () =>
      client!.adapter.signIn.social({ provider: 'google', callbackURL: window.location.origin }),
    )

  const signOut = async (): Promise<boolean> => {
    const ok = await run('Could not sign out', () => client!.adapter.signOut())
    user.value = null
    return ok
  }

  return {
    user: computed(() => user.value),
    isAuthenticated: computed(() => user.value !== null),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    isAuthConfigured,
    ready,
    refresh: loadSession,
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
  }
}

/**
 * Bearer headers for our own API. Returns null when signed out so callers can
 * skip the request rather than fire one that is certain to 401.
 */
export async function authHeaders(): Promise<Record<string, string> | null> {
  if (!client) return null
  try {
    const token = await client.getJWTToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  } catch {
    return null
  }
}
