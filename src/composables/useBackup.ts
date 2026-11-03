import type { NoteImageRecord } from '@/db/noteImageStore';
import type { CollectionName, DbSnapshot } from '@/db/types';

import dayjs from 'dayjs';

import { storageKeys } from '@/common/storageKeys';
import { db } from '@/db';
import { getAllNoteImages, putNoteImages } from '@/db/noteImageStore';
import { COLLECTION_NAMES } from '@/db/types';
import { backgroundModeOptions, useSettingsStore } from '@/stores/settings';
import { useStorage } from '@vueuse/core';
import { saveAs } from 'file-saver';
import { storeToRefs } from 'pinia';

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

type BackupFile = DbSnapshot & { noteImages?: BackupImage[]; settings?: Record<string, unknown> };

// The preferences a backup carries, by backup key: the single list behind export and import.
// Left out on purpose: lastSelectedDate (transient) and Jira/AI configs (server-side secrets).
function backedUpSettings() {
  // storeToRefs keeps them as refs (the store itself unwraps them)
  const refs = storeToRefs(useSettingsStore());
  return {
    dateDisplayFormat: refs.dateDisplayFormat,
    firstDayOfWeek: refs.firstDayOfWeek,
    weekendDays: refs.weekendDays,
    dailyTargetEnabled: refs.dailyTargetEnabled,
    dailyTargetHours: refs.dailyTargetHours,
    useDefaultTasks: refs.useDefaultTasks,
    useCategories: refs.useCategories,
    rememberLastSelectedDate: refs.rememberLastSelectedDate,
    showGarden: refs.showGarden,
    gardenLayout: refs.gardenLayout,
    backgroundUrl: refs.backgroundUrl,
    backgroundImageMode: refs.backgroundImageMode,
    backgroundBlur: refs.backgroundBlur,
    // Same key as App.vue, so useStorage keeps both refs in sync and the app applies the new theme
    theme: useStorage<string>(storageKeys.settings.theme, 'light'),
  };
}

// Accept a value only if it has the type of the current one; a few settings are narrower than their type
function isValidSetting(key: string, value: unknown, current: unknown): boolean {
  if (key === 'weekendDays') return Array.isArray(value) && value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (key === 'backgroundImageMode') return backgroundModeOptions.some((o) => o.value === value);
  if (key === 'theme') return value === 'light' || value === 'dark';
  if (typeof current === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === typeof current;
}

// Writes go through the store refs so the open tab updates immediately; unknown or invalid keys are skipped
function applySettings(settings: unknown) {
  if (!settings || typeof settings !== 'object') return;
  const incoming = settings as Record<string, unknown>;

  for (const [key, ref] of Object.entries(backedUpSettings())) {
    if (key in incoming && isValidSetting(key, incoming[key], ref.value)) {
      (ref as { value: unknown }).value = incoming[key];
    }
  }
}

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
    const settings = Object.fromEntries(Object.entries(backedUpSettings()).map(([key, ref]) => [key, ref.value]));
    const file: BackupFile = { ...snap, noteImages, settings };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `daybook-backup-${dayjs().format('YYYY-MM-DD')}.json`);
  };

  const importBackup = async (file: File) => {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isSnapshot(parsed)) throw new Error('Invalid backup file');
    const { noteImages, settings, ...snapshot } = parsed;
    // Images are added, not replaced: ones the restored notes don't use are swept later (useNoteImages)
    const images = Array.isArray(noteImages) ? noteImages.filter(isBackupImage).map(fromBackupImage) : [];
    if (images.length) await putNoteImages(images);
    await db.import(snapshot);
    applySettings(settings);
  };

  return { exportBackup, importBackup };
}
