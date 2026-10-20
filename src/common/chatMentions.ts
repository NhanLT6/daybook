/**
 * Project / task mentions in the chat composer: `/` at the start of the message or after a space opens
 * a menu of the user's projects, tasks and Jira tickets; a pick is inserted as plain text (`DS-123 Login bug`,
 * `Project › Task`) and drawn as a quiet chip. Pure helpers, shared by the composer and the message bubbles.
 */

export interface ChatMention {
  label: string; // inserted text, and what the chip matches
  kind: 'project' | 'task' | 'ticket'; // ticket: synced from an issue tracker (Jira today), one generic icon for any tracker
  project: string;
  task?: string;
}

export const TASK_SEPARATOR = ' › ';

// A query this long is ordinary text that happens to follow a `/`, not a mention
const MAX_QUERY = 40;

/** Accent- and case-insensitive form for matching: "Đào tạo" → "dao tao". */
export const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/**
 * The mention being typed at the caret: the latest `/` that starts the text or follows whitespace,
 * up to the caret. `10/20`, `and/or` and URLs don't count; neither does a query spanning a line break.
 */
export function findMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  for (let i = before.lastIndexOf('/'); i >= 0; i = before.lastIndexOf('/', i - 1)) {
    if (i > 0 && !/\s/.test(before[i - 1])) continue;
    const query = before.slice(i + 1);
    if (query.includes('\n') || query.length > MAX_QUERY || /^\s/.test(query)) return null;
    return { start: i, query };
  }
  return null;
}

// Where each word begins: after a space, `-`, `›` or other non-alphanumeric character
const wordStarts = (text: string) =>
  [...text.matchAll(/(?<![\p{L}\p{N}])[\p{L}\p{N}]/gu)].map((m) => m.index);

/**
 * Mentions whose label starts with the query, then those with a word starting with it
 * (`/login` → "DS-123 Login bug", `/123` → "DS-123 …"). Keeps the given order within each group.
 */
export function matchMentions(mentions: ChatMention[], query: string, limit: number): ChatMention[] {
  const q = foldText(query.trim());
  if (!q) return mentions.slice(0, limit);
  const starts: ChatMention[] = [];
  const words: ChatMention[] = [];
  for (const m of mentions) {
    const label = foldText(m.label);
    if (label.startsWith(q) || (m.task && foldText(m.task).startsWith(q))) starts.push(m);
    else if (wordStarts(label).some((at) => label.startsWith(q, at))) words.push(m);
  }
  return [...starts, ...words].slice(0, limit);
}

/**
 * Splits text into plain runs and mention runs. A label only counts as a whole: bounded by the text's
 * edges, whitespace or punctuation, so a project named "Retro" doesn't light up inside "retrospective".
 */
export function splitMentions(text: string, labels: string[]): Array<{ text: string; mention: boolean }> {
  const sorted = [...new Set(labels)].filter(Boolean).sort((a, b) => b.length - a.length); // longest first
  const parts: Array<{ text: string; mention: boolean }> = [];
  const isEdge = (ch: string | undefined) => ch === undefined || /[\s.,;:!?()]/.test(ch);
  let plain = '';
  let i = 0;
  while (i < text.length) {
    const label = isEdge(text[i - 1])
      ? sorted.find((l) => text.startsWith(l, i) && isEdge(text[i + l.length]))
      : undefined;
    if (label) {
      if (plain) parts.push({ text: plain, mention: false });
      parts.push({ text: label, mention: true });
      plain = '';
      i += label.length;
    } else {
      plain += text[i];
      i++;
    }
  }
  if (plain) parts.push({ text: plain, mention: false });
  return parts;
}
