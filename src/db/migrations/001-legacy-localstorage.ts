import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { isoDateFormat, shortDateFormat } from '@/common/DateFormat';

import type { StorageAdapter } from '@/db/types';

dayjs.extend(customParseFormat);

// Collect every legacy per-month key of a given prefix, newest first is irrelevant here.
function legacyKeys(prefix: string): string[] {
  const re = new RegExp(`^${prefix}-\\d{4}-\\d{2}$`);
  return Object.keys(localStorage).filter((k) => re.test(k));
}

function readArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

// Legacy dates were stored as MM/DD/YYYY (shortDateFormat); some newer rows may already be ISO.
function toIso(date: string): string {
  const asShort = dayjs(date, shortDateFormat, true);
  if (asShort.isValid()) return asShort.format(isoDateFormat);
  const asIso = dayjs(date, isoDateFormat, true);
  if (asIso.isValid()) return asIso.format(isoDateFormat);
  const loose = dayjs(date);
  return loose.isValid() ? loose.format(isoDateFormat) : date;
}

export async function migrateLegacyLocalStorage(adapter: StorageAdapter): Promise<void> {
  // timeLogs: union all months, normalize dates, dedup by id
  const logsById = new Map<string, Record<string, unknown>>();
  for (const key of legacyKeys('timeLogs')) {
    for (const log of readArray<Record<string, unknown>>(key)) {
      const id = String(log.id);
      logsById.set(id, { ...log, id, date: toIso(String(log.date)) });
    }
  }
  if (logsById.size) await adapter.putMany('timeLogs', [...logsById.values()] as never);

  // projects: dedup by title, id = title
  const projectsByTitle = new Map<string, Record<string, unknown>>();
  for (const key of legacyKeys('projects')) {
    for (const p of readArray<Record<string, unknown>>(key)) {
      const title = String(p.title);
      projectsByTitle.set(title, { ...p, id: title });
    }
  }
  if (projectsByTitle.size) await adapter.putMany('projects', [...projectsByTitle.values()] as never);

  // tasks: dedup by project+title, id = `${project}::${title}`
  const tasksByKey = new Map<string, Record<string, unknown>>();
  for (const key of legacyKeys('tasks')) {
    for (const t of readArray<Record<string, unknown>>(key)) {
      const id = `${String(t.project)}::${String(t.title)}`;
      tasksByKey.set(id, { ...t, id });
    }
  }
  if (tasksByKey.size) await adapter.putMany('tasks', [...tasksByKey.values()] as never);

  // pinnedProjects: unique titles -> { id: title }
  const pins = new Set<string>();
  for (const key of legacyKeys('pinnedProjects')) for (const title of readArray<string>(key)) pins.add(title);
  if (pins.size) await adapter.putMany('pinnedProjects', [...pins].map((id) => ({ id })) as never);

  // categories + events: already global keys, copy straight over
  const categories = readArray<Record<string, unknown>>('categories');
  if (categories.length) await adapter.putMany('categories', categories as never);
  const events = readArray<Record<string, unknown>>('events');
  if (events.length) await adapter.putMany('events', events as never);

  // jiraProjects-* is a regenerable cache — intentionally skipped.
  // Legacy keys are intentionally left intact as a backup.
}
