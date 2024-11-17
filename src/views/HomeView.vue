<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import LogForm from '@/components/LogForm.vue';
import LogList from '@/components/LogList.vue';

import type { XeroLog } from '@/interfaces/XeroLog';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { saveAs } from 'file-saver';
import { camelCase, toNumber, unionBy } from 'lodash';
import { nanoid } from 'nanoid';
import { parse, unparse } from 'papaparse';
import { toast } from 'vue-sonner';

const xeroLogs = useStorage<XeroLog[]>('xeroLogs', []);

const selectedDate = ref<Date>(new Date());

// Calendar

const viewModeToggle = ref(1);
const calendarViewMode = computed(() => (viewModeToggle.value === 0 ? 'weekly' : 'monthly'));

const calendarAttrs = ref([
  {
    key: 'today',
    highlight: true,
    dates: selectedDate.value,
  },
]);

watch(selectedDate, () => {
  calendarAttrs.value = [
    {
      key: 'today',
      highlight: true,
      dates: selectedDate.value,
    },
  ];
});

const onDayClick = (day: any) => {
  selectedDate.value = day.date;
};

const gotoToday = () => {
  selectedDate.value = new Date();
};

// Logs

const editingLog = ref<XeroLog | undefined>();

const totalHours = computed(() => xeroLogs.value.reduce((acc, log) => acc + log.duration, 0));

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
    Date: log.date,
    Project: log.project,
    Task: log.task,
    // Duration: dayjs.duration({ minutes: log.duration }).asHours().toFixed(1),
    Duration: log.duration,
    Description: log.description,
  }));

  const csv = unparse(transformedData);

  // Save Csv file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `XeroLog-${dayjs().toISOString()}.csv`);
};

const importCsv = async (file?: File) => {
  if (!file) return;

  const fileText = await file.text();

  const result = parse(fileText, {
    header: true,
    transformHeader(header: string, index: number): string {
      return camelCase(header);
    },
  });

  if (result.errors.length) {
    result.errors.map((e) => {
      toast.error(e.message);
    });

    return;
  }

  // Merge imported data with existing data, prioritize imported data if there are records with the same id
  xeroLogs.value = unionBy(result.data, xeroLogs.value, 'id').map((item) => {
    const log = item as any;
    return {
      id: log.id ?? nanoid(),
      date: log.date,
      project: log.project,
      task: log.task,
      duration: toNumber(log.duration),
      description: log.description,
    };
  });

  toast.success('Logs imported');
};
</script>

<template>
  <VRow>
    <VCol cols="auto" class="d-none d-md-flex flex-column ga-4">
      <Calendar :view="calendarViewMode" :attributes="calendarAttrs" expanded @dayclick="onDayClick" />

      <VCard class="elevation-0 border">
        <VCardText class="d-flex justify-space-between align-center">
          <VBtn prepend-icon="mdi-calendar-today-outline" variant="text" @click="gotoToday">Today</VBtn>

          <VBtnToggle v-model="viewModeToggle" variant="tonal">
            <VBtn icon="mdi-view-week-outline" />
            <VBtn icon="mdi-calendar-month-outline" />
          </VBtnToggle>
        </VCardText>
      </VCard>

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
