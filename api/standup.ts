import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

import { AuthError, verifyRequest } from './_lib/auth.js';
import { getSettings } from './_lib/kv.js';

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

interface StandupRequest {
  items: RequestItem[];
  today: string;
}

function buildPrompt(items: RequestItem[], today: string): string {
  const itemsText = items
    .map(
      (it) =>
        `id: ${it.id}\nproject: ${it.project}\n${it.logs
          .map((l) => `  - ${l.task}${l.description ? `: ${l.description}` : ''} (${l.duration})`)
          .join('\n')}`,
    )
    .join('\n\n');

  return `You are helping a developer recap recent work for a standup. Today is ${today}.
Each block below is one project the developer worked on. "id" is a reference key, "project" is the display label. The indented sub-lines are tasks/notes done under it.

${itemsText}

For each block, write ONE concise past-tense sentence describing what was done, merging the sub-lines.
Start the sentence with the "project" value exactly as given — do not include the "id" value in the sentence text.
Return STRICT JSON only — no markdown, no code fences, no extra prose:
{"lines":[{"id":"<id>","text":"<sentence>"}]}
with exactly one entry per block, echoing each block's "id" value unchanged.`;
}

function parseLines(raw: string): { id: string; text: string }[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { lines?: { id: string; text: string }[] };
    return Array.isArray(parsed.lines) ? parsed.lines : [];
  } catch {
    return [];
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

    const settings = await getSettings(machineId);
    if (!settings.geminiConfig.enabled || !settings.geminiConfig.apiKey) {
      return res.status(400).json({ error: 'AI Assistant is not configured.' });
    }

    const body = req.body as StandupRequest;
    const google = createGoogleGenerativeAI({ apiKey: settings.geminiConfig.apiKey });

    const { text } = await generateText({
      model: google(settings.geminiConfig.model),
      prompt: buildPrompt(body.items, body.today),
    });

    return res.json({ lines: parseLines(text) });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Standup error:', err);
    return res.status(500).json({ error: 'Failed to generate summary. Check your API key in Settings.' });
  }
}
