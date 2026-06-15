<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';

import AiChatPanel from '@/components/AiChatPanel.vue';
import BulkLogForm from '@/components/BulkLogForm.vue';
import InsightsPanel from '@/components/InsightsPanel.vue';
import LogList from '@/components/LogList.vue';
import MobileWeekChart from '@/components/MobileWeekChart.vue';
import WorkTimeBarChart from '@/components/WorkTimeBarChart.vue';

import type { ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { TimeLog } from '@/interfaces/TimeLog';

import { useDisplay, useTheme } from 'vuetify';

import { useNow, useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat, templateDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { REMEMBER_DATE_EXPIRY_MS, getRememberedDate } from '@/composables/useRememberDate';
import { onCatchUpView } from '@/composables/useCatchUpSummary';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { useSettingsStore } from '@/stores/settings';
import { saveAs } from 'file-saver';
import { camelCase, chain, toNumber, unionBy } from 'lodash';
import { nanoid } from 'nanoid';
import { parse, unparse } from 'papaparse';

// Use dynamic storage that updates with month changes
const timeLogs = ref<TimeLog[]>([]);
const tasks = useStorage<Task[]>(storageKeys.tasks, []);
const projects = useStorage<Project[]>(storageKeys.projects, []);

// Storage map to keep track of different month storages
const monthStorages = new Map<string, ReturnType<typeof useStorage<TimeLog[]>>>();

const now = useNow({ interval: 60_000 });
const todayDateStr = computed(() => dayjs(now.value).format('YYYY-MM-DD'));

const settingsStore = useSettingsStore();
const notificationCenter = useNotificationCenterStore();

const readRememberedDate = () =>
  getRememberedDate(settingsStore.lastSelectedDate, settingsStore.rememberLastSelectedDate);

let autoDeselectTimer: ReturnType<typeof setTimeout> | null = null;

const startAutoDeselectTimer = (delayMs: number) => {
  if (autoDeselectTimer) clearTimeout(autoDeselectTimer);
  autoDeselectTimer = setTimeout(() => {
    selectedDates.value = [];
    settingsStore.lastSelectedDate = null;
    autoDeselectTimer = null;
  }, delayMs);
};

onUnmounted(() => {
  if (autoDeselectTimer) clearTimeout(autoDeselectTimer);
});

onMounted(() => {
  const off = onCatchUpView(() => {
    tab.value = 'ai';
  });
  onUnmounted(off);
});

const initialDate = readRememberedDate();
const selectedDates = ref<Date[]>(initialDate ? [initialDate] : []);

// Resume the auto-deselect timer for remaining window when loading a remembered date
if (initialDate && settingsStore.lastSelectedDate) {
  const remaining = REMEMBER_DATE_EXPIRY_MS - (Date.now() - settingsStore.lastSelectedDate.savedAt);
  if (remaining > 0) startAutoDeselectTimer(remaining);
}
const currentMonth = ref<number>(dayjs().month() + 1); // Convert from 0-based to 1-based
const editingLog = ref<TimeLog | undefined>(undefined);

// Keep the calendar navigated to the current month for long-running tabs
watch(todayDateStr, () => {
  if (!editingLog.value) {
    currentMonth.value = dayjs().month() + 1;
  }
});

const tab = ref<'form' | 'ai'>('form');
const theme = useTheme();
const { smAndDown, lgAndUp } = useDisplay();
const tabSliderColor = computed(() => (theme.global.current.value.dark ? 'green-darken-4' : 'green-lighten-2'));

// Function to get or create storage for a specific month
const getTimeLogsForMonth = (month: number) => {
  const monthForKey = dayjs().month(month - 1); // Convert from 1-based to 0-based for dayjs
  const storageKey = `timeLogs-${monthForKey.format(yearAndMonthFormat)}`;

  if (!monthStorages.has(storageKey)) {
    monthStorages.set(storageKey, useStorage<TimeLog[]>(storageKey, []));
  }
  return monthStorages.get(storageKey)!;
};

// Initialize with current month and watch for changes
watchEffect(() => {
  const monthStorage = getTimeLogsForMonth(currentMonth.value);
  timeLogs.value = monthStorage.value;
});

const onMonthChanged = (month: number) => {
  currentMonth.value = month; // v-calendar uses 1-based months (1-12)
};

// Logs

const saveBulkLogs = (logs: TimeLog[]) => {
  const monthStorage = getTimeLogsForMonth(currentMonth.value);
  let addedCount = 0;
  let updatedCount = 0;

  // Handle both create and update based on log ID
  logs.forEach((log) => {
    const existingIndex = monthStorage.value.findIndex((item) => item.id === log.id);

    if (existingIndex !== -1) {
      // Update existing log
      monthStorage.value[existingIndex] = log;
      updatedCount += 1;
    } else {
      // Add new log
      monthStorage.value.push(log);
      addedCount += 1;
    }
  });

  // Update the reactive timeLogs ref as well
  timeLogs.value = monthStorage.value;

  if (updatedCount) {
    notificationCenter.success(updatedCount === 1 ? 'Log updated' : `${updatedCount} logs updated`);
  }

  if (addedCount) {
    notificationCenter.success(addedCount === 1 ? 'Log added' : `${addedCount} logs added`);
  }

  const isSingleCreate = !editingLog.value && logs.length === 1;
  if (settingsStore.rememberLastSelectedDate && isSingleCreate && selectedDates.value[0]) {
    settingsStore.lastSelectedDate = { date: selectedDates.value[0].toISOString(), savedAt: Date.now() };
    startAutoDeselectTimer(REMEMBER_DATE_EXPIRY_MS);
  } else {
    if (autoDeselectTimer) { clearTimeout(autoDeselectTimer); autoDeselectTimer = null; }
    settingsStore.lastSelectedDate = null;
    selectedDates.value = [];
  }
  editingLog.value = undefined;
};

const onBulkCancel = () => {
  const remembered = readRememberedDate();
  selectedDates.value = remembered ? [remembered] : [];
  editingLog.value = undefined;
};

const onEditLog = (log: TimeLog) => {
  editingLog.value = log;
  // Set calendar to show the log's date as selected (user can change it)
  selectedDates.value = [dayjs(log.date, shortDateFormat).toDate()];
};

const onDeleteLog = (log: TimeLog) => {
  const monthStorage = getTimeLogsForMonth(currentMonth.value);
  monthStorage.value = monthStorage.value.filter((item: TimeLog) => item !== log);
  // Update the reactive timeLogs ref as well
  timeLogs.value = monthStorage.value;
  notificationCenter.success('Log deleted');
};

const exportToCsv = () => {
  const transformedData = timeLogs.value.map((log) => ({
    Id: log.id,
    Date: dayjs(log.date).format(templateDateFormat),
    Project: log.project,
    Task: log.task,
    Duration: log.duration,
    Description: log.description,
    IsLogged: false,
  }));

  const csv = unparse(transformedData);

  // Save Csv file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `TimeLog-${dayjs().format(yearAndMonthFormat)}.csv`);
};

const importCsv = async (file?: File) => {
  if (!file) return;

  const fileContent = await file.text();

  const result = parse(fileContent, {
    header: true,
    transformHeader(header: string): string {
      return camelCase(header);
    },
    transform(value: string, header: string): string | number {
      if (header === 'date') return dayjs(value, templateDateFormat).format(shortDateFormat);
      if (header === 'duration') return toNumber(value);

      return value;
    },
  });

  if (result.errors.length) {
    result.errors.map((e) => {
      notificationCenter.error('Import failed', {
        message: e.message,
      });
      console.error(e);
    });

    return;
  }

  const dataWithIds: TimeLog[] = result.data.map((item) => {
    const log = item as Record<string, string | number>;
    return {
      id: (log.id as string) ?? nanoid(),
      date: log.date as string,
      project: log.project as string,
      task: log.task as string,
      duration: log.duration as number,
      description: log.description as string,
    };
  });

  // Merge imported data with existing data, prioritize imported data if there are records with the same id
  const monthStorage = getTimeLogsForMonth(currentMonth.value);
  monthStorage.value = unionBy(dataWithIds, monthStorage.value, 'id');
  // Update the reactive timeLogs ref as well
  timeLogs.value = monthStorage.value;

  // Extract Projects and Tasks
  projects.value = chain(dataWithIds)
    .map((log) => ({ title: log.project }))
    .concat(projects.value)
    .uniqBy('title')
    .value();

  tasks.value = chain(dataWithIds)
    .map((log) => ({ project: log.project, title: log.task }) satisfies Task)
    .concat(tasks.value)
    .uniqBy((value) => `${value.project}-${value.title}`)
    .value();

  notificationCenter.success('Logs imported');
};

// Track IDs of the last AI-saved batch for undo support
const lastAiSavedLogs = ref<Array<{ id: string; month: number }>>([]);

// Handle logs saved from the AI chat panel.
// Each log has an explicit date, so save to the correct month bucket.
const onAiSaveLogs = (extractedLogs: ExtractedLog[]) => {
  const savedBatch: Array<{ id: string; month: number }> = [];

  extractedLogs.forEach((log) => {
    // AI returns YYYY-MM-DD; convert to the app's internal MM/DD/YYYY format
    const date = dayjs(log.date, 'YYYY-MM-DD').format(shortDateFormat);
    const logMonth = dayjs(log.date, 'YYYY-MM-DD').month() + 1; // 1-based month number
    const id = nanoid();
    const monthStorage = getTimeLogsForMonth(logMonth);
    monthStorage.value.push({
      id,
      date,
      project: log.project,
      task: log.task,
      duration: log.duration,
      description: log.description,
    });
    savedBatch.push({ id, month: logMonth });
  });

  lastAiSavedLogs.value = savedBatch;

  // Merge any new projects and tasks into the stored lists (same as importCsv)
  projects.value = chain(extractedLogs)
    .map((log) => ({ title: log.project }))
    .concat(projects.value)
    .uniqBy('title')
    .value();

  tasks.value = chain(extractedLogs)
    .map((log) => ({ project: log.project, title: log.task }) satisfies Task)
    .concat(tasks.value)
    .uniqBy((value) => `${value.project}-${value.title}`)
    .value();

  // Refresh displayed timeLogs if any log belongs to the current month
  const currentMonthStorage = getTimeLogsForMonth(currentMonth.value);
  timeLogs.value = currentMonthStorage.value;

  notificationCenter.success(`${extractedLogs.length} log${extractedLogs.length > 1 ? 's' : ''} saved`);
};

const onAiUndoLogs = () => {
  lastAiSavedLogs.value.forEach(({ id, month }) => {
    const monthStorage = getTimeLogsForMonth(month);
    monthStorage.value = monthStorage.value.filter((log) => log.id !== id);
  });
  lastAiSavedLogs.value = [];

  // Refresh displayed logs
  timeLogs.value = getTimeLogsForMonth(currentMonth.value).value;

  notificationCenter.info('Logs removed');
};
</script>

<template>
  <!-- Three-column layout: form | chart+logs | insights (lg+) -->
  <div class="home-layout">
    <!-- Left panel: Form + AI Assistant tabs -->
    <VCard class="glass-acrylic form-panel d-flex flex-column overflow-hidden">
      <VTabs v-model="tab" density="compact" class="ma-2" align-tabs="center" :slider-color="tabSliderColor">
        <VTab value="form" prepend-icon="mdi-format-list-bulleted">Form</VTab>
        <VTab value="ai" prepend-icon="mdi-creation">Chat</VTab>
      </VTabs>

      <VTabsWindow v-model="tab">
        <!-- Form tab: scrollable so sticky form-actions works -->
        <VTabsWindowItem value="form" class="overflow-y-auto">
          <BulkLogForm
            v-model:selected-dates="selectedDates"
            :editing-log="editingLog"
            @submit="saveBulkLogs"
            @cancel="onBulkCancel"
            @month-changed="onMonthChanged"
          />
        </VTabsWindowItem>

        <!-- AI Assistant tab — eager keeps AiChatPanel mounted so onCatchUpView fires immediately -->
        <VTabsWindowItem value="ai" eager>
          <AiChatPanel :projects="projects" :tasks="tasks" @save-logs="onAiSaveLogs" @undo-logs="onAiUndoLogs" />
        </VTabsWindowItem>
      </VTabsWindow>
    </VCard>

    <!-- Middle column: chart stacked above log list -->
    <div class="content-column">
      <!-- Mobile: compact week strip chart driven by calendar selection -->
      <MobileWeekChart
        v-if="smAndDown"
        :time-logs="timeLogs"
        :selected-dates="selectedDates"
        :current-month="currentMonth"
        class="flex-shrink-0"
      />

      <!-- Desktop: full month bar chart -->
      <WorkTimeBarChart v-else :current-month="currentMonth" class="flex-shrink-0" />

      <!-- Log list -->
      <LogList
        class="flex-grow-1 overflow-hidden"
        :items="timeLogs"
        :selected-dates="selectedDates"
        @edit-log="onEditLog"
        @delete-log="onDeleteLog"
        @import="importCsv"
        @export="exportToCsv"
      />
    </div>

    <!-- Right panel: Insights — visible on large screens only -->
    <InsightsPanel
      v-if="lgAndUp"
      class="insights-panel"
      :time-logs="timeLogs"
      :current-month="currentMonth"
    />
  </div>
</template>

<style scoped>
/* Three-column viewport-fill layout: form | content | insights */
.home-layout {
  display: flex;
  flex-direction: row;
  height: 100%;
  padding: 12px;
  gap: 12px;
}

/* Left panel: fixed-width form column */
.form-panel {
  flex: 0 0 450px;
}

/* Middle column: chart on top, log list fills remaining height */
.content-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Right panel: fixed-width insights column (only rendered on lg+) */
.insights-panel {
  flex: 0 0 320px;
}

/* VTabsWindow flex chain.
   Vuetify's VWindow sets height:inherit on .v-window__container. Because VTabsWindow
   only has a flex-allocated height (no explicit CSS height property), inherit resolves
   to auto — collapsing the container and preventing overflow-y-auto from scrolling.
   This chain fixes that without touching Vuetify internals globally. */
.form-panel :deep(.v-tabs) {
  flex-grow: 0 !important;
  flex-shrink: 0 !important;
}
.form-panel :deep(.v-tabs-window) {
  flex: 1;
  display: flex !important;
  flex-direction: column;
  min-height: 0;
}
.form-panel :deep(.v-tabs-window .v-window__container) {
  height: auto !important;
  flex: 1;
  min-height: 0;
}
.form-panel :deep(.v-tabs-window .v-window-item) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Mobile: switch to page-scroll stacked layout */
@media (max-width: 959px) {
  .home-layout {
    flex-direction: column;
    height: auto;
  }

  .form-panel {
    flex: none;
    overflow: visible !important;
  }

  .content-column {
    flex: none;
    overflow: visible;
  }

  /* LogList loses its flex-grow-1 source of height; give it an explicit viewport height */
  .content-column > :last-child {
    flex: none !important;
    height: 70vh;
  }

  /* Clear all overflow contexts so sticky form buttons work against page scroll */
  .form-panel :deep(.v-card),
  .form-panel :deep(.v-tabs-window),
  .form-panel :deep(.v-tabs-window .v-window__container),
  .form-panel :deep(.v-tabs-window .v-window-item) {
    overflow: visible !important;
    height: auto !important;
    flex: none !important;
  }
}
</style>
