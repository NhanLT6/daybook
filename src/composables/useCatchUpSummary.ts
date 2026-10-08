import type { CatchUpRenderItem } from '@/interfaces/CatchUp';
import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { httpClient } from '@/apis/httpClient';
import { shortDateFormat } from '@/common/DateFormat';
import { openNoteItems } from '@/common/searchNotes';
import { storageKeys } from '@/common/storageKeys';
import { db } from '@/db';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { authHeaders } from './useAuth';

dayjs.extend(customParseFormat);

const DEFAULT_MINUTES_PER_DAY = 8 * 60; // for the "Xd Yh" effort metric; the user's daily target overrides it
const LONG_RUNNING_THRESHOLD_MINUTES = 15 * 60; // 15h accumulated effort
const LOOKBACK_WORKING_DAYS = 15; // rolling window for accumulation (~3 weeks)

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function deriveItemId(project: string): string {
  return hashString(project);
}

/** "Xd Yh" with a day as long as the daily target; plain hours when there's no target (no limit). */
export function formatEffort(minutes: number, minutesPerDay: number | null = DEFAULT_MINUTES_PER_DAY): string {
  const totalHours = Math.round(minutes / 60);
  if (!minutesPerDay) return `${totalHours}h`;
  const hoursPerDay = minutesPerDay / 60;
  const days = Math.floor(totalHours / hoursPerDay);
  const hours = Math.round(totalHours - days * hoursPerDay);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (!parts.length) parts.push('0h');
  return parts.join(' ');
}

export interface CatchUpItem {
  id: string;
  project: string;
  logs: { task?: string; description?: string; duration: number }[];
  windowMinutes: number;
  accumulatedMinutes: number;
  ongoing: boolean;
}

interface RequestPlan {
  id: string;
  project: string;
  tasks: { task?: string; description?: string }[];
}

export type { CatchUpRenderItem };

export function buildCatchUpItems(didLogs: TimeLog[], accumulated: Map<string, number>): CatchUpItem[] {
  const byProject = new Map<string, TimeLog[]>();
  for (const log of didLogs) {
    if (!byProject.has(log.project)) byProject.set(log.project, []);
    byProject.get(log.project)!.push(log);
  }

  const ranked = Array.from(byProject.entries()).map(([project, logs]) => {
    const windowMinutes = logs.reduce((sum, l) => sum + (l.duration ?? 0), 0);
    const accumulatedMinutes = accumulated.get(project) ?? windowMinutes;
    const latest = logs.reduce((max, l) => (l.date > max ? l.date : max), '');
    const item: CatchUpItem = {
      id: deriveItemId(project),
      project,
      logs: logs.map((l) => ({ task: l.task, description: l.description, duration: l.duration ?? 0 })),
      windowMinutes,
      accumulatedMinutes,
      ongoing: accumulatedMinutes >= LONG_RUNNING_THRESHOLD_MINUTES,
    };
    return { item, latest };
  });

  ranked.sort((a, b) => {
    const byMinutes = b.item.windowMinutes - a.item.windowMinutes;
    if (byMinutes !== 0) return byMinutes;
    if (b.latest > a.latest) return 1;
    if (b.latest < a.latest) return -1;
    return 0;
  });

  return ranked.map((r) => r.item);
}

export function accumulateMinutesByProject(logs: TimeLog[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const log of logs) {
    totals.set(log.project, (totals.get(log.project) ?? 0) + (log.duration ?? 0));
  }
  return totals;
}

export function applyLines(
  items: CatchUpItem[],
  lines: { id: string; text: string }[],
  minutesPerDay: number | null = DEFAULT_MINUTES_PER_DAY,
): CatchUpRenderItem[] {
  const textById = new Map(lines.map((l) => [l.id, l.text]));
  return items.map((item) => ({
    project: item.project,
    text: textById.get(item.id) ?? item.project,
    ongoing: item.ongoing,
    effortLabel: item.ongoing ? formatEffort(item.accumulatedMinutes, minutesPerDay) : undefined,
  }));
}

function parseLogDate(value: string): dayjs.Dayjs | null {
  const internal = dayjs(value, shortDateFormat, true);
  if (internal.isValid()) return internal;

  const iso = dayjs(value, 'YYYY-MM-DD', true);
  if (iso.isValid()) return iso;

  const fallback = dayjs(value);
  return fallback.isValid() ? fallback : null;
}

async function allLogs(): Promise<TimeLog[]> {
  return db.timeLogs.all();
}

function collectLogsFromArray(all: TimeLog[], rangeStart: dayjs.Dayjs, today: dayjs.Dayjs): TimeLog[] {
  return all.filter((log) => {
    const d = parseLogDate(log.date)?.startOf('day');
    return !!d && d.valueOf() >= rangeStart.valueOf() && d.valueOf() <= today.valueOf();
  });
}

function workingDaysAgo(from: dayjs.Dayjs, workingDays: number): dayjs.Dayjs {
  let cursor = from;
  let counted = 0;
  while (counted < workingDays) {
    cursor = cursor.subtract(1, 'day');
    const dow = cursor.day();
    if (dow !== 0 && dow !== 6) counted += 1;
  }
  return cursor;
}

function collectAccumulationLogs(all: TimeLog[], today: dayjs.Dayjs): TimeLog[] {
  const rangeStart = workingDaysAgo(today, LOOKBACK_WORKING_DAYS);
  return collectLogsFromArray(all, rangeStart, today);
}

function getLogsForSummary(all: TimeLog[], today: dayjs.Dayjs): TimeLog[] {
  // Find the latest weekday before today that has a did-log (non-plan) entry —
  // that becomes the standup anchor. collectLogsFromArray then sweeps from that
  // anchor to today, naturally picking up any weekend work in between.
  const anchor = all
    .filter((log) => log.type !== 'plan')
    .map((log) => parseLogDate(log.date)?.startOf('day'))
    .filter((d): d is dayjs.Dayjs => !!d?.isValid() && d.isBefore(today) && d.day() !== 0 && d.day() !== 6)
    .sort((a, b) => b.valueOf() - a.valueOf())[0];

  if (!anchor) return [];
  return collectLogsFromArray(all, anchor, today);
}

// ── Summary cache (single key, keyed by a stamp of the logs and the open note items) ──

interface SummaryCache {
  key: string;
  items: CatchUpRenderItem[];
}

export function logsStamp(all: TimeLog[]): string {
  let h = 0;
  for (const l of all) {
    const s = `${l.id}|${l.date}|${l.project}|${l.task ?? ''}|${l.duration ?? ''}|${l.type}|${l.description ?? ''}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `${all.length}:${h}`;
}

// Ticking or adding a note item changes the key, so Catch-up regenerates instead of showing stale items
export function summaryKey(all: TimeLog[], noteItems: string[]): string {
  return noteItems.length ? `${logsStamp(all)}|${hashString(noteItems.join('\n'))}` : logsStamp(all);
}

function getCachedSummary(key: string): CatchUpRenderItem[] | null {
  const raw = localStorage.getItem(storageKeys.catchUp.summaries);
  if (!raw) return null;
  try {
    const cache = JSON.parse(raw) as SummaryCache;
    return cache.key === key ? cache.items : null;
  } catch {
    return null;
  }
}

function setCachedSummary(key: string, items: CatchUpRenderItem[]): void {
  localStorage.setItem(storageKeys.catchUp.summaries, JSON.stringify({ key, items } satisfies SummaryCache));
}

async function openNoteItemsFromDb(): Promise<string[]> {
  return openNoteItems(await db.notes.all());
}

function getTodayPlans(all: TimeLog[], today: dayjs.Dayjs): TimeLog[] {
  return all.filter((log) => {
    const logDate = parseLogDate(log.date)?.startOf('day');
    return logDate?.isSame(today, 'day') && log.type === 'plan';
  });
}

function buildPlanRequestItems(plans: TimeLog[]): RequestPlan[] {
  const byProject = new Map<string, TimeLog[]>();
  for (const plan of plans) {
    if (!byProject.has(plan.project)) byProject.set(plan.project, []);
    byProject.get(plan.project)!.push(plan);
  }
  return Array.from(byProject.entries()).map(([project, logs]) => ({
    id: `plan-${deriveItemId(project)}`,
    project,
    tasks: logs.map((l) => ({ task: l.task, description: l.description })),
  }));
}

async function callStandupApi(
  all: TimeLog[],
  noteItems: string[],
  today: string,
  minutesPerDay: number | null,
): Promise<CatchUpRenderItem[] | null> {
  const todayDayjs = dayjs(today).startOf('day');

  // Separate did logs (actual work) from plan entries
  const summaryLogs = getLogsForSummary(all, todayDayjs);
  const didLogs = summaryLogs.filter((l) => l.type !== 'plan');

  const todayPlans = getTodayPlans(all, todayDayjs);
  const hasTodayPlans = todayPlans.length > 0;

  if (!didLogs.length && !hasTodayPlans && !noteItems.length) return null;

  const accumulated = accumulateMinutesByProject(
    collectAccumulationLogs(all, todayDayjs).filter((l) => l.type !== 'plan'),
  );
  const items = buildCatchUpItems(didLogs, accumulated);

  const requestItems = items.map((item) => ({
    id: item.id,
    project: item.project,
    logs: item.logs.map((l) => ({
      task: l.task,
      description: l.description,
      duration: formatDuration(l.duration),
    })),
  }));

  const planItems = hasTodayPlans ? buildPlanRequestItems(todayPlans) : [];
  const planIdToProject = new Map(planItems.map((p) => [p.id, p.project]));

  const headers = await authHeaders();
  if (!headers) return null; // signed out — the catch-up is a server-backed feature
  const response = await httpClient.post<{
    lines: { id: string; text: string }[];
    todoLines?: { id: string; text: string }[];
    noteLines?: string[];
  }>('/api/standup', { items: requestItems, plans: planItems, notes: noteItems, today }, { headers });

  const didRendered = applyLines(items, response.data.lines ?? [], minutesPerDay);
  const todoRendered: CatchUpRenderItem[] = (response.data.todoLines ?? []).map((l) => ({
    project: planIdToProject.get(l.id) ?? l.id,
    text: l.text,
    ongoing: false,
    group: 'todo' as const,
  }));

  const notesRendered: CatchUpRenderItem[] = (response.data.noteLines ?? []).map((text) => ({
    project: '',
    text,
    ongoing: false,
    group: 'notes' as const,
  }));

  const rendered: CatchUpRenderItem[] =
    todoRendered.length || notesRendered.length
      ? [...didRendered.map((r) => ({ ...r, group: 'did' as const })), ...todoRendered, ...notesRendered]
      : didRendered;

  setCachedSummary(summaryKey(all, noteItems), rendered);
  return rendered.length ? rendered : null;
}

/** `minutesPerDay` is the user's daily target (null = no limit), the day length of the "Xd Yh" effort labels. */
export async function fetchCatchUpItems(
  minutesPerDay: number | null = DEFAULT_MINUTES_PER_DAY,
): Promise<CatchUpRenderItem[] | null> {
  const all = await allLogs();
  const noteItems = await openNoteItemsFromDb();
  const cached = getCachedSummary(summaryKey(all, noteItems));
  if (cached) return cached;
  return callStandupApi(all, noteItems, dayjs().format('YYYY-MM-DD'), minutesPerDay);
}
