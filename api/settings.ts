import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AuthError, headerReader, requireUser } from './_lib/neonAuth.js'
import { getSettings, saveSettings } from './_lib/settingsRepo.js'
import { isGatewayEnabled } from './_lib/ai.js'
import { isMaskedSecret, maskSecret, resolveAiMode, type AiConfig } from '../src/interfaces/ServerSettings.js'
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
      // Secrets never leave the server: the Jira proxies and AI routes read them from the DB,
      // and the browser only gets a masked value so Settings can show that a key is saved.
      const { jiraConfig, aiConfig } = await getSettings(userId)
      const aiGatewayAvailable = isGatewayEnabled()
      return res.status(200).json({
        jiraConfig: { ...jiraConfig, apiToken: maskSecret(jiraConfig.apiToken) },
        // Resolve the mode here: the legacy rule needs the real key, which the client no longer sees
        aiConfig: { ...aiConfig, apiKey: maskSecret(aiConfig.apiKey), mode: resolveAiMode(aiConfig, aiGatewayAvailable) },
        // Tells the Settings page whether AI works without the user's own key
        aiGatewayAvailable,
      })
    }

    if (req.method === 'PUT') {
      const body = req.body as SettingsPutBody
      const current = await getSettings(userId)
      // Merge so a partial save never clears the other section's credentials. A masked secret
      // means "unchanged"; an empty one is a deliberate delete.
      await saveSettings(userId, {
        jiraConfig: body.jiraConfig
          ? {
              ...body.jiraConfig,
              apiToken: isMaskedSecret(body.jiraConfig.apiToken) ? current.jiraConfig.apiToken : body.jiraConfig.apiToken,
            }
          : current.jiraConfig,
        aiConfig: body.aiConfig
          ? { ...body.aiConfig, apiKey: isMaskedSecret(body.aiConfig.apiKey) ? current.aiConfig.apiKey : body.aiConfig.apiKey }
          : current.aiConfig,
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
