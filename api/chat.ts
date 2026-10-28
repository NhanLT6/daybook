import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UIMessage } from 'ai';

import { convertToModelMessages, streamText, tool } from 'ai';

import {
  SERVER_CHAT_COMMANDS,
  addEventInputSchema,
  addNoteInputSchema,
  extractLogsInputSchema,
  searchNotesInputSchema,
  type ServerChatCommand,
} from '../src/interfaces/aiTools.js';
import { AuthError, headerReader, requireUser } from './_lib/neonAuth.js';
import { AI_NOT_SET_UP_MESSAGE, MAX_OUTPUT_TOKENS, aiErrorMessage, isAiAvailable, resolveAi } from './_lib/ai.js';
import { getSettings } from './_lib/settingsRepo.js';
import { buildSystemPrompt, type PromptContext } from './_lib/chatPrompt.js';
import { DEFAULT_AI_CONFIG, type AiConfig } from '../src/interfaces/ServerSettings.js';

interface ChatApiRequest extends PromptContext {
  messages: UIMessage[];
  currentDate: string;
  workdayMinutes?: number | null; // The user's daily target; null = no target. Absent from older clients → 480
  command?: string; // Slash command on the latest message (/log, /note…); absent = let the model decide
}

const extractLogsTool = tool({
  description:
    "Extract one or more time log entries from the user's message. Call this whenever the user describes work they did (via text or screenshot).",
  inputSchema: extractLogsInputSchema,
});

// No execute: notes live in the user's browser, so the client runs the search and sends the result back
const searchNotesTool = tool({
  description:
    "Read the user's sticky notes. Call this when the answer may be in their notes: reminders, open questions, what they noted about a ticket or person.",
  inputSchema: searchNotesInputSchema,
});

// No execute for these either: notes and events live in the user's browser
const addNoteTool = tool({
  description: 'Save a new sticky note for the user: a reminder, a to-do, a question to bring up later.',
  inputSchema: addNoteInputSchema,
});

const addEventTool = tool({
  description:
    "Add a one-off event to the user's calendar: a meeting, leave, a deadline, a release. Not for repeating events.",
  inputSchema: addEventInputSchema,
});

const TOOLS = {
  extractLogs: extractLogsTool,
  searchNotes: searchNotesTool,
  addNote: addNoteTool,
  addEvent: addEventTool,
};
type ToolName = keyof typeof TOOLS;

// A slash command narrows the tools to the one feature the user named, so the model can't
// file a note as a log. It can still answer in text, which is how it asks back for missing details.
const COMMAND_TOOLS: Record<ServerChatCommand, ToolName[]> = {
  log: ['extractLogs'],
  note: ['addNote'],
  event: ['addEvent'],
  ask: ['searchNotes'],
};

const parseCommand = (value: unknown): ServerChatCommand | undefined =>
  SERVER_CHAT_COMMANDS.find((c) => c === value);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let aiConfigForError: AiConfig = DEFAULT_AI_CONFIG;

  try {
    const { userId } = await requireUser(headerReader(req));

    const { aiConfig } = await getSettings(userId);
    aiConfigForError = aiConfig;
    if (!isAiAvailable(aiConfig)) {
      return res.status(400).json({ error: AI_NOT_SET_UP_MESSAGE });
    }

    const body = req.body as ChatApiRequest;
    const command = parseCommand(body.command);

    const result = streamText({
      ...resolveAi(aiConfig),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      system: buildSystemPrompt(
        body,
        body.currentDate,
        body.workdayMinutes === undefined ? 480 : body.workdayMinutes,
        command,
      ),
      messages: await convertToModelMessages(body.messages),
      tools: TOOLS,
      ...(command ? { activeTools: COMMAND_TOOLS[command] } : {}),
    });

    // Stream to Node.js ServerResponse using the AI SDK helper. Failures after the stream has started
    // (a quota or rate-limit rejection arrives here) reach the client through onError.
    result.pipeUIMessageStreamToResponse(res, {
      onError: (err) => {
        console.error('Chat stream error:', err);
        return aiErrorMessage(err, aiConfigForError);
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Chat error:', err);
    return res.status(500).json({ error: aiErrorMessage(err, aiConfigForError) });
  }
}
