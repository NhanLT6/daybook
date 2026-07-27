import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AuthError, verifyRequest } from './_lib/auth.js'
import { getSettings, saveSettings } from './_lib/kv.js'
import type { AiConfig } from '../src/interfaces/ServerSettings.js'
import type { JiraConfig } from '../src/interfaces/JiraConfig.js'

interface SettingsPutBody {
  jiraConfig?: JiraConfig
  aiConfig?: AiConfig
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Machine-Id, X-Public-Key, X-Signature, X-Timestamp')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { machineId } = await verifyRequest({
      get: (name: string) => {
        const val = req.headers[name.toLowerCase()]
        return Array.isArray(val) ? val[0] : (val ?? null)
      },
    })

    // Settings are keyed by machineId, which is the SHA-256 of the caller's own
    // public key. verifyRequest proves possession of the matching private key,
    // so a caller can only ever read or write its own credentials.
    if (req.method === 'GET') {
      return res.status(200).json(await getSettings(machineId))
    }

    if (req.method === 'PUT') {
      const body = req.body as SettingsPutBody
      const current = await getSettings(machineId)
      // Merge so a partial save never clears the other section's credentials.
      await saveSettings(machineId, {
        jiraConfig: body.jiraConfig ?? current.jiraConfig,
        aiConfig: body.aiConfig ?? current.aiConfig,
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('Settings error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
