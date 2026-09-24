import type { SearchNotesInput, SearchNotesOutput } from '@/interfaces/aiTools';
import type { Note } from '@/interfaces/Note';

import dayjs from 'dayjs';

// Keeps the tool result small enough to send back to the model on every notes question
const MAX_TOTAL_CHARS = 12000;
const MAX_NOTE_CHARS = 3000;

/** Tiptap HTML → plain text the model can read. Checklist items keep their ticked state. */
export function noteToPlainText(html: string): string {
  // Inert document: no scripts run, no resources load
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('li').forEach((li) => {
    const checked = li.getAttribute('data-checked');
    li.prepend(checked === 'true' ? '[x] ' : checked === 'false' ? '[ ] ' : '- ');
  });
  doc.querySelectorAll('p, h1, h2, h3, li, blockquote, pre').forEach((el) => el.append('\n'));
  return (doc.body.textContent ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Ranks notes by how many query words they contain, then pinned, then most recently edited,
 * and returns as many as fit the budget. Non-matching notes are still included when there is
 * room: quick notes use shorthand, so the model decides relevance, not the keyword match.
 */
export function searchNotes(notes: Note[], { query }: SearchNotesInput): SearchNotesOutput {
  const words = (query ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 2);

  const ranked = notes
    .map((note) => {
      const text = noteToPlainText(note.content);
      const lower = text.toLowerCase();
      return { note, text, score: words.filter((w) => lower.includes(w)).length };
    })
    .filter((r) => r.text)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(!!b.note.pinned) - Number(!!a.note.pinned) ||
        b.note.updatedAt - a.note.updatedAt,
    );

  const result: SearchNotesOutput['notes'] = [];
  let used = 0;
  for (const { note, text } of ranked) {
    const clipped = text.length > MAX_NOTE_CHARS ? `${text.slice(0, MAX_NOTE_CHARS)}…` : text;
    if (used + clipped.length > MAX_TOTAL_CHARS) break;
    used += clipped.length;
    result.push({ updated: dayjs(note.updatedAt).format('YYYY-MM-DD'), pinned: !!note.pinned, text: clipped });
  }

  return { totalNotes: ranked.length, notes: result };
}

const MAX_OPEN_ITEMS = 20;

/**
 * The open part of the notes, for Catch-up: unticked checklist items and question lines
 * ("...?") that are not ticked. Pinned notes first, then most recently edited. Small enough
 * to send with every Catch-up, unlike the full notes.
 */
export function openNoteItems(notes: Note[]): string[] {
  const items: string[] = [];
  const sorted = [...notes].sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt,
  );
  for (const note of sorted) {
    for (const line of noteToPlainText(note.content).split('\n')) {
      if (line.startsWith('[ ] ')) items.push(line.slice(4).trim());
      else if (!line.startsWith('[x] ') && line.trim().endsWith('?')) items.push(line.replace(/^- /, '').trim());
    }
  }
  return items.filter(Boolean).slice(0, MAX_OPEN_ITEMS);
}
