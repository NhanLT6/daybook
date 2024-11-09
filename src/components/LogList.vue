<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { XeroLog } from '@/interfaces/XeroLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
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
}>();

// Expanded rows
const openedPanels = ref<string[]>([]);

watch(
  () => selectedDate,
  () => {
    const selectedDateString = dayjs(selectedDate).format(shortDateFormat);
    openedPanels.value = [selectedDateString];
  },
);

const getColorHint = (duration: number) => {
  if (duration >= 7.5 && duration <= 8) {
    return 'green-darken-3';
  }

  if (duration > 8) {
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
  { title: 'Actions', key: 'actions', sortable: false },
]);

const loggedTimeByDates = computed(() =>
  chain(logItems)
    .groupBy('date')
    .map((items, date) => ({
      date,
      totalDuration: sumBy(items, 'duration'),
      tasks: items,
    }))
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
</script>

<template>
  <VCard class="mb-4 elevation-0 border">
    <VCardTitle>
      <VToolbar class="bg-transparent">
        <VToolbarTitle>Logged time</VToolbarTitle>

        <VSpacer />

        <div class="d-flex ga-1">
          <VBtn icon="mdi-arrow-expand" @click="onExpand" />
          <VBtn icon="mdi-arrow-collapse" @click="onCollapse" />
          <VBtn icon="mdi-file-delimited-outline" />
        </div>
      </VToolbar>
    </VCardTitle>

    <VExpansionPanels variant="accordion" v-model="openedPanels" multiple>
      <VExpansionPanel v-for="group in loggedTimeByDates" :key="group.date" :value="group.date">
        <VExpansionPanelTitle>
          <div class="me-2">{{ group.date }}</div>

          <VChip prepend-icon="mdi-timer-outline" :color="getColorHint(group.totalDuration)">
            {{ group.totalDuration }}
          </VChip>
        </VExpansionPanelTitle>

        <VExpansionPanelText>
          <VCard class="elevation-0 rounded-4">
            <VDataTable :items="group.tasks" :headers="headers" class="bg-grey-lighten-4" hide-default-footer>
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
