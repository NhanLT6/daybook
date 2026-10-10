import { z } from 'zod';

/**
 * Single source of truth for the `extractLogs` tool contract.
 *
 * Imported by BOTH the client (part typing + tool detection in useAiChat) and
 * the server (`/api/chat.ts`, the schema sent to the model). Keep this file
 * dependency-light (zod only, no `@/` alias, no Vue, no `ai`) so it can be
 * bundled into the Vercel serverless function without pulling in client code.
 */

export const extractedLogSchema = z.object({
  project: z.string().describe('Project name, matched to known projects where possible'),
  task: z.string().optional().describe('Task name, only if explicitly mentioned; leave unset otherwise'),
  date: z.string().describe('ISO date YYYY-MM-DD, resolved from relative references using today'),
  duration: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Duration in minutes. Omit for a plan entry that has no logged time yet.'),
  description: z.string().optional().describe('Optional extra detail'),
});

export const extractLogsInputSchema = z.object({
  logs: z.array(extractedLogSchema),
});

export type ExtractedLog = z.infer<typeof extractedLogSchema>;
export type ExtractLogsInput = z.infer<typeof extractLogsInputSchema>;

/**
 * `searchNotes` runs in the browser (notes live in IndexedDB, the server can't read them).
 * The query only ranks notes; the model reads the messy text itself, so matching stays loose.
 */
export const searchNotesInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('A few keywords from the question, used only to rank notes. Omit to get the most recent notes.'),
});

export interface SearchNotesOutput {
  totalNotes: number;
  notes: Array<{
    updated: string; // YYYY-MM-DD
    pinned: boolean;
    text: string; // plain text; checklist lines start with "[ ]" (open) or "[x]" (done)
  }>;
}

export type SearchNotesInput = z.infer<typeof searchNotesInputSchema>;

/**
 * `addNote` runs in the browser too: it saves a new sticky note (undoable from the chat).
 * Plain text in, the client turns it into note HTML.
 */
export const addNoteInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      'The note, in the user\'s own words. One line per paragraph; start a line with "[ ] " to make it a checklist item.',
    ),
});

export type AddNoteInput = z.infer<typeof addNoteInputSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

/** `addEvent` saves a one-off calendar marker in the browser. Repeating events stay on the Events page. */
export const addEventInputSchema = z.object({
  title: z.string().min(1).describe('Short event name'),
  date: isoDate.describe('Start date, ISO YYYY-MM-DD, resolved from relative references using today'),
  endDate: isoDate.optional().describe('Last day, only for an event spanning several days'),
  startTime: hhmm.optional().describe('Start time HH:mm (24h). Omit for an all-day event'),
  endTime: hhmm.optional().describe('End time HH:mm (24h), only with startTime'),
  description: z.string().optional().describe('Optional extra detail'),
});

export type AddEventInput = z.infer<typeof addEventInputSchema>;

/** What addNote / addEvent send back: the id lets the chat undo the save. */
export interface AddedItemOutput {
  saved: boolean;
  id?: string;
  error?: string;
}

/**
 * Slash commands: the user says up front what a message is, so the model doesn't guess.
 * `catchup` never reaches the server (it runs the existing Catch-up summary).
 */
export const SERVER_CHAT_COMMANDS = ['log', 'note', 'event', 'ask'] as const;
export type ServerChatCommand = (typeof SERVER_CHAT_COMMANDS)[number];
