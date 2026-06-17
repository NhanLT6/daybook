import type { CatchUpRenderItem } from '@/interfaces/CatchUp';
import type { TimeLog } from '@/interfaces/TimeLog';
import type { AiConfig } from '@/interfaces/ServerSettings';

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { httpClient } from '@/apis/httpClient';
import { shortDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
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
    const windowMinutes = logs.reduce((sum, l) => sum + l.duration, 0);
    const accumulatedMinutes = accumulated.get(project) ?? windowMinutes;
    const latest = logs.reduce((max, l) => (l.date > max ? l.date : max), '');
    const item: CatchUpItem = {
      id: deriveItemId(project),
      project,
      logs: logs.map((l) => ({ task: l.task, description: l.description, duration: l.duration })),
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
    totals.set(log.project, (totals.get(log.project) ?? 0) + log.duration);
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

function readLogs(monthKey: string): TimeLog[] {
  const stored = localStorage.getItem(monthKey);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as TimeLog[];
  } catch {
    return [];
  }
}

function collectLogsFromDate(rangeStart: dayjs.Dayjs, today: dayjs.Dayjs): TimeLog[] {
  const allLogs: TimeLog[] = [];
  let cursor = rangeStart.startOf('month');
  const endMonth = today.startOf('month');

  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
    const monthKey = `timeLogs-${cursor.format(yearAndMonthFormat)}`;
    const logs = readLogs(monthKey);
    allLogs.push(
      ...logs.filter((log) => {
        const logDate = parseLogDate(log.date)?.startOf('day');
        if (!logDate) return false;
        return logDate.valueOf() >= rangeStart.valueOf() && logDate.valueOf() <= today.valueOf();
      }),
    );
    cursor = cursor.add(1, 'month');
  }

  return allLogs;
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

function collectAccumulationLogs(today: dayjs.Dayjs): TimeLog[] {
  const rangeStart = workingDaysAgo(today, LOOKBACK_WORKING_DAYS);
  return collectLogsFromDate(rangeStart, today);
}

function getLogsForSummary(): TimeLog[] {
  const today = dayjs().startOf('day');

  // Scan all stored log months newest-first. Find the latest weekday before today
  // that has entries — that becomes the standup anchor. collectLogsFromDate then
  // sweeps from that anchor to today, naturally picking up any weekend work in between.
  const logMonthKeys = Object.keys(localStorage)
    .filter((key) => /^timeLogs-\d{4}-\d{2}$/.test(key))
    .sort()
    .reverse();

  for (const monthKey of logMonthKeys) {
    const logs = readLogs(monthKey);

    const anchor = logs
      .map((log) => parseLogDate(log.date)?.startOf('day'))
      .filter((d): d is dayjs.Dayjs => !!d?.isValid() && d.isBefore(today) && d.day() !== 0 && d.day() !== 6)
      .sort((a, b) => b.valueOf() - a.valueOf())[0];

    if (anchor) return collectLogsFromDate(anchor, today);
  }

  return [];
}

// ── Summary cache (single key, keyed by logsLastModified timestamp) ──────────

interface SummaryCache {
  key: string;
  items: CatchUpRenderItem[];
}

function getCachedSummary(): CatchUpRenderItem[] | null {
  const key = localStorage.getItem(storageKeys.logsLastModified);
  if (!key) return null;
  const raw = localStorage.getItem(storageKeys.catchUp.summaries);
  if (!raw) return null;
  try {
    const cache = JSON.parse(raw) as SummaryCache;
    return cache.key === key ? cache.items : null;
  } catch {
    return null;
  }
}

function setCachedSummary(items: CatchUpRenderItem[]): void {
  let key = localStorage.getItem(storageKeys.logsLastModified);
  if (!key) {
    // Seed the key so cache is usable until the user next saves a log
    key = Date.now().toString();
    localStorage.setItem(storageKeys.logsLastModified, key);
  }
  localStorage.setItem(storageKeys.catchUp.summaries, JSON.stringify({ key, items } satisfies SummaryCache));
}

async function callStandupApi(today: string): Promise<CatchUpRenderItem[] | null> {
  const didLogs = getLogsForSummary();
  if (!didLogs.length) return null;

  const accumulated = accumulateMinutesByProject(collectAccumulationLogs(dayjs(today).startOf('day')));
  const items = buildCatchUpItems(didLogs, accumulated);
  if (!items.length) return null;

  const requestItems = items.map((item) => ({
    id: item.id,
    project: item.project,
    logs: item.logs.map((l) => ({
      task: l.task,
      description: l.description,
      duration: formatDuration(l.duration),
    })),
  }));

  const headers = await buildAuthHeaders();
  const response = await httpClient.post<{ lines: { id: string; text: string }[] }>(
    '/api/standup',
    { items: requestItems, today },
    { headers },
  );

  const rendered = applyLines(items, response.data.lines ?? []);
  setCachedSummary(rendered);
  return rendered;
}

export async function fetchCatchUpItems(): Promise<CatchUpRenderItem[] | null> {
  const cached = getCachedSummary();
  if (cached) return cached;
  return callStandupApi(dayjs().format('YYYY-MM-DD'));
}

export function isAiAvailable(config: AiConfig): boolean {
  return config.enabled;
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

      const cached = getCachedSummary();
      if (cached) {
        enqueueCatchUp(cached, date);
        return;
      }

      const items = await callStandupApi(date);
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
