<script setup lang="ts">
import { computed, ref } from 'vue';

import CalendarOverview from '@/components/CalendarOverview.vue';
import LogForm from '@/components/LogForm.vue';
import LoggedTimeWithChartView from '@/components/LoggedTimeWithChartView.vue';
import LogList from '@/components/LogList.vue';

import type { XeroLog } from '@/interfaces/XeroLog';
import type { XeroProject } from '@/interfaces/XeroProject';
import type { XeroTask } from '@/interfaces/XeroTask';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat, templateDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { saveAs } from 'file-saver';
import { camelCase, chain, toNumber, unionBy } from 'lodash';
import { nanoid } from 'nanoid';
import { parse, unparse } from 'papaparse';
import { toast } from 'vue-sonner';

const xeroLogs = useStorage<XeroLog[]>(storageKeys.xeroLogsOfCurrentMonth, []);
const xeroTasks = useStorage<XeroTask[]>(storageKeys.xeroTasks, []);
const xeroProjects = useStorage<XeroProject[]>(storageKeys.xeroProjects, []);

const selectedDate = ref<Date>(new Date());

const onDayClick = (day: Date) => {
  selectedDate.value = day;
};

// Logs

const editingLog = ref<XeroLog | undefined>();

const totalHours = computed(() => {
  const durationInMinutes = xeroLogs.value.reduce((acc, log) => acc + log.duration, 0);
  return (durationInMinutes / 60).toFixed(1);
});

const onFormSelectedDateChanged = (value: Date) => {
  selectedDate.value = value;
};

const saveLog = (log: XeroLog) => {
  const logIndex = xeroLogs.value.findIndex((i) => i.id === log.id);
  if (logIndex !== -1) {
    xeroLogs.value[logIndex] = log;
    toast.success('Log updated');
  } else {
    xeroLogs.value.push(log);
    toast.success('Log added');
  }
};

const onEditLog = (log: XeroLog) => {
  editingLog.value = log;
};

const onDeleteLog = (log: XeroLog) => {
  xeroLogs.value = xeroLogs.value.filter((item) => item !== log);
  toast.success('Log deleted');
};

const exportToCsv = () => {
  const transformedData = xeroLogs.value.map((log) => ({
    Id: log.id,
    Date: dayjs(log.date).format(templateDateFormat),
    Project: log.project,
    Task: log.task,
    Duration: (log.duration / 60).toFixed(1),
    Description: log.description,
  }));

  const csv = unparse(transformedData);

  // Save Csv file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `XeroLog-${dayjs().format(yearAndMonthFormat)}.csv`);
};

const importCsv = async (file?: File) => {
  if (!file) return;

  const fileContent = await file.text();

  const result = parse(fileContent, {
    header: true,
    transformHeader(header: string): string {
      return camelCase(header);
    },
    transform(value: string, header: string): any {
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

  const dataWithIds: XeroLog[] = result.data.map((item) => {
    const log = item as any;
    return {
      id: log.id ?? nanoid(),
      date: log.date,
      project: log.project,
      task: log.task,
      duration: log.duration * 60, // Template use hour, this app use minute
      description: log.description,
    };
  });

  // Merge imported data with existing data, prioritize imported data if there are records with the same id
  xeroLogs.value = unionBy(dataWithIds, xeroLogs.value, 'id');

  // Extract Projects and Tasks
  xeroProjects.value = chain(dataWithIds)
    .map((log) => ({ title: log.project }))
    .concat(xeroProjects.value)
    .uniqBy('title')
    .value();

  xeroTasks.value = chain(dataWithIds)
    .map((log) => ({ project: log.project, title: log.task }) satisfies XeroTask)
    .concat(xeroTasks.value)
    .uniqBy((value) => `${value.project}-${value.title}`)
    .value();

  toast.success('Logs imported');
};
</script>

<template>
  <LoggedTimeWithChartView class="mb-4" />

  <VRow>
    <VCol cols="auto" class="d-none d-md-flex flex-column ga-4">
      <CalendarOverview :selected-date="selectedDate" :xero-logs="xeroLogs" @selected-date-changed="onDayClick" />

      <VChip color="" variant="tonal" prepend-icon="mdi-timer-outline"> Total Hours: {{ totalHours }} </VChip>
    </VCol>

    <VCol style="min-width: 300px">
      <LogForm
        :item="editingLog"
        :selected-date="selectedDate"
        @selected-date-changed="onFormSelectedDateChanged"
        @submit="saveLog"
      />
    </VCol>

    <VCol cols="12" lg="6">
      <LogList
        :items="xeroLogs"
        :selected-date="selectedDate"
        @edit-log="onEditLog"
        @delete-log="onDeleteLog"
        @import="importCsv"
        @export="exportToCsv"
      />
    </VCol>
  </VRow>
</template>
