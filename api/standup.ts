import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

import { AuthError, verifyRequest } from './_lib/auth.js';
import { getSettings } from './_lib/kv.js';

interface LogEntry {
  project: string;
  task: string;
  duration: string;
  description?: string;
}

interface DayEntry {
  date: string;
  dayOfWeek: string;
  logs: LogEntry[];
}

interface StandupRequest {
  entries: DayEntry[];
  today: string;
}

function buildPrompt(entries: DayEntry[], today: string): string {
  const entriesText = entries
    .map(
      (e) =>
        `${e.date} (${e.dayOfWeek})\n${e.logs
          .map((l) => `  ${l.project} / ${l.task} / ${l.duration}${l.description ? ` — ${l.description}` : ''}`)
          .join('\n')}`,
    )
    .join('\n\n');

  return `You are helping a developer review their recent work for a standup.
Here are their time log entries grouped by date:

${entriesText}

Summarize weekday entries in 2-3 groups max, grouped by project or theme across dates. Short past-tense bullets, 1 line each, max 3 bullets per group.
If there are Saturday or Sunday entries, collect all weekend work into a single "## Weekend" group placed after the weekday groups.
If there are entries for today (${today}), put them in a final "## Today" group (present tense).
No intro or outro. Return only markdown using: ## Group Name, then - bullet.`;
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
      prompt: buildPrompt(body.entries, body.today),
    });

    return res.json({ markdown: text });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Standup error:', err);
    return res.status(500).json({ error: 'Failed to generate summary. Check your API key in Settings.' });
  }
}
