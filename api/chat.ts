import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UIMessage } from 'ai';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { convertToModelMessages, streamText, tool } from 'ai';
import { z } from 'zod';

import { AuthError, verifyRequest } from './_lib/auth.js';
import { getSettings } from './_lib/kv.js';

interface ChatApiRequest {
  messages: UIMessage[];
  projects: string[];
  tasks: Array<{ project: string; title: string }>;
  currentDate: string;
}

const extractLogsTool = tool({
  description:
    "Extract one or more time log entries from the user's message. Call this whenever the user describes work they did (via text or screenshot).",
  parameters: z.object({
    logs: z.array(
      z.object({
        project: z.string().describe('Project name, matched to known projects where possible'),
        task: z.string().describe('Task name; use project name if no task is mentioned'),
        date: z.string().describe('ISO date YYYY-MM-DD, resolved from relative references using today'),
        duration: z.number().int().positive().describe('Duration in minutes'),
        description: z.string().optional().describe('Optional extra detail'),
      }),
    ),
  }),
});

function buildSystemPrompt(
  projects: string[],
  tasks: Array<{ project: string; title: string }>,
  currentDate: string,
): string {
  const projectList = projects.length ? projects.join(', ') : 'none configured';
  const taskList = tasks.length ? tasks.map((t) => `  - ${t.project}: ${t.title}`).join('\n') : '  none configured';

  return `You are a time log assistant for a daily work tracking app called Daybook.
Today's date is ${currentDate}.

The user's known projects are: ${projectList}

The user's known tasks per project:
${taskList}

When the user describes work they did (via text or screenshot), call the extractLogs tool with the extracted entries.
- Match project names to the known list where possible. If not found, use what the user said.
- Match task names to the known list for that project where possible. If not found, use what the user said.
- If no task is mentioned or cannot be determined, set task equal to the project name. This is the app's convention. Mention this briefly in your text reply (e.g. "I used the project name as the task since none was specified.").
- Resolve relative dates ("yesterday", "this morning", "last Friday") using today's date.
- Duration must be in minutes (integer).
- description is optional — use it for meaningful detail only.
- Do NOT include a JSON block in your text response. Use the extractLogs tool instead.

If you cannot find any time log data in the message, reply conversationally and ask for clarification. Do NOT call extractLogs in that case.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Machine-Id, X-Public-Key, X-Signature, X-Timestamp');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { machineId } = await verifyRequest({
      get: (name: string) => {
        const val = req.headers[name.toLowerCase()];
        return Array.isArray(val) ? val[0] : (val ?? null);
      },
    });

    const settings = await getSettings(machineId);
    if (!settings.geminiConfig.enabled || !settings.geminiConfig.apiKey) {
      return res.status(400).json({
        error: 'AI Assistant is not configured. Add your Gemini API key in Settings.',
      });
    }

    const body = req.body as ChatApiRequest;
    const google = createGoogleGenerativeAI({ apiKey: settings.geminiConfig.apiKey });

    const result = streamText({
      model: google(settings.geminiConfig.model),
      system: buildSystemPrompt(body.projects, body.tasks, body.currentDate),
      messages: await convertToModelMessages(body.messages),
      tools: { extractLogs: extractLogsTool },
      maxSteps: 1,
    });

    // Stream to Node.js ServerResponse using the AI SDK helper
    result.pipeUIMessageStreamToResponse(res);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'AI request failed. Check your API key in Settings.' });
  }
}
