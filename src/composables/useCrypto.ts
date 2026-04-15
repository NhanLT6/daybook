const DB_NAME = 'daybook-crypto'
const DB_VERSION = 1
const STORE_NAME = 'keypair'
const KEY_RECORD_ID = 1

interface StoredKeyRecord {
  id: number
  keyPair: CryptoKeyPair
  publicKeyJwk: JsonWebKey
  machineId: string
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openCryptoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadKeyRecord(): Promise<StoredKeyRecord | null> {
  const db = await openCryptoDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY_RECORD_ID)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function saveKeyRecord(record: StoredKeyRecord): Promise<void> {
  const db = await openCryptoDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Pure helpers (exported for testing) ───────────────────────────────────

export async function deriveFingerprint(jwk: JsonWebKey): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(jwk))
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function buildSignPayload(machineId: string, timestamp: number): string {
  return `${machineId}:${timestamp}`
}

// ── Key generation ─────────────────────────────────────────────────────────

async function generateKeyRecord(): Promise<StoredKeyRecord> {
  // Generate ECDSA P-256 key pair.
  // extractable: false keeps the private key non-exportable from JS.
  // Modern browsers allow exporting the PUBLIC key even with extractable: false
  // because public keys carry no secret — it's safe to expose them.
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  )

  let publicKeyJwk: JsonWebKey
  try {
    publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  } catch {
    // Fallback: some strict browsers refuse export on non-extractable keys.
    // Re-generate with extractable: true. Security is preserved by same-origin
    // IndexedDB isolation — the private key cannot leave this origin.
    const fallbackPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    publicKeyJwk = await crypto.subtle.exportKey('jwk', fallbackPair.publicKey)
    return {
      id: KEY_RECORD_ID,
      keyPair: fallbackPair,
      publicKeyJwk,
      machineId: await deriveFingerprint(publicKeyJwk),
    }
  }

  return {
    id: KEY_RECORD_ID,
    keyPair,
    publicKeyJwk,
    machineId: await deriveFingerprint(publicKeyJwk),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

let cachedRecord: StoredKeyRecord | null = null

export async function getOrCreateKeyRecord(): Promise<StoredKeyRecord> {
  if (cachedRecord) return cachedRecord
  cachedRecord = await loadKeyRecord()
  if (!cachedRecord) {
    cachedRecord = await generateKeyRecord()
    await saveKeyRecord(cachedRecord)
  }
  return cachedRecord
}

/**
 * Sign a payload string with the machine's private key.
 * Returns a base64-encoded ECDSA signature.
 */
export async function signPayload(payload: string, privateKey: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(payload)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    encoded,
  )
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * Build signed auth headers for an API request.
 */
export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const record = await getOrCreateKeyRecord()
  const timestamp = Date.now()
  const payload = buildSignPayload(record.machineId, timestamp)
  const signature = await signPayload(payload, record.keyPair.privateKey)

  return {
    'X-Machine-Id': record.machineId,
    'X-Public-Key': btoa(JSON.stringify(record.publicKeyJwk)),
    'X-Signature': signature,
    'X-Timestamp': String(timestamp),
  }
}
