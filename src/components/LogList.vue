<script setup lang="ts">

import { computed, ref, watch } from 'vue';

import { useDateDisplay } from '@/composables/useDateDisplay';

import SingleFilePicker from '@/components/app/SingleFilePicker.vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { chain, sumBy } from 'lodash';
import { toast } from 'vue-sonner';

export interface LogListProps {
  items: TimeLog[];

  // Selected dates to auto-expand panels
  selectedDates?: Date[];
}

const { items: logItems, selectedDates } = defineProps<LogListProps>();

const emit = defineEmits<{
  deleteLog: [log: TimeLog];
  import: [file?: File];
  export: [];
}>();

const { formatInternalDateForDisplay } = useDateDisplay();

// Expanded rows - auto-expand panels for selected dates
const openedPanels = ref<string[]>(
  selectedDates ? selectedDates.map((date) => dayjs(date).format(shortDateFormat)) : [],
);

// Watch selectedDates and update openedPanels accordingly
watch(
  () => selectedDates,
  (newDates) => {
    if (newDates && newDates.length > 0) {
      openedPanels.value = newDates.map((date) => dayjs(date).format(shortDateFormat));
    } else {
      openedPanels.value = [];
    }
  },
  { immediate: true, deep: true },
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

const onDeleteLog = (log: TimeLog) => {
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
  <VCard class="mb-4 elevation-0 border list-container">
    <VCardTitle class="bg-white" style="position: sticky; top: 0; z-index: 1000">
      <VToolbar class="bg-transparent">
        <VToolbarTitle>Logs</VToolbarTitle>

        <VSpacer />

        <div class="d-flex ga-2">
          <!-- Expand logs-->
          <VTooltip>
            <template #activator="{ props }">
              <VIconBtn icon="mdi-arrow-expand" icon-size="small" rounded="lg" @click="onExpand" v-bind="props" />
            </template>
            Expand logs
          </VTooltip>

          <!-- Collapse logs -->
          <VTooltip>
            <template #activator="{ props }">
              <VIconBtn icon="mdi-arrow-collapse" icon-size="small" rounded="lg" @click="onCollapse" v-bind="props" />
            </template>
            Collapse logs
          </VTooltip>

          <!-- Import from file -->
          <VTooltip>
            <template #activator="{ props }">
              <SingleFilePicker
                prepend-icon="mdi-import"
                file-types=".csv"
                @file-selected="readCsv"
                text="Import"
                v-bind="props"
              />
            </template>
            Import data from CSV template
          </VTooltip>

          <!-- Export to file -->
          <VTooltip>
            <template #activator="{ props }">
              <VBtn
                prepend-icon="mdi-file-delimited-outline"
                variant="tonal"
                color="green-darken-3"
                @click="emit('export')"
                v-bind="props"
              >
                Export
              </VBtn>
            </template>
            Export Data to CSV file
          </VTooltip>

          <!-- <VBtn icon="mdi-rocket-launch-outline" color="green-darken-3" @click="emit('export')" />-->
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
          <div class="me-2">{{ formatInternalDateForDisplay(group.date) }}</div>

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

<style scoped>
.list-container {
  height: calc(100vh - 260px);
  overflow-y: scroll;
}
</style>
