import type { CatchUpRenderItem } from '@/interfaces/CatchUp';
import type { TimeLog } from '@/interfaces/TimeLog';
import type { AiConfig } from '@/interfaces/ServerSettings';

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { httpClient } from '@/apis/httpClient';
import { shortDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { db } from '@/db';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { useSettingsStore } from '@/stores/settings';

import { buildAuthHeaders } from './useCrypto';

dayjs.extend(customParseFormat);

const SETTINGS_WAIT_FALLBACK_MS = 5000;
const HOURS_PER_DAY = 8; // for the "Xd Yh" effort metric
const LONG_RUNNING_THRESHOLD_MINUTES = 15 * 60; // 15h accumulated effort
const LOOKBACK_WORKING_DAYS = 15; // rolling window for accumulation (~3 weeks)

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

export function formatEffort(minutes: number): string {
  const totalHours = Math.round(minutes / 60);
  const days = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = totalHours % HOURS_PER_DAY;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (!parts.length) parts.push('0h');
  return parts.join(' ');
}

export interface CatchUpItem {
  id: string;
  project: string;
  logs: { task: string; description?: string; duration: number }[];
  windowMinutes: number;
  accumulatedMinutes: number;
  ongoing: boolean;
}

interface RequestPlan {
  id: string;
  project: string;
  tasks: { task: string; description?: string }[];
}

export type { CatchUpRenderItem };

// ── Notification → Chat bridge (module-level singleton, no reactive signal) ──

type CatchUpViewHandler = (items: CatchUpRenderItem[]) => void;
const viewHandlers = new Set<CatchUpViewHandler>();

export function onCatchUpView(handler: CatchUpViewHandler): () => void {
  viewHandlers.add(handler);
  return () => viewHandlers.delete(handler);
}

export function triggerCatchUpView(items: CatchUpRenderItem[]): void {
  viewHandlers.forEach((h) => h(items));
}

export function markCatchUpViewed(date = dayjs().format('YYYY-MM-DD')): void {
  localStorage.setItem(storageKeys.catchUp.dismissedDate, date);
}

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

export function applyLines(items: CatchUpItem[], lines: { id: string; text: string }[]): CatchUpRenderItem[] {
  const textById = new Map(lines.map((l) => [l.id, l.text]));
  return items.map((item) => ({
    project: item.project,
    text: textById.get(item.id) ?? item.project,
    ongoing: item.ongoing,
    effortLabel: item.ongoing ? formatEffort(item.accumulatedMinutes) : undefined,
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

// ── Summary cache (single key, keyed by a stamp derived from the logs: count + latest date) ──

interface SummaryCache {
  key: string;
  items: CatchUpRenderItem[];
}

export function logsStamp(all: TimeLog[]): string {
  let h = 0;
  for (const l of all) {
    const s = `${l.id}|${l.date}|${l.project}|${l.task}|${l.duration ?? ''}|${l.type}|${l.description ?? ''}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `${all.length}:${h}`;
}

function getCachedSummary(all: TimeLog[]): CatchUpRenderItem[] | null {
  const raw = localStorage.getItem(storageKeys.catchUp.summaries);
  if (!raw) return null;
  try {
    const cache = JSON.parse(raw) as SummaryCache;
    return cache.key === logsStamp(all) ? cache.items : null;
  } catch {
    return null;
  }
}

function setCachedSummary(all: TimeLog[], items: CatchUpRenderItem[]): void {
  const key = logsStamp(all);
  localStorage.setItem(storageKeys.catchUp.summaries, JSON.stringify({ key, items } satisfies SummaryCache));
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

async function callStandupApi(all: TimeLog[], today: string): Promise<CatchUpRenderItem[] | null> {
  const todayDayjs = dayjs(today).startOf('day');

  // Separate did logs (actual work) from plan entries
  const summaryLogs = getLogsForSummary(all, todayDayjs);
  const didLogs = summaryLogs.filter((l) => l.type !== 'plan');

  const todayPlans = getTodayPlans(all, todayDayjs);
  const hasTodayPlans = todayPlans.length > 0;

  if (!didLogs.length && !hasTodayPlans) return null;

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

  const headers = await buildAuthHeaders();
  const response = await httpClient.post<{ lines: { id: string; text: string }[]; todoLines?: { id: string; text: string }[] }>(
    '/api/standup',
    { items: requestItems, plans: planItems, today },
    { headers },
  );

  const didRendered = applyLines(items, response.data.lines ?? []);
  const todoRendered: CatchUpRenderItem[] = (response.data.todoLines ?? []).map((l) => ({
    project: planIdToProject.get(l.id) ?? l.id,
    text: l.text,
    ongoing: false,
    group: 'todo' as const,
  }));

  const rendered: CatchUpRenderItem[] = hasTodayPlans
    ? [...didRendered.map((r) => ({ ...r, group: 'did' as const })), ...todoRendered]
    : didRendered;

  setCachedSummary(all, rendered);
  return rendered.length ? rendered : null;
}

export async function fetchCatchUpItems(): Promise<CatchUpRenderItem[] | null> {
  const all = await allLogs();
  const cached = getCachedSummary(all);
  if (cached) return cached;
  return callStandupApi(all, dayjs().format('YYYY-MM-DD'));
}

export function isAiAvailable(config: AiConfig): boolean {
  return config.enabled && !!config.apiKey;
}

export function shouldSkipCatchUp(today: string, dismissedDate: string | null, aiConfig: AiConfig): boolean {
  return dismissedDate === today || !isAiAvailable(aiConfig);
}

export function useCatchUpSummary() {
  const settingsStore = useSettingsStore();
  const notificationCenter = useNotificationCenterStore();

  let flowRunning = false;

  const today = () => dayjs().format('YYYY-MM-DD');

  function dismissCatchUp(date = today()) {
    localStorage.setItem(storageKeys.catchUp.dismissedDate, date);
    notificationCenter.dismiss(`catchup-${date}`);
  }

  function enqueueCatchUp(items: CatchUpRenderItem[], date = today()) {
    notificationCenter.catchup('Catch-up', {
      id: `catchup-${date}`,
      persistent: true,
      message: 'Ready · click to view in Chat',
      payload: { items },
      actions: [
        {
          id: 'dismiss',
          label: 'Dismiss',
          closeOnComplete: true,
          onClick: () => {
            localStorage.setItem(storageKeys.catchUp.dismissedDate, date);
          },
        },
      ],
    });
  }

  async function prepareCatchUp(): Promise<void> {
    if (flowRunning) return;
    flowRunning = true;

    try {
      await Promise.race([settingsStore.waitForSettings(), sleep(SETTINGS_WAIT_FALLBACK_MS)]);

      const date = today();
      if (shouldSkipCatchUp(date, localStorage.getItem(storageKeys.catchUp.dismissedDate), settingsStore.aiConfig)) {
        return;
      }

      const all = await allLogs();
      const cached = getCachedSummary(all);
      if (cached) {
        enqueueCatchUp(cached, date);
        return;
      }

      const items = await callStandupApi(all, date);
      if (items?.length) enqueueCatchUp(items, date);
    } catch {
      // Foundation phase: catch-up failures do not create user-facing notifications.
    } finally {
      flowRunning = false;
    }
  }

  function startCatchUpNotifications(): () => void {
    void prepareCatchUp();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void prepareCatchUp();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  return {
    dismissCatchUp,
    enqueueCatchUp,
    startCatchUpNotifications,
  };
}
