import { describe, expect, it } from 'vitest';

import type { Note } from '@/interfaces/Note';

import { noteToPlainText, searchNotes } from '@/common/searchNotes';

const note = (id: string, content: string, extra: Partial<Note> = {}): Note => ({
  id,
  content,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const taskItem = (text: string, checked: boolean) =>
  `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${text}</p></div></li>`;

describe('noteToPlainText', () => {
  it('keeps checklist state as [ ] / [x] lines', () => {
    const html = `<p>ask BA abt login redirect?</p><ul data-type="taskList">${taskItem('ping PM', false)}${taskItem('write test', true)}</ul>`;
    expect(noteToPlainText(html)).toBe('ask BA abt login redirect?\n[ ] ping PM\n[x] write test');
  });

  it('turns bullets and line breaks into lines', () => {
    expect(noteToPlainText('<p>a<br>b</p><ul><li><p>c</p></li></ul><ol><li><p>d</p></li></ol>')).toBe(
      'a\nb\n- c\n- d',
    );
  });

  it('does not run scripts or keep markup', () => {
    expect(noteToPlainText('<p>hi<script>window.x=1</script><img src=x onerror="window.y=1"></p>')).toBe(
      'hi',
    );
    expect((window as unknown as { y?: number }).y).toBeUndefined();
  });
});

describe('searchNotes', () => {
  it('ranks notes that match query words first, then pinned, then most recent', () => {
    const notes = [
      note('old', '<p>lunch</p>', { updatedAt: 1 }),
      note('pinned', '<p>standup</p>', { pinned: true, updatedAt: 0 }),
      note('match', '<p>login redirect bug</p>', { updatedAt: 0 }),
      note('recent', '<p>coffee</p>', { updatedAt: 5 }),
    ];
    const { notes: out, totalNotes } = searchNotes(notes, { query: 'Login?' });
    expect(totalNotes).toBe(4);
    expect(out.map((n) => n.text)).toEqual(['login redirect bug', 'standup', 'coffee', 'lunch']);
  });

  it('still returns non-matching notes so the model can match shorthand by meaning', () => {
    const { notes } = searchNotes([note('a', '<p>ask BA abt login</p>')], { query: 'auth bug' });
    expect(notes).toHaveLength(1);
  });

  it('skips empty notes and reports date and pinned flag', () => {
    const updatedAt = new Date(2026, 8, 24, 10).getTime();
    const { notes, totalNotes } = searchNotes([note('e', '<p></p>'), note('a', '<p>x</p>', { updatedAt })], {});
    expect(totalNotes).toBe(1);
    expect(notes[0]).toEqual({ updated: '2026-09-24', pinned: false, text: 'x' });
  });

  it('stops at the size budget and clips very long notes', () => {
    const long = `<p>${'a'.repeat(5000)}</p>`;
    const { notes } = searchNotes(
      Array.from({ length: 10 }, (_, i) => note(String(i), long)),
      {},
    );
    expect(notes[0].text).toHaveLength(3001);
    expect(notes.length).toBe(3);
  });
});
