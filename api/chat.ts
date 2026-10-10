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
import { DEFAULT_AI_CONFIG, type AiConfig } from '../src/interfaces/ServerSettings.js';

interface ChatApiRequest {
  messages: UIMessage[];
  projects: string[];
  tasks: Array<{ project: string; title: string }>;
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

const COMMAND_RULES: Record<ServerChatCommand, string> = {
  log: 'The latest message starts with /log: it is work to log. Call extractLogs, or ask for what is missing. Do not save it as a note or event.',
  note: "The latest message starts with /note: save the rest of it with addNote, keeping the user's wording (fix only obvious typos). Do not log time.",
  event:
    'The latest message starts with /event: add it with addEvent. If the date is unclear, ask. If it repeats, say repeating events are set up on the Events page.',
  ask: 'The latest message starts with /ask: answer it from the notes with searchNotes.',
};

const parseCommand = (value: unknown): ServerChatCommand | undefined =>
  SERVER_CHAT_COMMANDS.find((c) => c === value);

// Remainder rules depend on the user's daily target; with none set there's no "rest of the day" to compute
function workdayRules(workdayMinutes: number | null): string {
  if (!workdayMinutes) {
    return `- The user has no standard workday length set, unless they state one in the message.
- Duration remainder phrasing ("the rest", "remaining time", "rest of the day", "what's left") can only be resolved when the message states the workday length. Otherwise don't guess: ask the user how long their day was.`;
  }
  const rest = workdayMinutes - 15 - 60;
  return `- The user's standard workday is ${workdayMinutes} minutes unless they state otherwise in the message.
- Duration remainder phrasing ("the rest", "remaining time", "rest of the day", "what's left") means: workday total minus the sum of every other duration already stated in the same message. When this phrasing is present, compute the remainder and set it as that entry's duration — do not fall back to a plan entry in this case.
  - Example: "15min daily, T-123 1hour, rest for T-456" → daily=15, T-123=60, T-456=${workdayMinutes}-15-60=${rest}.
  - If the remainder would be zero or negative, say so in your text reply instead of calling extractLogs with a bad value.`;
}

function buildSystemPrompt(
  projects: string[],
  tasks: Array<{ project: string; title: string }>,
  currentDate: string,
  workdayMinutes: number | null,
  command: ServerChatCommand | undefined,
): string {
  const projectList = projects.length ? projects.join(', ') : 'none configured';
  const taskList = tasks.length ? tasks.map((t) => `  - ${t.project}: ${t.title}`).join('\n') : '  none configured';

  const commandRule = command ? `\n\n${COMMAND_RULES[command]}` : '';

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
${workdayRules(workdayMinutes)}
- Omit duration (plan entry, no time logged yet) when the user is describing future/not-yet-done work — e.g. "plan to work on T-999", "will pick up T-999", "todo: T-999" — with no remainder phrasing.
- If a task is mentioned with no duration, no remainder phrasing, and no plan-intent wording either, don't guess — ask the user to clarify how much time (or whether it's a plan entry).
- description is optional — use it for meaningful detail only.
- Do NOT include a JSON block in your text response. Use the extractLogs tool instead.

If you cannot find any time log data in the message, reply conversationally and ask for clarification. Do NOT call extractLogs in that case.

The user also keeps quick sticky notes: reminders, questions for the daily meeting, things to follow up.
- When a question may be answered by those notes, call searchNotes instead of guessing or saying you don't know.
- Notes are messy shorthand with typos and abbreviations. Read them generously and match by meaning, not exact words.
- Checklist lines start with "[ ]" (still open) or "[x]" (done). An open line or a line ending in "?" is usually an open question or to-do.
- Quote or closely paraphrase the note you rely on, with its date. If a note is ambiguous, say what it says rather than inventing details.
- If nothing relevant is in the notes, say so plainly.
- Do not call extractLogs from note content unless the user asks to log it.

Saving notes and events:
- Call addNote when the user wants to remember something for later (a reminder, a to-do, a question for someone). Keep their wording.
- Call addEvent when they mention a dated thing on their calendar (a meeting, leave, a deadline). Resolve relative dates using today's date. Repeating events can't be added here: point them to the Events page.
- Work they did is a time log, not a note. If you can't tell which one they mean, ask in one short question instead of guessing.
- After a save, confirm in a few words. The app shows an Undo button, so don't ask "are you sure".
- A message may start with a slash command (/log, /note, /event, /ask). It tells you which one the user means.${commandRule}`;
}

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
        body.projects,
        body.tasks,
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
