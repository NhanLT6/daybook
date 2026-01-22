<script setup lang="ts">
import { ref, watchEffect } from 'vue';

import BulkLogForm from '@/components/BulkLogForm.vue';
import CalendarOverview from '@/components/CalendarOverview.vue';
import LogList from '@/components/LogList.vue';
import WorkTimeBarChart from '@/components/WorkTimeBarChart.vue';

import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { TimeLog } from '@/interfaces/TimeLog';

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

const onClearDates = () => {
  selectedDates.value = [];
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
    Duration: (log.duration / 60).toFixed(1),
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
      duration: (log.duration as number) * 60, // Template use hour, this app use minute
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
</script>

<template>
  <VRow>
    <WorkTimeBarChart :current-month="currentMonth" />
  </VRow>

  <VRow>
    <!-- Calendar and Total Hours - Visible on all screen sizes -->
    <VCol cols="12" md="3" lg="3" class="d-flex flex-column ga-4">
      <CalendarOverview v-model="selectedDates" :single-date-mode="!!editingLog" @month-changed="onMonthChanged" />
    </VCol>

    <!-- Bulk Log Form -->
    <VCol cols="12" md="4" lg="4">
      <VCard class="elevation-0 border">
        <BulkLogForm
          :selected-dates="selectedDates"
          :editing-log="editingLog"
          @submit="handleFormSubmit"
          @cancel="onBulkCancel"
          @clear-dates="onClearDates"
        />
      </VCard>
    </VCol>

    <!-- Log List - Horizontally aligned on medium+ screens -->
    <VCol cols="12" md="4" lg="5">
      <LogList
        :items="timeLogs"
        :selected-dates="selectedDates"
        @edit-log="onEditLog"
        @delete-log="onDeleteLog"
        @import="importCsv"
        @export="exportToCsv"
      />
    </VCol>
  </VRow>
</template>
