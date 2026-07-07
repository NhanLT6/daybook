<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useDateDisplay } from '@/composables/useDateDisplay';

import SingleFilePicker from '@/components/app/SingleFilePicker.vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { chain, sumBy } from 'lodash';

export interface LogListProps {
  items: TimeLog[];

  // Selected dates to auto-expand panels
  selectedDates?: Date[];
}

const { items: logItems, selectedDates } = defineProps<LogListProps>();

const emit = defineEmits<{
  editLog: [log: TimeLog];
  cloneLog: [log: TimeLog];
  deleteLog: [log: TimeLog];
  import: [file?: File];
  export: [];
}>();

const { formatInternalDateForDisplay } = useDateDisplay();
const notificationCenter = useNotificationCenterStore();

const scrollContentRef = ref<HTMLElement | null>(null);

// Scroll to the selected date's expansion panel if it's outside viewport
const scrollToSelectedDate = async (date: Date) => {
  if (!date) return;

  // Wait for DOM to update and panels to expand
  await nextTick();

  // Get the date and find its element
  const dateId = dayjs(date).format(shortDateFormat);
  const element = document.getElementById(dateId);
  if (!element) return;

  const rect = element.getBoundingClientRect();

  const container = scrollContentRef.value;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();

  const isOutsideContainer = rect.top < containerRect.top || rect.bottom > containerRect.bottom;
  if (isOutsideContainer) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

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
      const lastSelectedDate = newDates[newDates.length - 1];
      scrollToSelectedDate(lastSelectedDate);
    } else {
      openedPanels.value = [];
    }
  },
  { immediate: true, deep: true },
);

const getColorHint = (minutes: number) => {
  const hours = dayjs.duration({ minutes }).asHours();

  if (hours >= 7.5 && hours <= 8) {
    return 'primary';
  }

  if (hours > 8) {
    return 'error';
  }

  return '';
};

// Table

const headers = ref([
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
      durationSum: sumBy(items, (item) => item.duration ?? 0),
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

const onEditLog = (log: TimeLog) => {
  emit('editLog', log);
};

const onCloneLog = (log: TimeLog) => {
  emit('cloneLog', log);
};

const onDeleteLog = (log: TimeLog) => {
  notificationCenter.confirm('Delete log?', {
    message: `${log.project} · ${log.task}`,
    actions: [
      {
        id: 'cancel',
        label: 'Cancel',
        closeOnComplete: true,
      },
      {
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        closeOnComplete: true,
        onClick: () => {
          emit('deleteLog', log);
        },
      },
    ],
  });
};

const readCsv = (file?: File) => {
  emit('import', file);
};
</script>

<template>
  <VCard class="glass-acrylic d-flex flex-column">
    <VCardTitle style="position: sticky; top: 0; z-index: 1000">
      <VToolbar>
        <VToolbarTitle class="ms-0">Logs</VToolbarTitle>

        <VSpacer />

        <div class="d-flex ga-2">
          <!-- Expand logs-->
          <VIconBtn
            icon="mdi-arrow-expand"
            icon-size="small"
            rounded="lg"
            @click="onExpand"
            v-tooltip="'Expand logs'"
          />

          <!-- Collapse logs -->
          <VIconBtn
            icon="mdi-arrow-collapse"
            icon-size="small"
            rounded="lg"
            @click="onCollapse"
            v-tooltip="'Collapse logs'"
          />

          <!-- Import from file -->
          <VTooltip>
            <template #activator="{ props }">
              <SingleFilePicker
                file-types=".csv"
                @file-selected="readCsv"
                icon="mdi-import"
                icon-size="small"
                rounded="lg"
                v-bind="props"
              />
            </template>
            Import data from CSV template
          </VTooltip>

          <!-- Export to file -->
          <VIconBtn
            icon="mdi-export"
            icon-size="small"
            rounded="lg"
            color="primary"
            variant="tonal"
            @click="emit('export')"
            v-tooltip="'Export to CSV'"
          />
        </div>
      </VToolbar>
    </VCardTitle>

    <!-- Scrollable content area -->
    <div ref="scrollContentRef" class="scroll-content">
      <!-- No data -->
      <VCard v-if="loggedTimeByDates.length === 0" class="ma-4">
        <div class="d-flex flex-column ga-2 py-4 align-center bg-container rounded text-disabled">
          <VIcon icon="mdi-package-variant-closed" class="text-disabled" />
          <div class="text-subtitle-1 text-disabled">No data</div>
        </div>
      </VCard>

      <VExpansionPanels variant="accordion" v-model="openedPanels" multiple flat class="pa-2 pt-2 pe-2">
        <VExpansionPanel
          v-for="group in loggedTimeByDates"
          :id="group.date"
          :key="group.date"
          :value="group.date"
          class="border-b-sm"
        >
          <VExpansionPanelTitle>
            <div class="me-2 d-flex align-center ga-2">
              <span class="text-caption text-medium-emphasis" style="min-width: 36px">
                {{ dayjs(group.date, shortDateFormat).format('ddd').toUpperCase() }}
              </span>
              <span class="font-weight-bold" style="min-width: 110px">
                {{ formatInternalDateForDisplay(group.date) }}
              </span>
            </div>

            <VChip prepend-icon="mdi-timer-outline" :color="getColorHint(group.durationSum)" variant="text">
              {{ minutesToHourWithMinutes(group.durationSum) }}
            </VChip>
          </VExpansionPanelTitle>

          <VExpansionPanelText>
            <VCard class="elevation-0 rounded-lg">
              <VDataTable :items="group.tasks" :headers="headers" class="bg-container" hide-default-footer>
                <template #item.duration="{ item }">
                  <VChip v-if="item.type === 'plan'" color="success" size="x-small" variant="tonal">Plan</VChip>
                  <span v-else>{{ minutesToHourWithMinutes(item.duration ?? 0) }}</span>
                </template>

                <!--suppress VueUnrecognizedSlot -->
                <template #item.actions="{ item }">
                  <div class="d-flex ga-2">
                    <VBtn
                      icon="mdi-pencil-outline"
                      variant="text"
                      size="small"
                      @click="onEditLog(item)"
                      v-tooltip="'Edit'"
                    />

                    <VBtn
                      icon="mdi-content-duplicate"
                      variant="text"
                      size="small"
                      @click="onCloneLog(item)"
                      v-tooltip="'Clone'"
                    />

                    <VBtn
                      icon="mdi-trash-can-outline"
                      variant="text"
                      size="small"
                      @click="onDeleteLog(item)"
                      v-tooltip="'Delete'"
                    />
                  </div>
                </template>
              </VDataTable>
            </VCard>
          </VExpansionPanelText>
        </VExpansionPanel>
      </VExpansionPanels>
    </div>
  </VCard>
</template>

<style scoped>
.scroll-content {
  flex: 1;
  overflow-y: auto;
}
</style>
