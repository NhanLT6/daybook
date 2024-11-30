<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import SingleFilePicker from '@/components/app/SingleFilePicker.vue';

import type { XeroLog } from '@/interfaces/XeroLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { chain, sumBy } from 'lodash';
import { toast } from 'vue-sonner';

export interface LogListProps {
  items: XeroLog[];

  // Date in ISO format
  selectedDate?: Date;
}

const { items: logItems, selectedDate } = defineProps<LogListProps>();

const emit = defineEmits<{
  editLog: [log: XeroLog];
  deleteLog: [log: XeroLog];
  import: [file?: File];
  export: [];
}>();

// Expanded rows
const openedPanels = ref<string[]>([dayjs(selectedDate).format(shortDateFormat)]);

watch(
  () => selectedDate,
  () => {
    const selectedDateString = dayjs(selectedDate).format(shortDateFormat);
    openedPanels.value = [selectedDateString];
  },
);

const getColorHint = (minutes: number) => {
  const hours = dayjs.duration({ minutes }).asHours();

  if (hours >= 7.5 && hours <= 8) {
    return 'green-darken-3';
  }

  if (hours > 8) {
    return 'error';
  }

  return '';
};

// Table

const headers = ref([
  { title: 'Date', key: 'date' },
  { title: 'Project', key: 'project' },
  { title: 'Task', key: 'task' },
  { title: 'Duration', key: 'duration' },
  { title: 'Description', key: 'description' },
  { title: 'Actions', key: 'actions', sortable: false },
]);

const loggedTimeByDates = computed(() =>
  chain(logItems)
    .groupBy((item) => item.date)
    .map((items, date) => ({
      date,
      durationSum: sumBy(items, 'duration'),
      tasks: items,
    }))
    .orderBy((item) => item.date)
    .value(),
);

const onExpand = () => {
  openedPanels.value = loggedTimeByDates.value.map((item) => item.date);
};

const onCollapse = () => {
  openedPanels.value = [];
};

const onEditLog = (log: XeroLog) => {
  emit('editLog', log);
};

const onDeleteLog = (log: XeroLog) => {
  toast.warning('Delete log?', {
    action: {
      label: 'Delete',
      onClick: () => {
        emit('deleteLog', log);
      },
    },
    duration: 20000,
  });
};

const readCsv = (file?: File) => {
  emit('import', file);
};
</script>

<template>
  <VCard class="mb-4 elevation-0 border" style="height: calc(100vh - 112px); overflow-y: scroll">
    <VCardTitle class="bg-white" style="position: sticky; top: 0; z-index: 1000">
      <VToolbar class="bg-transparent">
        <VToolbarTitle>Logs</VToolbarTitle>

        <VSpacer />

        <div class="d-flex ga-1">
          <VBtn icon="mdi-arrow-expand" @click="onExpand" />
          <VBtn icon="mdi-arrow-collapse" @click="onCollapse" />
          <SingleFilePicker icon="mdi-import" file-types=".csv" @file-selected="readCsv" />
          <VBtn icon="mdi-file-delimited-outline" @click="emit('export')" />
        </div>
      </VToolbar>
    </VCardTitle>

    <VCard v-if="loggedTimeByDates.length === 0" class="elevation-0">
      <VCardText>
        <div class="d-flex flex-column ga-2 py-4 align-center bg-grey-lighten-4 rounded text-disabled">
          <VIcon icon="mdi-package-variant-closed" />
          <div class="text-subtitle-1">No data</div>
        </div>
      </VCardText>
    </VCard>

    <VExpansionPanels variant="accordion" v-model="openedPanels" multiple>
      <VExpansionPanel v-for="group in loggedTimeByDates" :key="group.date" :value="group.date">
        <VExpansionPanelTitle>
          <div class="me-2">{{ group.date }}</div>

          <VChip prepend-icon="mdi-timer-outline" :color="getColorHint(group.durationSum)">
            {{ minutesToHourWithMinutes(group.durationSum) }}
          </VChip>
        </VExpansionPanelTitle>

        <VExpansionPanelText>
          <VCard class="elevation-0 rounded-4">
            <VDataTable :items="group.tasks" :headers="headers" class="bg-grey-lighten-4" hide-default-footer>
              <template #item.duration="{ item }">
                {{ minutesToHourWithMinutes(item.duration) }}
              </template>

              <!--suppress VueUnrecognizedSlot -->
              <template #item.actions="{ item }">
                <div class="d-flex ga-2">
                  <VBtn icon="mdi-pencil-outline" variant="text" size="sm" @click="onEditLog(item)" class="me-2" />
                  <VBtn icon="mdi-trash-can-outline" variant="text" size="sm" @click="onDeleteLog(item)" class="me-2" />
                </div>
              </template>
            </VDataTable>
          </VCard>
        </VExpansionPanelText>
      </VExpansionPanel>
    </VExpansionPanels>
  </VCard>
</template>

<style scoped></style>
