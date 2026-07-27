import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// vercel dev doesn't reliably inject .env.development.local into the function
// runtime, so we load it explicitly. dotenv skips vars already in process.env,
// so real Vercel environment variables always win.
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
dotenv.config({ path: resolve(root, '.env.development.local') })
dotenv.config({ path: resolve(root, '.env.local') })

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured on this deployment.`)
  return value
}

/**
 * Public base URL of the Neon Auth service. Shared with the client (which needs it
 * to sign in), hence the VITE_ prefix — it is a public endpoint, not a secret.
 */
export const neonAuthUrl = () => requireEnv('VITE_NEON_AUTH_URL').replace(/\/+$/, '')

/** Owner-level Postgres connection. Server only — never expose to the client. */
export const neonConnectionString = () => requireEnv('NEON_CONNECTION_STRING')
