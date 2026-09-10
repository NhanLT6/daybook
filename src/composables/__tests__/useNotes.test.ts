import { beforeEach, describe, expect, it } from 'vitest';

import { db, initDb } from '@/db';
import { useCollection } from '@/composables/useCollection';
import { useNotes } from '@/composables/useNotes';

const note = (id: string, order: number) => ({
  id,
  content: `<p>${id}</p>`,
  order,
  createdAt: 0,
  updatedAt: 0,
});

describe('useNotes', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
    await useCollection('notes').clear();
  });

  it('returns notes sorted by order', async () => {
    const { notes, saveNote } = useNotes();
    await saveNote(note('b', 2));
    await saveNote(note('a', 1));
    await saveNote(note('c', 3));
    expect(notes.value.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('nextTopOrder yields a value smaller than all existing orders', async () => {
    const { saveNote, nextTopOrder } = useNotes();
    await saveNote(note('a', 5));
    await saveNote(note('b', 1));
    expect(nextTopOrder()).toBeLessThan(1);
  });

  it('nextTopOrder is sensible when there are no notes yet', () => {
    const { nextTopOrder } = useNotes();
    expect(nextTopOrder()).toBe(-1);
  });

  it('reorder persists the new order', async () => {
    const { notes, saveNote, reorder } = useNotes();
    await saveNote(note('a', 0));
    await saveNote(note('b', 1));
    await saveNote(note('c', 2));

    await reorder(['c', 'a', 'b']);
    expect(notes.value.map((n) => n.id)).toEqual(['c', 'a', 'b']);

    // Re-read straight from the db (bypassing the composable's reactive cache) to
    // confirm the new order was actually persisted, not just reflected in memory.
    const persisted = (await db.notes.all()).sort((x, y) => x.order - y.order);
    expect(persisted.map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('removeNote then saveNote with the snapshot restores the note', async () => {
    const { notes, saveNote, removeNote } = useNotes();
    const n = note('a', 0);
    await saveNote(n);
    expect(notes.value.map((x) => x.id)).toContain('a');

    await removeNote('a');
    expect(notes.value.map((x) => x.id)).not.toContain('a');

    await saveNote(n);
    expect(notes.value).toContainEqual(n);
  });
});
