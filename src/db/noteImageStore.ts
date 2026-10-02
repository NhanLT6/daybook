import type { IDBPDatabase } from 'idb';

import { openDB } from 'idb';

// Pasted note images live in their own database, as Blobs keyed by id; note HTML only holds
// `<img data-image-id>`. Kept out of the main 'daybook' DB on purpose: its snapshot()/getAll paths
// load whole stores into memory, and every notes reload would drag the image bytes along.
export interface NoteImageRecord {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number; // epoch ms, used by the orphan sweep's grace period
}

const DB_NAME = 'daybook-images';
const STORE = 'images';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function putNoteImages(records: NoteImageRecord[]): Promise<void> {
  const tx = (await getDb()).transaction(STORE, 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

export async function getNoteImage(id: string): Promise<NoteImageRecord | undefined> {
  return (await getDb()).get(STORE, id);
}

export async function getAllNoteImages(): Promise<NoteImageRecord[]> {
  return (await getDb()).getAll(STORE);
}

// Ids only (no blobs read) of images created before `cutoff`.
export async function getNoteImageIdsBefore(cutoff: number): Promise<string[]> {
  const keys = await (await getDb()).getAllKeysFromIndex(STORE, 'createdAt', IDBKeyRange.upperBound(cutoff, true));
  return keys as string[];
}

export async function deleteNoteImages(ids: string[]): Promise<void> {
  const tx = (await getDb()).transaction(STORE, 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}
