import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AuthError, headerReader, requireUser } from './_lib/neonAuth.js'
import { getSettings, saveSettings } from './_lib/settingsRepo.js'
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    // Identity comes from a Neon Auth token, so a caller can only ever reach
    // their own row — there is no user id in the request for them to tamper with.
    const { userId } = await requireUser(headerReader(req))

    if (req.method === 'GET') {
      return res.status(200).json(await getSettings(userId))
    }

    if (req.method === 'PUT') {
      const body = req.body as SettingsPutBody
      const current = await getSettings(userId)
      // Merge so a partial save never clears the other section's credentials.
      await saveSettings(userId, {
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
