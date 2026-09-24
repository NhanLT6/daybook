import type { VercelRequest, VercelResponse } from '@vercel/node';

import { generateText } from 'ai';

import { AuthError, headerReader, requireUser } from './_lib/neonAuth.js';
import { isAiEnabled, requireAiModel } from './_lib/ai.js';
import { getSettings } from './_lib/settingsRepo.js';

interface RequestLog {
  task?: string;
  description?: string;
  duration: string;
}

interface RequestItem {
  id: string;
  project: string;
  logs: RequestLog[];
}

interface RequestPlanTask {
  task?: string;
  description?: string;
}

interface RequestPlan {
  id: string;
  project: string;
  tasks: RequestPlanTask[];
}

interface StandupRequest {
  items: RequestItem[];
  plans?: RequestPlan[];
  notes?: string[]; // open checklist items and questions from the user's sticky notes
  today: string;
}

interface StandupResponse {
  lines: { id: string; text: string }[];
  todoLines: { id: string; text: string }[];
  noteLines: string[];
}

function buildPrompt(items: RequestItem[], today: string, plans?: RequestPlan[], notes?: string[]): string {
  const hasDid = items.length > 0;
  const hasTodo = plans && plans.length > 0;
  const hasNotes = notes && notes.length > 0;

  const didSection = hasDid
    ? items
        .map(
          (it) =>
            `id: ${it.id}\nproject: ${it.project}\n${it.logs
              .map((l) => {
                const label = l.task ? `${l.task}${l.description ? `: ${l.description}` : ''}` : (l.description ?? 'work');
                return `  - ${label} (${l.duration})`;
              })
              .join('\n')}`,
        )
        .join('\n\n')
    : '';

  const todoSection = hasTodo
    ? plans!
        .map(
          (p) =>
            `id: ${p.id}\nproject: ${p.project}\n${p.tasks
              .map((t) => {
                const label = t.task ? `${t.task}${t.description ? `: ${t.description}` : ''}` : (t.description ?? 'work');
                return `  - ${label}`;
              })
              .join('\n')}`,
        )
        .join('\n\n')
    : '';

  const didInstruction = hasDid
    ? `For each Did block, write ONE concise past-tense sentence describing what was done, merging the sub-lines.
Start the sentence with the "project" value exactly as given — do not include the "id" value in the sentence text.
Return these in "lines".`
    : '';

  const todoInstruction = hasTodo
    ? `For each Todo block, write ONE concise present/future-tense sentence describing what will be done today.
Start the sentence with the "project" value exactly as given — do not include the "id" value in the sentence text.
Return these in "todoLines".`
    : '';

  const notesSection = hasNotes ? notes!.map((n) => `  - ${n}`).join('\n') : '';

  const notesInstruction = hasNotes
    ? `The "Open items from notes" are the user's own quick notes: messy shorthand, typos, abbreviations.
Turn them into short lines worth raising or following up today (questions, blockers, reminders).
Merge duplicates, keep the user's meaning, expand shorthand only when it is obvious, and never invent details.
Return these as plain strings in "noteLines".`
    : '';

  const responseShape = `{"lines":[{"id":"<id>","text":"<sentence>"}]${hasTodo ? ',"todoLines":[{"id":"<id>","text":"<sentence>"}]' : ''}${hasNotes ? ',"noteLines":["<line>"]' : ''}}`;

  return `You are helping a developer write a standup update. Today is ${today}.
${hasDid ? `\nDid (recent work):\n${didSection}` : ''}
${hasTodo ? `\nTodo (plans for today):\n${todoSection}` : ''}
${hasNotes ? `\nOpen items from notes:\n${notesSection}` : ''}

${didInstruction}
${todoInstruction}
${notesInstruction}
Return STRICT JSON only — no markdown, no code fences, no extra prose:
${responseShape}
with exactly one entry per Did/Todo block in "lines"/"todoLines", echoing each block's "id" value unchanged.`;
}

function parseResponse(raw: string): StandupResponse {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<StandupResponse>;
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      todoLines: Array.isArray(parsed.todoLines) ? parsed.todoLines : [],
      noteLines: Array.isArray(parsed.noteLines) ? parsed.noteLines.filter((l) => typeof l === 'string' && l.trim()) : [],
    };
  } catch {
    return { lines: [], todoLines: [], noteLines: [] };
  }
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
      return res.status(400).json({ error: 'AI Assistant is not configured.' });
    }

    const body = req.body as StandupRequest;

    const { text } = await generateText({
      model: requireAiModel(aiConfig),
      prompt: buildPrompt(body.items, body.today, body.plans, body.notes),
    });

    return res.json(parseResponse(text));
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Standup error:', err);
    return res.status(500).json({ error: 'Failed to generate summary. Check your API key in Settings.' });
  }
}
