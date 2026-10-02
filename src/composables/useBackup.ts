import type { NoteImageRecord } from '@/db/noteImageStore';
import type { CollectionName, DbSnapshot } from '@/db/types';

import dayjs from 'dayjs';

import { db } from '@/db';
import { getAllNoteImages, putNoteImages } from '@/db/noteImageStore';
import { COLLECTION_NAMES } from '@/db/types';
import { saveAs } from 'file-saver';

// Collections added after the initial release: old backups genuinely lack them.
const ADDED_LATER = new Set<CollectionName>(['notes']);

// Note images ride along as base64, outside `collections` (they live in their own database).
interface BackupImage {
  id: string;
  type: string;
  width: number;
  height: number;
  createdAt: number;
  data: string; // base64
}

type BackupFile = DbSnapshot & { noteImages?: BackupImage[] };

// Narrow an unknown parsed JSON value into a DbSnapshot before trusting it as a restore source.
function isSnapshot(x: unknown): x is BackupFile {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  if (typeof s.schemaVersion !== 'number' || !s.collections || typeof s.collections !== 'object') return false;
  const cols = s.collections as Record<string, unknown>;
  return COLLECTION_NAMES.every((c) => Array.isArray(cols[c]) || (ADDED_LATER.has(c) && cols[c] === undefined));
}

function isBackupImage(x: unknown): x is BackupImage {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    /^[\w-]{1,64}$/.test(i.id) &&
    typeof i.type === 'string' &&
    i.type.startsWith('image/') &&
    typeof i.width === 'number' &&
    typeof i.height === 'number' &&
    typeof i.createdAt === 'number' &&
    typeof i.data === 'string'
  );
}

async function toBackupImage({ blob, id, width, height, createdAt }: NoteImageRecord): Promise<BackupImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { id, type: blob.type, width, height, createdAt, data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

function fromBackupImage({ data, type, ...rest }: BackupImage): NoteImageRecord {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { ...rest, blob: new Blob([bytes], { type }) };
}

export function useBackup() {
  const exportBackup = async () => {
    const snap = await db.export();
    const noteImages = await Promise.all((await getAllNoteImages()).map(toBackupImage));
    const file: BackupFile = { ...snap, noteImages };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `daybook-backup-${dayjs().format('YYYY-MM-DD')}.json`);
  };

  const importBackup = async (file: File) => {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isSnapshot(parsed)) throw new Error('Invalid backup file');
    const { noteImages, ...snapshot } = parsed;
    // Images are added, not replaced: ones the restored notes don't use are swept later (useNoteImages)
    const images = Array.isArray(noteImages) ? noteImages.filter(isBackupImage).map(fromBackupImage) : [];
    if (images.length) await putNoteImages(images);
    await db.import(snapshot);
  };

  return { exportBackup, importBackup };
}
