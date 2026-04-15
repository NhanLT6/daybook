// scripts/test-auth.mjs
// Generates signed auth headers for testing the /api/settings endpoint.
// Usage: node scripts/test-auth.mjs
const { subtle } = globalThis.crypto

const keyPair = await subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)
const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey)
const encoded = new TextEncoder().encode(JSON.stringify(publicKeyJwk))
const hash = await subtle.digest('SHA-256', encoded)
const machineId = Array.from(new Uint8Array(hash))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')

const timestamp = Date.now()
const payload = `${machineId}:${timestamp}`
const sig = await subtle.sign(
  { name: 'ECDSA', hash: { name: 'SHA-256' } },
  keyPair.privateKey,
  new TextEncoder().encode(payload),
)
const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
const publicKeyB64 = btoa(JSON.stringify(publicKeyJwk))

console.log('curl command:')
console.log(`curl -s http://localhost:3000/api/settings \\
  -H "X-Machine-Id: ${machineId}" \\
  -H "X-Public-Key: ${publicKeyB64}" \\
  -H "X-Signature: ${signature}" \\
  -H "X-Timestamp: ${timestamp}"`)
