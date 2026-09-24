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
