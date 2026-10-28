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
import { dateContext } from './_lib/dateContext.js';
import { APP_GUIDE } from '../src/common/appGuide.js';
import { TASK_SEPARATOR } from '../src/common/chatMentions.js';
import { DEFAULT_AI_CONFIG, type AiConfig } from '../src/interfaces/ServerSettings.js';

interface ChatApiRequest {
  messages: UIMessage[];
  projects: string[];
  tickets?: string[]; // the user's issue-tracker tickets ("DS-123 Summary"), each one a project; absent from older clients
  reviewTickets?: string[]; // teammates' tickets, to name what a code review was about
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
    return `- "The rest" / "remaining time" / "rest of the day": the user has no daily target set. If the message states how long the day was, set that entry's duration to that length minus the other entries' minutes. Otherwise don't guess: ask how long the day was.`;
  }
  return `- "The rest" / "remaining time" / "rest of the day" / "what's left": set restOfDay: true on that entry and leave duration unset. Never work out the minutes yourself: the app subtracts the day's other logs (saved earlier and in this message) from the user's ${workdayMinutes}-minute target.`;
}

function buildSystemPrompt(
  context: Pick<ChatApiRequest, 'projects' | 'tickets' | 'reviewTickets' | 'tasks'>,
  currentDate: string,
  workdayMinutes: number | null,
  command: ServerChatCommand | undefined,
): string {
  const list = (items: string[] | undefined) => (items?.length ? items.map((i) => `  - ${i}`).join('\n') : '  none');
  const taskList = context.tasks.length
    ? context.tasks.map((t) => `  - ${t.project}${TASK_SEPARATOR}${t.title}`).join('\n')
    : '  none';

  const commandRule = command ? `\n\n${COMMAND_RULES[command]}` : '';

  return `You are a time log assistant for a daily work tracking app called Daybook.
${dateContext(currentDate)}

The user's projects:
${list(context.projects)}

The user's tickets. Each one is a project; its name is the whole line, key and summary:
${list(context.tickets)}

Their tasks, as Project › Task:
${taskList}

Teammates' tickets (only for naming what a review was about; never a project):
${list(context.reviewTickets)}

When the user describes work they did (via text or screenshot), call the extractLogs tool with the extracted entries.
- One entry per piece of work. A new duration starts a new entry; "and" or a full stop usually separates them.
- project and task come from the lists above whenever the words fit, spelled exactly as listed. Only use new names when nothing fits.
- Tickets: when the message names a ticket key (DS-4475), with or without its summary after it, the project is that ticket's whole line from the list ("DS-4475 Redesigned test tracking flow"). Task stays unset, and the summary is not a task or description. A key not in any list is still the project, written as the user wrote it. Treat every ticket the same way, wherever it sits in the message.
- "Project › Task" in the message is a pick from the lists: use both exactly as written.
- Routine team work goes under the matching task in the lists, e.g. daily / standup → "Daily meeting", reviewing code, a PR or a ticket → "Code review", retro → "Retro". Pick the task by meaning, never the first one listed.
- Reviewing a ticket or PR is the review task, not the ticket's own project. Keep what was reviewed in description: "Review ticket " + the whole line when the ticket is in the teammates' or user's list, otherwise "Review " + what the user wrote (DS-4556, PR #412). Never drop a ticket key or PR number the user wrote.
- Task is optional. Only set it when the message names one or a routine above applies; never default it to the project name.
- Resolve relative dates ("yesterday", "this morning", "last Friday", "monday this week") from the dates listed above.
- duration is whole minutes: "10mins" = 10, "1h30" = 90, "2hours" = 120.
${workdayRules(workdayMinutes)}
- Omit duration (plan entry, no time logged yet) when the user is describing future/not-yet-done work, e.g. "plan to work on T-999", "will pick up T-999", "todo: T-999".
- If a task is mentioned with no duration, no "rest" wording and no plan wording, don't guess: ask how much time (or whether it's a plan entry).
- description is a short note the user would write on the log themselves: which PR or ticket they reviewed, what a meeting was about. Leave it unset unless the message states such a detail for that entry.
  - Never put your reasoning, maths or reading of the message into it (no "rest of the day", "480-15=465", "from screenshot").
  - Never repeat the project, task, ticket summary, date or duration in it ("Daily 10mins" for a daily is wrong: leave it unset).
- Example. Lists hold "Team work › Daily meeting", "Team work › Code review", tickets "AB-7 Login page" and "AB-9 Signup form", teammate ticket "AB-12 Fix export". Message: "daily 15m. code review AB-12 30 mins. 1h for AB-7 Login page and the rest for AB-9 Signup form" →
  1. Team work › Daily meeting, 15, no description
  2. Team work › Code review, 30, description "Review ticket AB-12 Fix export"
  3. project "AB-7 Login page", no task, 60
  4. project "AB-9 Signup form", no task, ${workdayMinutes ? 'restOfDay: true, no duration' : 'ask how long the day was'}
- If the user corrects logs you extracted earlier (wrong date, duration, task), call extractLogs again with the full corrected list. Earlier extractLogs results say whether the user saved or discarded those logs; if they were already saved, mention that the old entries need deleting from the log list.
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
- A message may start with a slash command (/log, /note, /event, /ask). It tells you which one the user means.

Questions about Daybook itself (how to do something, where data is kept, what a feature does): answer from this guide in a few plain sentences, without Markdown. If it doesn't say, say you're not sure rather than inventing a feature.
"""
${APP_GUIDE}
"""${commandRule}`;
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
