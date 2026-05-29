import type { TimeLog } from '@/interfaces/TimeLog';
import type { GeminiConfig } from '@/interfaces/ServerSettings';

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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

function getLogsForSummary(): TimeLog[] {
  const today = dayjs().startOf('day');
  const lastFetchedAt = localStorage.getItem(storageKeys.catchUp.lastFetchedAt);

  let fromDate: dayjs.Dayjs | null = null;

  if (lastFetchedAt) {
    fromDate = dayjs(lastFetchedAt).startOf('day');
  } else {
    // Scan backwards up to 14 days for the most recent day with logs.
    for (let i = 1; i <= 14; i++) {
      const d = dayjs().subtract(i, 'day').startOf('day');
      const monthKey = `timeLogs-${d.format(yearAndMonthFormat)}`;
      const logs = readLogs(monthKey);
      if (logs.some((log) => parseLogDate(log.date)?.isSame(d, 'day'))) {
        fromDate = d;
        break;
      }
    }
  }

  if (!fromDate?.isValid()) return [];

  const rangeStart = fromDate;
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

async function callStandupApi(today: string): Promise<string | null> {
  const logs = getLogsForSummary();

  if (!logs.length) return null;

  const byDate = new Map<string, TimeLog[]>();
  for (const log of logs) {
    const parsedDate = parseLogDate(log.date);
    if (!parsedDate) continue;
    const dateKey = parsedDate.format('YYYY-MM-DD');
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(log);
  }

  const entries = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateLogs]) => ({
      date,
      dayOfWeek: dayjs(date).format('dddd'),
      logs: dateLogs.map((log) => ({
        project: log.project,
        task: log.task,
        duration: formatDuration(log.duration),
        description: log.description,
      })),
    }));

  if (!entries.length) return null;

  const headers = await buildAuthHeaders();
  const response = await httpClient.post<{ markdown: string }>('/api/standup', { entries, today }, { headers });

  localStorage.setItem(storageKeys.catchUp.summary(today), response.data.markdown);
  localStorage.setItem(storageKeys.catchUp.lastFetchedAt, new Date().toISOString());

  return response.data.markdown;
}

export function isGeminiAvailable(config: GeminiConfig): boolean {
  return config.enabled && !!config.apiKey;
}

export function shouldSkipCatchUp(today: string, dismissedDate: string | null, geminiConfig: GeminiConfig): boolean {
  return dismissedDate === today || !isGeminiAvailable(geminiConfig);
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

  function enqueueCatchUp(summary: string, date = today()) {
    notificationCenter.catchup('Catch-up', {
      id: `catchup-${date}`,
      persistent: true,
      payload: { markdown: summary },
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
      if (shouldSkipCatchUp(date, localStorage.getItem(storageKeys.catchUp.dismissedDate), settingsStore.geminiConfig)) {
        return;
      }

      const cached = localStorage.getItem(storageKeys.catchUp.summary(date));
      if (cached) {
        enqueueCatchUp(cached, date);
        return;
      }

      const summary = await callStandupApi(date);
      if (summary) enqueueCatchUp(summary, date);
    } catch {
      // Foundation phase: catch-up failures do not create user-facing notifications.
    } finally {
      flowRunning = false;
    }
  }

  return {
    prepareCatchUp,
    dismissCatchUp,
    enqueueCatchUp,
  };
}
