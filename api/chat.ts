import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { CoreMessage, ImagePart, TextPart } from 'ai'
import { AuthError, verifyRequest } from './_lib/auth.js'
import { getSettings } from './_lib/kv.js'

interface ChatApiRequest {
  // Messages in our own format — converted to CoreMessage inside this handler
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  projects: string[]
  tasks: Array<{ project: string; title: string }>
  currentDate: string
  // Attached image on the latest user message only (raw base64, no data-URL prefix)
  imageBase64?: string
  imageMimeType?: string
}

function buildSystemPrompt(
  projects: string[],
  tasks: Array<{ project: string; title: string }>,
  currentDate: string,
): string {
  const projectList = projects.length ? projects.join(', ') : 'none configured'
  const taskList = tasks.length
    ? tasks.map((t) => `  - ${t.project}: ${t.title}`).join('\n')
    : '  none configured'

  return `You are a time log assistant for a daily work tracking app called Daybook.
Today's date is ${currentDate}.

The user's known projects are: ${projectList}

The user's known tasks per project:
${taskList}

When the user describes work they did (via text or screenshot), extract one or more time log entries.
- Match project names to the known list where possible. If not found, use what the user said.
- Match task names to the known list for that project where possible. If not found, use what the user said.
- If no task is mentioned or cannot be determined, set task equal to the project name. This is the app's convention. Mention this briefly in your summary (e.g. "I used the project name as the task since none was specified.").
- Resolve relative dates ("yesterday", "this morning", "last Friday") using today's date.
- Duration must be in minutes (integer).
- description is optional — use it for meaningful detail only.

ALWAYS respond in this exact format:

<natural language summary, 1-2 sentences>

\`\`\`json
[
  { "project": "...", "task": "...", "date": "YYYY-MM-DD", "duration": 90, "description": "..." }
]
\`\`\`

If you cannot find any time log data in the message, respond conversationally and ask for clarification. Do NOT include the JSON block in that case.`
}

/**
 * Convert our ChatMessage format to AI SDK CoreMessage format.
 * The image (if any) is attached only to the last user message.
 */
function toCoreMessages(
  messages: ChatApiRequest['messages'],
  imageBase64?: string,
  imageMimeType?: string,
): CoreMessage[] {
  return messages.map((msg, index): CoreMessage => {
    const isLastUserMessage = index === messages.length - 1 && msg.role === 'user'
    const hasImage = isLastUserMessage && imageBase64 && imageMimeType

    if (hasImage) {
      // Multi-part user message with text + image
      const parts: Array<TextPart | ImagePart> = [
        { type: 'text', text: msg.content },
        {
          type: 'image',
          image: imageBase64,
          mimeType: imageMimeType as `image/${string}`,
        },
      ]
      return { role: 'user', content: parts }
    }

    // Simple text message
    return { role: msg.role, content: msg.content }
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Machine-Id, X-Public-Key, X-Signature, X-Timestamp')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { machineId } = await verifyRequest({
      get: (name: string) => {
        const val = req.headers[name.toLowerCase()]
        return Array.isArray(val) ? val[0] : (val ?? null)
      },
    })

    const settings = await getSettings(machineId)
    if (!settings.geminiConfig.enabled || !settings.geminiConfig.apiKey) {
      return res.status(400).json({
        error: 'AI Assistant is not configured. Add your Gemini API key in Settings.',
      })
    }

    const body = req.body as ChatApiRequest

    // Create a Google provider instance with the user's own API key.
    // Switching to another provider later (OpenAI, Anthropic) is a one-line change here.
    const google = createGoogleGenerativeAI({ apiKey: settings.geminiConfig.apiKey })

    const { text } = await generateText({
      model: google(settings.geminiConfig.model),
      system: buildSystemPrompt(body.projects, body.tasks, body.currentDate),
      messages: toCoreMessages(body.messages, body.imageBase64, body.imageMimeType),
    })

    return res.status(200).json({ text })
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('Chat error:', err)
    return res.status(500).json({ error: 'AI request failed. Check your API key in Settings.' })
  }
}
