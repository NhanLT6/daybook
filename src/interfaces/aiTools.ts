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
  task: z.string().describe('Task name; use project name if no task is mentioned'),
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
