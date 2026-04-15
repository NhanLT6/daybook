// Server-side Web Crypto verification for Vercel serverless functions.
// Node.js 18+ exposes globalThis.crypto.subtle natively.

const { subtle } = globalThis.crypto

const MAX_AGE_MS = 60_000 // reject requests older than 60 seconds

export interface AuthHeaders {
  machineId: string
  publicKeyJwk: JsonWebKey
  signature: string
  timestamp: number
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message)
  }
}

/**
 * Extract and validate auth headers from an incoming request.
 * Throws AuthError if any header is missing or the signature is invalid.
 */
export async function verifyRequest(headers: {
  get(name: string): string | null
}): Promise<AuthHeaders> {
  const machineId = headers.get('x-machine-id')
  const publicKeyB64 = headers.get('x-public-key')
  const signature = headers.get('x-signature')
  const timestampStr = headers.get('x-timestamp')

  if (!machineId || !publicKeyB64 || !signature || !timestampStr) {
    throw new AuthError('Missing auth headers')
  }

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp) || Date.now() - timestamp > MAX_AGE_MS) {
    throw new AuthError('Request expired')
  }

  let publicKeyJwk: JsonWebKey
  try {
    publicKeyJwk = JSON.parse(atob(publicKeyB64)) as JsonWebKey
  } catch {
    throw new AuthError('Invalid public key encoding')
  }

  const isValid = await verifySignature(machineId, timestamp, signature, publicKeyJwk)
  if (!isValid) {
    throw new AuthError('Invalid signature')
  }

  return { machineId, publicKeyJwk, signature, timestamp }
}

async function verifySignature(
  machineId: string,
  timestamp: number,
  signatureBase64: string,
  publicKeyJwk: JsonWebKey,
): Promise<boolean> {
  try {
    const publicKey = await subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    const payload = `${machineId}:${timestamp}`
    const encoded = new TextEncoder().encode(payload)
    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0))

    return await subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      signatureBytes,
      encoded,
    )
  } catch {
    return false
  }
}
