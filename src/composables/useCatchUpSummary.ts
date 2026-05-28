import { onUnmounted, ref } from 'vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { httpClient } from '@/apis/httpClient';
import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';

import { buildAuthHeaders } from './useCrypto';

export type CatchUpState = 'greeting' | 'preparing' | 'ready' | 'unconfigured' | 'error';

const GREETING_MIN_MS = 1500;
const PREPARING_MIN_MS = 1000;
const AUTO_CLOSE_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getLogsForSummary(): TimeLog[] {
  const today = dayjs().format('YYYY-MM-DD');
  const lastFetchedAt = localStorage.getItem(storageKeys.catchUp.lastFetchedAt);

  let fromDate: string;

  if (lastFetchedAt) {
    fromDate = dayjs(lastFetchedAt).format('YYYY-MM-DD');
  } else {
    // Scan backwards up to 14 days for the most recent day with logs
    fromDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    for (let i = 1; i <= 14; i++) {
      const d = dayjs().subtract(i, 'day');
      const testDate = d.format('YYYY-MM-DD');
      const monthKey = `timeLogs-${d.format('YYYY-MM')}`;
      const stored = localStorage.getItem(monthKey);
      if (stored) {
        const logs: TimeLog[] = JSON.parse(stored);
        if (logs.some((l) => l.date === testDate)) {
          fromDate = testDate;
          break;
        }
      }
    }
  }

  const allLogs: TimeLog[] = [];
  let cursor = dayjs(fromDate).startOf('month');
  const endMonth = dayjs(today).startOf('month');

  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
    const monthKey = `timeLogs-${cursor.format('YYYY-MM')}`;
    const stored = localStorage.getItem(monthKey);
    if (stored) {
      const logs: TimeLog[] = JSON.parse(stored);
      allLogs.push(...logs.filter((l) => l.date >= fromDate && l.date <= today));
    }
    cursor = cursor.add(1, 'month');
  }

  return allLogs;
}

async function callStandupApi(today: string): Promise<string> {
  const logs = getLogsForSummary();

  if (!logs.length) return '*No recent logs found.*';

  const byDate = new Map<string, TimeLog[]>();
  for (const log of logs) {
    if (!byDate.has(log.date)) byDate.set(log.date, []);
    byDate.get(log.date)!.push(log);
  }

  const entries = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateLogs]) => ({
      date,
      dayOfWeek: dayjs(date).format('dddd'),
      logs: dateLogs.map((l) => ({
        project: l.project,
        task: l.task,
        duration: formatDuration(l.duration),
        description: l.description,
      })),
    }));

  const headers = await buildAuthHeaders();
  const response = await httpClient.post<{ markdown: string }>('/api/standup', { entries, today }, { headers });

  localStorage.setItem(storageKeys.catchUp.summary(today), response.data.markdown);
  localStorage.setItem(storageKeys.catchUp.lastFetchedAt, new Date().toISOString());

  return response.data.markdown;
}

export function useCatchUpSummary() {
  const settingsStore = useSettingsStore();

  const today = dayjs().format('YYYY-MM-DD');
  const dismissedDate = localStorage.getItem(storageKeys.catchUp.dismissedDate);

  const isVisible = ref(settingsStore.catchUpEnabled && dismissedDate !== today);
  const contentState = ref<CatchUpState>('greeting');
  const summary = ref('');

  // ── State flow ────────────────────────────────────────────────────────────

  async function runFlow() {
    contentState.value = 'greeting';
    summary.value = '';

    const isConfigured = settingsStore.geminiConfig.enabled && !!settingsStore.geminiConfig.apiKey;
    const cached = localStorage.getItem(storageKeys.catchUp.summary(today));

    // Start AI call in background (if configured and not cached)
    let aiPromise: Promise<string> | null = null;
    let aiResult: string | null = null;
    let aiDone = false;
    let aiFailed = false;

    if (isConfigured && !cached) {
      aiPromise = callStandupApi(today);
      aiPromise
        .then((r) => {
          aiResult = r;
          aiDone = true;
        })
        .catch(() => {
          aiFailed = true;
          aiDone = true;
        });
    }

    // Always show greeting for minimum time
    await sleep(GREETING_MIN_MS);

    if (!isConfigured) {
      contentState.value = 'unconfigured';
      return;
    }

    if (cached) {
      summary.value = cached;
      contentState.value = 'ready';
      return;
    }

    // Check if AI resolved during greeting
    if (aiDone && !aiFailed && aiResult) {
      summary.value = aiResult;
      contentState.value = 'ready';
      return;
    }

    if (aiDone && aiFailed) {
      contentState.value = 'error';
      return;
    }

    // Still loading — show preparing with minimum duration
    contentState.value = 'preparing';
    const preparingStart = Date.now();

    try {
      const result = await aiPromise!;
      const elapsed = Date.now() - preparingStart;
      if (elapsed < PREPARING_MIN_MS) await sleep(PREPARING_MIN_MS - elapsed);
      summary.value = result;
      contentState.value = 'ready';
    } catch {
      contentState.value = 'error';
    }
  }

  // ── Dismiss / auto-close timer ────────────────────────────────────────────

  let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  function dismiss() {
    clearAutoCloseTimer();
    localStorage.setItem(storageKeys.catchUp.dismissedDate, today);
    isVisible.value = false;
  }

  function startAutoCloseTimer() {
    clearAutoCloseTimer();
    autoCloseTimer = setTimeout(dismiss, AUTO_CLOSE_MS);
  }

  function clearAutoCloseTimer() {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }

  async function retry() {
    await runFlow();
  }

  onUnmounted(clearAutoCloseTimer);

  return {
    isVisible,
    contentState,
    summary,
    runFlow,
    dismiss,
    startAutoCloseTimer,
    clearAutoCloseTimer,
    retry,
  };
}
