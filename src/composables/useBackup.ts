import dayjs from 'dayjs';

import { saveAs } from 'file-saver';

import { db } from '@/db';
import { COLLECTION_NAMES, type DbSnapshot } from '@/db/types';

// Narrow an unknown parsed JSON value into a DbSnapshot before trusting it as a restore source.
function isSnapshot(x: unknown): x is DbSnapshot {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  if (typeof s.schemaVersion !== 'number' || !s.collections || typeof s.collections !== 'object') return false;
  const cols = s.collections as Record<string, unknown>;
  return COLLECTION_NAMES.every((c) => Array.isArray(cols[c]));
}

export function useBackup() {
  const exportBackup = async () => {
    const snap = await db.export();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `daybook-backup-${dayjs().format('YYYY-MM-DD')}.json`);
  };

  const importBackup = async (file: File) => {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isSnapshot(parsed)) throw new Error('Invalid backup file');
    await db.import(parsed);
  };

  return { exportBackup, importBackup };
}
