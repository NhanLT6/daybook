import { describe, it, expect } from 'vitest'

// We test the pure helper functions directly.
// IndexedDB functions are integration-tested via E2E.

describe('deriveFingerprint', () => {
  it('returns a 64-char hex string for a JWK', async () => {
    // Import the function under test after creating the file
    const { deriveFingerprint } = await import('../useCrypto')
    const fakeJwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' }
    const fp = await deriveFingerprint(fakeJwk)
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same fingerprint for the same JWK', async () => {
    const { deriveFingerprint } = await import('../useCrypto')
    const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' }
    const [a, b] = await Promise.all([deriveFingerprint(jwk), deriveFingerprint(jwk)])
    expect(a).toBe(b)
  })
})

describe('buildSignPayload', () => {
  it('returns machineId:timestamp string', async () => {
    const { buildSignPayload } = await import('../useCrypto')
    expect(buildSignPayload('abc123', 1234567890)).toBe('abc123:1234567890')
  })
})
