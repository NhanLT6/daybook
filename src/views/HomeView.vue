<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';

import AiChatPanel from '@/components/AiChatPanel.vue';
import BulkLogForm from '@/components/BulkLogForm.vue';
import LogList from '@/components/LogList.vue';
import WorkTimeBarChart from '@/components/WorkTimeBarChart.vue';

import type { ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { TimeLog } from '@/interfaces/TimeLog';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat, templateDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { saveAs } from 'file-saver';
import { camelCase, chain, toNumber, unionBy } from 'lodash';
import { nanoid } from 'nanoid';
import { parse, unparse } from 'papaparse';
import { toast } from 'vue-sonner';

// Use dynamic storage that updates with month changes
const timeLogs = ref<TimeLog[]>([]);
const tasks = useStorage<Task[]>(storageKeys.tasks, []);
const projects = useStorage<Project[]>(storageKeys.projects, []);

// Storage map to keep track of different month storages
const monthStorages = new Map<string, ReturnType<typeof useStorage<TimeLog[]>>>();

const selectedDates = ref<Date[]>([]);
const currentMonth = ref<number>(dayjs().month() + 1); // Convert from 0-based to 1-based
const editingLog = ref<TimeLog | undefined>(undefined);
const tab = ref<'form' | 'ai'>('form');
const theme = useTheme();
const tabSliderColor = computed(() => (theme.global.current.value.dark ? '#2E3B2E' : '#E8F5E9'));

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

  // Handle both create and update based on log ID
  logs.forEach((log) => {
    const existingIndex = monthStorage.value.findIndex((item) => item.id === log.id);

    if (existingIndex !== -1) {
      // Update existing log
      monthStorage.value[existingIndex] = log;
      toast.success('Log updated');
    } else {
      // Add new log
      monthStorage.value.push(log);
    }
  });

  // Update the reactive timeLogs ref as well
  timeLogs.value = monthStorage.value;

  // Show success message for bulk add (not for single update)
  if (logs.length > 1 || !logs.some((log) => monthStorage.value.findIndex((item) => item.id === log.id) !== -1)) {
    toast.success(`${logs.length} logs added`);
  }

  selectedDates.value = [];
  editingLog.value = undefined;
};

const handleFormSubmit = (logs: TimeLog[]) => {
  saveBulkLogs(logs);
};

const onBulkCancel = () => {
  selectedDates.value = [];
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
  toast.success('Log deleted');
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
      toast.error(e.message);
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

  toast.success('Logs imported');
};

// Handle logs saved from the AI chat panel.
// Each log has an explicit date, so save to the correct month bucket.
const onAiSaveLogs = (extractedLogs: ExtractedLog[]) => {
  extractedLogs.forEach((log) => {
    // AI returns YYYY-MM-DD; convert to the app's internal MM/DD/YYYY format
    const date = dayjs(log.date, 'YYYY-MM-DD').format(shortDateFormat);
    const logMonth = dayjs(log.date, 'YYYY-MM-DD').month() + 1; // 1-based month number
    const monthStorage = getTimeLogsForMonth(logMonth);
    monthStorage.value.push({
      id: nanoid(),
      date,
      project: log.project,
      task: log.task,
      duration: log.duration,
      description: log.description,
    });
  });

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

  toast.success(`${extractedLogs.length} log${extractedLogs.length > 1 ? 's' : ''} saved`);
};
</script>

<template>
  <!-- Viewport-fill two-panel layout -->
  <div class="home-layout">
    <WorkTimeBarChart :current-month="currentMonth" class="flex-shrink-0" />

    <div class="panels-row">
      <!-- Left panel: Form + AI Assistant tabs -->
      <VCard class="form-panel d-flex flex-column overflow-hidden">
        <VTabs
          v-model="tab"
          density="compact"
          class="ma-2"
          inset
          grow
          :slider-color="tabSliderColor"
          bg-color="surface"
        >
          <VTab value="form" prepend-icon="mdi-format-list-bulleted">Form</VTab>
          <VTab value="ai" prepend-icon="mdi-creation">Chat</VTab>
        </VTabs>

        <VTabsWindow v-model="tab">
          <!-- Form tab: scrollable so sticky form-actions works -->
          <VTabsWindowItem value="form" class="overflow-y-auto">
            <BulkLogForm
              v-model:selected-dates="selectedDates"
              :editing-log="editingLog"
              @submit="handleFormSubmit"
              @cancel="onBulkCancel"
              @month-changed="onMonthChanged"
            />
          </VTabsWindowItem>

          <!-- AI Assistant tab -->
          <VTabsWindowItem value="ai">
            <AiChatPanel :projects="projects" :tasks="tasks" @save-logs="onAiSaveLogs" />
          </VTabsWindowItem>
        </VTabsWindow>
      </VCard>

      <!-- Log list — layout controlled by HomeView via class inheritance -->
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
  </div>
</template>

<style scoped>
/* Viewport-fill two-panel layout */
.home-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 12px 12px;
  gap: 12px;
}

.panels-row {
  flex: 1;
  min-height: 0; /* essential — Vuetify has no utility class for this */
  display: flex;
  gap: 12px;
}

.form-panel {
  flex: 0 0 33.333%;
  max-width: 33.333%;
}

/* VTabsWindow flex chain.
   Vuetify's VWindow sets height:inherit on .v-window__container. Because VTabsWindow
   only has a flex-allocated height (no explicit CSS height property), inherit resolves
   to auto — collapsing the container and preventing overflow-y-auto from scrolling.
   This chain fixes that without touching Vuetify internals globally. */
.form-panel :deep(.v-tabs)                             { flex-grow: 0 !important; flex-shrink: 0 !important; }
.form-panel :deep(.v-tabs-window)                      { flex: 1; display: flex !important; flex-direction: column; min-height: 0; }
.form-panel :deep(.v-tabs-window .v-window__container) { height: auto !important; flex: 1; min-height: 0; }
.form-panel :deep(.v-tabs-window .v-window-item)       { flex: 1; min-height: 0; display: flex; flex-direction: column; }

/* Mobile: panels stack vertically, .panels-row scrolls as a unit */
@media (max-width: 959px) {
  .panels-row {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .form-panel {
    flex: none;
    max-width: 100%;
    overflow: visible !important;
  }
  /* Clear all overflow contexts so sticky buttons work against .panels-row */
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
