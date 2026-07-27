import { createRemoteJWKSet, jwtVerify } from 'jose'

import { neonAuthUrl } from './env.js'

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message)
  }
}

export interface AuthedUser {
  userId: string
  email?: string
}

// Neon Auth signs with EdDSA (Ed25519) and publishes the public key set here.
// createRemoteJWKSet caches the keys and refetches on an unknown `kid`, so key
// rotation is handled without a redeploy.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${neonAuthUrl()}/.well-known/jwks.json`))
  return jwks
}

/**
 * Verify the caller's Neon Auth bearer token and return who they are.
 *
 * This replaces the old machineId scheme, which only proved the caller could sign
 * with a keypair it generated itself — every visitor could mint one, so it never
 * gated who may call the API. The identity here is issued by Neon Auth, so
 * `userId` is a real account and safe to key stored credentials on.
 */
export async function requireUser(headers: { get(name: string): string | null }): Promise<AuthedUser> {
  const header = headers.get('authorization')
  if (!header?.toLowerCase().startsWith('bearer ')) {
    throw new AuthError('Missing bearer token')
  }

  const token = header.slice(7).trim()
  if (!token) throw new AuthError('Missing bearer token')

  let payload
  try {
    ;({ payload } = await jwtVerify(token, getJwks()))
  } catch {
    // Covers a bad signature, an expired token, and an unknown key alike — the
    // caller gets the same answer either way so nothing is leaked about which.
    throw new AuthError('Invalid or expired token')
  }

  if (!payload.sub) throw new AuthError('Token has no subject')

  return {
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  }
}

/** Adapter so Vercel's plain header bag works with requireUser. */
export function headerReader(req: { headers: Record<string, string | string[] | undefined> }) {
  return {
    get: (name: string) => {
      const value = req.headers[name.toLowerCase()]
      return Array.isArray(value) ? value[0] : (value ?? null)
    },
  }
}
