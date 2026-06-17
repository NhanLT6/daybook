import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AuthError, verifyRequest } from './_lib/auth.js'
import { isAiEnabled } from './_lib/ai.js'
import { getJiraConfig, saveJiraConfig } from './_lib/kv.js'

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

    if (req.method === 'GET') {
      const jiraConfig = await getJiraConfig(machineId)
      const aiConfig = {
        enabled: isAiEnabled(),
        model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      }
      return res.status(200).json({ jiraConfig, aiConfig })
    }

    if (req.method === 'PUT') {
      const { jiraConfig } = req.body as { jiraConfig: Parameters<typeof saveJiraConfig>[1] }
      await saveJiraConfig(machineId, jiraConfig)
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
