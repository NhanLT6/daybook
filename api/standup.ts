import type { VercelRequest, VercelResponse } from '@vercel/node';

import { generateText } from 'ai';

import { AuthError, verifyRequest } from './_lib/auth.js';
import { isAiEnabled, requireAiModel } from './_lib/ai.js';

interface RequestLog {
  task: string;
  description?: string;
  duration: string;
}

interface RequestItem {
  id: string;
  project: string;
  logs: RequestLog[];
}

interface RequestPlanTask {
  task: string;
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
  today: string;
}

function buildPrompt(items: RequestItem[], today: string, plans?: RequestPlan[]): string {
  const hasDid = items.length > 0;
  const hasTodo = plans && plans.length > 0;

  const didSection = hasDid
    ? items
        .map(
          (it) =>
            `id: ${it.id}\nproject: ${it.project}\n${it.logs
              .map((l) => `  - ${l.task}${l.description ? `: ${l.description}` : ''} (${l.duration})`)
              .join('\n')}`,
        )
        .join('\n\n')
    : '';

  const todoSection = hasTodo
    ? plans!
        .map(
          (p) =>
            `id: ${p.id}\nproject: ${p.project}\n${p.tasks
              .map((t) => `  - ${t.task}${t.description ? `: ${t.description}` : ''}`)
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

  const responseShape = hasTodo
    ? '{"lines":[{"id":"<id>","text":"<sentence>"}],"todoLines":[{"id":"<id>","text":"<sentence>"}]}'
    : '{"lines":[{"id":"<id>","text":"<sentence>"}]}';

  return `You are helping a developer write a standup update. Today is ${today}.
${hasDid ? `\nDid (recent work):\n${didSection}` : ''}
${hasTodo ? `\nTodo (plans for today):\n${todoSection}` : ''}

${didInstruction}
${todoInstruction}
Return STRICT JSON only — no markdown, no code fences, no extra prose:
${responseShape}
with exactly one entry per block in each array, echoing each block's "id" value unchanged.`;
}

function parseResponse(raw: string): { lines: { id: string; text: string }[]; todoLines: { id: string; text: string }[] } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { lines?: { id: string; text: string }[]; todoLines?: { id: string; text: string }[] };
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      todoLines: Array.isArray(parsed.todoLines) ? parsed.todoLines : [],
    };
  } catch {
    return { lines: [], todoLines: [] };
  }
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

    if (!isAiEnabled()) {
      return res.status(400).json({ error: 'AI is not configured on this deployment.' });
    }

    const body = req.body as StandupRequest;

    const { text } = await generateText({
      model: requireAiModel(),
      prompt: buildPrompt(body.items, body.today, body.plans),
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
