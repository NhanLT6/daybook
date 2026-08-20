import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UIMessage } from 'ai';

import { convertToModelMessages, streamText, tool } from 'ai';

import { extractLogsInputSchema } from '../src/interfaces/aiTools.js';
import { AuthError, headerReader, requireUser } from './_lib/neonAuth.js';
import { isAiEnabled, requireAiModel } from './_lib/ai.js';
import { getSettings } from './_lib/settingsRepo.js';

interface ChatApiRequest {
  messages: UIMessage[];
  projects: string[];
  tasks: Array<{ project: string; title: string }>;
  currentDate: string;
}

const extractLogsTool = tool({
  description:
    "Extract one or more time log entries from the user's message. Call this whenever the user describes work they did (via text or screenshot).",
  inputSchema: extractLogsInputSchema,
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
- Task is optional. Only set it when the user's message actually mentions a task; leave it unset otherwise. Do not default it to the project name.
- Resolve relative dates ("yesterday", "this morning", "last Friday") using today's date.
- Duration must be in minutes (integer).
- The user's standard workday is 8 hours (480 minutes) unless they state otherwise in the message.
- Duration remainder phrasing ("the rest", "remaining time", "rest of the day", "what's left") means: workday total minus the sum of every other duration already stated in the same message. When this phrasing is present, compute the remainder and set it as that entry's duration — do not fall back to a plan entry in this case.
  - Example: "15min daily, T-123 1hour, rest for T-456" → daily=15, T-123=60, T-456=480-15-60=405.
  - If the remainder would be zero or negative, say so in your text reply instead of calling extractLogs with a bad value.
- Omit duration (plan entry, no time logged yet) when the user is describing future/not-yet-done work — e.g. "plan to work on T-999", "will pick up T-999", "todo: T-999" — with no remainder phrasing.
- If a task is mentioned with no duration, no remainder phrasing, and no plan-intent wording either, don't guess — ask the user to clarify how much time (or whether it's a plan entry).
- description is optional — use it for meaningful detail only.
- Do NOT include a JSON block in your text response. Use the extractLogs tool instead.

If you cannot find any time log data in the message, reply conversationally and ask for clarification. Do NOT call extractLogs in that case.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = await requireUser(headerReader(req));

    const { aiConfig } = await getSettings(userId);
    if (!isAiEnabled(aiConfig)) {
      return res.status(400).json({
        error: 'AI Assistant is not configured. Add your Gemini API key in Settings.',
      });
    }

    const body = req.body as ChatApiRequest;

    const result = streamText({
      model: requireAiModel(aiConfig),
      system: buildSystemPrompt(body.projects, body.tasks, body.currentDate),
      messages: await convertToModelMessages(body.messages),
      tools: { extractLogs: extractLogsTool },
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
