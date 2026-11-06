import { useBackup } from '@/composables/useBackup';

import type { NoteImageRecord } from '@/db/noteImageStore';

import { db, initDb } from '@/db';
import { deleteNoteImages, getNoteImage, putNoteImages } from '@/db/noteImageStore';
import { useSettingsStore } from '@/stores/settings';
import { saveAs } from 'file-saver';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
// In-memory image store: fake-indexeddb can't structured-clone jsdom Blobs (real browsers store them natively)
vi.mock('@/db/noteImageStore', () => {
  const images = new Map<string, NoteImageRecord>();
  return {
    putNoteImages: async (records: NoteImageRecord[]) => records.forEach((r) => images.set(r.id, r)),
    getNoteImage: async (id: string) => images.get(id),
    getAllNoteImages: async () => [...images.values()],
    deleteNoteImages: async (ids: string[]) => ids.forEach((id) => images.delete(id)),
  };
});

describe('useBackup', () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await initDb();
    await db.events.clear();
  });

  it('importBackup replaces the store from a snapshot file', async () => {
    const snap = {
      schemaVersion: 1,
      collections: {
        timeLogs: [],
        projects: [],
        tasks: [],
        pinnedProjects: [],
        categories: [],
        events: [{ id: 'e', title: 'X', date: '2026-01-01', type: 'custom' }],
      },
    };
    const file = new File([JSON.stringify(snap)], 'backup.json', { type: 'application/json' });
    await useBackup().importBackup(file);
    expect(await db.events.all()).toEqual([{ id: 'e', title: 'X', date: '2026-01-01', type: 'custom' }]);
  });
});

// jsdom's Blob has no text()/arrayBuffer(); FileReader works everywhere
const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });

describe('useBackup note images', () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await initDb();
  });

  it('round-trips note images through export and import', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 1, 2]);
    await putNoteImages([
      { id: 'img_1', blob: new Blob([bytes], { type: 'image/png' }), width: 10, height: 5, createdAt: 1 },
    ]);

    await useBackup().exportBackup();
    const exported = vi.mocked(saveAs).mock.calls.at(-1)![0] as Blob;
    const json = JSON.parse(new TextDecoder().decode(await readBlob(exported)));
    expect(json.noteImages).toEqual([
      { id: 'img_1', type: 'image/png', width: 10, height: 5, createdAt: 1, data: btoa(String.fromCharCode(...bytes)) },
    ]);

    await deleteNoteImages(['img_1']);
    await useBackup().importBackup(new File([JSON.stringify(json)], 'backup.json'));
    const restored = await getNoteImage('img_1');
    expect(restored).toMatchObject({ id: 'img_1', width: 10, height: 5, createdAt: 1 });
    expect(restored!.blob.type).toBe('image/png');
    expect(new Uint8Array(await readBlob(restored!.blob))).toEqual(bytes);
  });

  it('skips malformed image entries but still restores the rest', async () => {
    const snap = {
      schemaVersion: 2,
      collections: { timeLogs: [], projects: [], tasks: [], pinnedProjects: [], categories: [], events: [] },
      noteImages: [{ id: 'bad id"', type: 'image/png', width: 1, height: 1, createdAt: 1, data: '' }, 'junk'],
    };
    await useBackup().importBackup(new File([JSON.stringify(snap)], 'backup.json'));
    expect(await getNoteImage('bad id"')).toBeUndefined();
  });
});

describe('useBackup settings', () => {
  const emptySnapshot = {
    schemaVersion: 2,
    collections: { timeLogs: [], projects: [], tasks: [], pinnedProjects: [], categories: [], events: [] },
  };
  const importWith = (extra: object) =>
    useBackup().importBackup(new File([JSON.stringify({ ...emptySnapshot, ...extra })], 'backup.json'));

  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await initDb();
  });

  it('exports preferences but not the transient last selected date', async () => {
    const store = useSettingsStore();
    store.dailyTargetHours = 6;
    store.weekendDays = [6, 0];
    localStorage.setItem('app-theme', 'dark');

    await useBackup().exportBackup();
    const exported = vi.mocked(saveAs).mock.calls.at(-1)![0] as Blob;
    const json = JSON.parse(new TextDecoder().decode(await readBlob(exported)));

    expect(json.settings).toMatchObject({ dailyTargetHours: 6, weekendDays: [6, 0], showGarden: false, theme: 'dark' });
    expect(json.settings).not.toHaveProperty('lastSelectedDate');
    expect(json.settings).not.toHaveProperty('jiraConfig');
  });

  it('applies valid settings through the store and the theme ref', async () => {
    const store = useSettingsStore();

    await importWith({
      settings: {
        dailyTargetHours: 5,
        showGarden: false,
        weekendDays: [6],
        backgroundImageMode: 'tile',
        backgroundBlur: 0.2,
        theme: 'dark',
      },
    });

    expect(store.dailyTargetHours).toBe(5);
    expect(store.showGarden).toBe(false);
    expect(store.weekendDays).toEqual([6]);
    expect(store.backgroundImageMode).toBe('tile');
    expect(store.backgroundBlur).toBe(0.2);
    expect(localStorage.getItem('app-theme')).toBe('dark');
  });

  it('ignores wrong-typed values and unknown keys', async () => {
    const store = useSettingsStore();

    await importWith({
      settings: {
        dailyTargetHours: '5',
        showGarden: 'no',
        weekendDays: [9],
        backgroundImageMode: 'diagonal',
        dateDisplayFormat: 3,
        theme: 'blue',
        somethingElse: 1,
      },
    });

    expect(store.dailyTargetHours).toBe(8);
    expect(store.showGarden).toBe(false);
    expect(store.weekendDays).toEqual([5, 6, 0]);
    expect(store.backgroundImageMode).toBe('cover');
    expect(store.dateDisplayFormat).toBe('MM/DD/YYYY');
    expect(localStorage.getItem('app-theme')).toBe('light');
    expect(localStorage.getItem('somethingElse')).toBeNull();
  });

  it('imports an old backup without settings and keeps current preferences', async () => {
    const store = useSettingsStore();
    store.dailyTargetHours = 7;

    await importWith({});

    expect(store.dailyTargetHours).toBe(7);
  });
});
