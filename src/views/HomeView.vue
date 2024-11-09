<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import LogForm from '@/components/LogForm.vue';
import LogList from '@/components/LogList.vue';

import type { XeroLog } from '@/interfaces/XeroLog';

import { useStorage } from '@vueuse/core';

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

const addLog = (log: XeroLog) => {
  xeroLogs.value.push(log);
  toast.success('Log added successfully');
};

const onEditLog = (log: XeroLog) => {
  editingLog.value = log;
};

const onDeleteLog = (log: XeroLog) => {
  xeroLogs.value = xeroLogs.value.filter((item) => item !== log);
  toast.success('Log deleted successfully');
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
        @submit="addLog"
      />
    </VCol>

    <VCol cols="12" lg="6">
      <LogList :items="xeroLogs" :selected-date="selectedDate" @edit-log="onEditLog" @delete-log="onDeleteLog" />
    </VCol>
  </VRow>
</template>
