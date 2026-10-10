<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import BulkLogForm from '@/components/BulkLogForm.vue';
import InsightsPanel from '@/components/InsightsPanel.vue';
import LogList from '@/components/LogList.vue';
import MobileWeekChart from '@/components/MobileWeekChart.vue';
import TodayEvents from '@/components/TodayEvents.vue';
import WorkTimeBarChart from '@/components/WorkTimeBarChart.vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import { useDisplay } from 'vuetify';

import { useNow } from '@vueuse/core';

import dayjs from 'dayjs';

import { isoDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { useInsightsDrawer } from '@/composables/useInsightsDrawer';
import { computeDateBounds, filterTimeLogs } from '@/composables/useLogFilters';
import { REMEMBER_DATE_EXPIRY_MS, getRememberedDate } from '@/composables/useRememberDate';
import { useTimeLogs } from '@/composables/useTimeLogs';
import { useWorkspace } from '@/composables/useWorkspace';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { useSettingsStore } from '@/stores/settings';
import { xeroExportCsv, xeroImportCsv } from '@/xero/xeroCsv';
import { saveAs } from 'file-saver';
import { uniqBy } from 'lodash';
import { nanoid } from 'nanoid';

const { logs, forMonth, save, remove: removeLog, addMany: addLogs } = useTimeLogs();
const { addProjects, addTasks } = useWorkspace();

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
  insightsDrawerOpen.value = false; // never auto-reopen when returning to Home
});

const initialDate = readRememberedDate();
const selectedDates = ref<Date[]>(initialDate ? [initialDate] : []);

// Resume the auto-deselect timer for remaining window when loading a remembered date
if (initialDate && settingsStore.lastSelectedDate) {
  const remaining = REMEMBER_DATE_EXPIRY_MS - (Date.now() - settingsStore.lastSelectedDate.savedAt);
  if (remaining > 0) startAutoDeselectTimer(remaining);
}
const currentMonth = ref<number>(dayjs().month() + 1); // Convert from 0-based to 1-based
const selectedProject = ref<string | null>(null);
// Rest of LogList's filter state, lifted here (same pattern as selectedProject) so
// Insights can compute stats for the logs LogList is actually showing.
const selectedTask = ref<string | null>(null);
const searchText = ref('');
const dateRangeModel = ref<unknown[]>([]);
const editingLog = ref<TimeLog | undefined>(undefined);

// Clone: seed the form (create mode) with a source log's fields, dated today.
// `nonce` is bumped on every clone so the form re-seeds even when the same log is
// cloned twice in a row (see cloneSeed prop in BulkLogForm).
interface CloneSeed {
  project: string;
  task?: string;
  duration?: number;
  description?: string;
  nonce: number;
}
const cloneSeed = ref<CloneSeed | undefined>(undefined);
let cloneNonce = 0;

// Keep the calendar navigated to the current month for long-running tabs
watch(todayDateStr, () => {
  if (!editingLog.value) {
    currentMonth.value = dayjs().month() + 1;
  }
});

const { smAndDown } = useDisplay();
const { isOpen: insightsDrawerOpen, isInline: insightsInline, showInline: insightsShowInline } = useInsightsDrawer();

// Logs for the calendar's current month (ISO 'YYYY-MM'). Assumes current year —
// matches prior behavior; cross-year navigation would need a year threaded alongside.
const timeLogs = computed(() => forMonth(dayjs().month(currentMonth.value - 1).format('YYYY-MM')));

const dateBounds = computed(() => computeDateBounds(dateRangeModel.value));
const hasActiveFilter = computed(
  () => !!(selectedProject.value || selectedTask.value || dateBounds.value || searchText.value.trim()),
);
const filteredTimeLogs = computed(() =>
  filterTimeLogs(timeLogs.value, {
    project: selectedProject.value,
    task: selectedTask.value,
    dateBounds: dateBounds.value,
    search: searchText.value,
  }),
);

const onMonthChanged = (month: number) => {
  currentMonth.value = month; // v-calendar uses 1-based months (1-12)
};

// Logs

const saveBulkLogs = async (incoming: TimeLog[]) => {
  let addedCount = 0;
  let updatedCount = 0;
  const existingIds = new Set(logs.value.map((l) => l.id));

  // Handle both create and update based on log ID
  for (const log of incoming) {
    if (existingIds.has(log.id)) updatedCount += 1;
    else addedCount += 1;
    await save({ ...log, date: dayjs(log.date, [isoDateFormat, 'MM/DD/YYYY']).format(isoDateFormat) });
  }

  if (updatedCount) {
    notificationCenter.success(updatedCount === 1 ? 'Log updated' : `${updatedCount} logs updated`);
  }

  if (addedCount) {
    notificationCenter.success(addedCount === 1 ? 'Log added' : `${addedCount} logs added`);
  }

  const isSingleCreate = !editingLog.value && incoming.length === 1;
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
  selectedDates.value = [dayjs(log.date, [isoDateFormat, 'MM/DD/YYYY']).toDate()];
};

// Clone a log: copy its fields into the form as a new (create-mode) entry dated today.
const onCloneLog = (log: TimeLog) => {
  editingLog.value = undefined; // ensure create mode, not edit
  selectedDates.value = [dayjs().toDate()]; // today
  cloneSeed.value = {
    project: log.project,
    task: log.task,
    duration: log.duration,
    description: log.description,
    nonce: ++cloneNonce,
  };
};

// Insights "Not logged" chips: act like a calendar click (replace while editing, else toggle), then
// bring the form into view — closing the drawer when Insights is shown in it
const revealForm = () => {
  if (!insightsInline.value) insightsDrawerOpen.value = false;
};

const onToggleMissingDate = (date: string) => {
  const fmt = (d: Date) => dayjs(d).format(isoDateFormat);
  if (editingLog.value) {
    selectedDates.value = [dayjs(date, isoDateFormat).toDate()];
  } else {
    const exists = selectedDates.value.some((d) => fmt(d) === date);
    selectedDates.value = exists
      ? selectedDates.value.filter((d) => fmt(d) !== date)
      : [...selectedDates.value, dayjs(date, isoDateFormat).toDate()];
  }
  revealForm();
};

const onDeleteLog = async (log: TimeLog) => {
  await removeLog(log.id);
  notificationCenter.success('Log deleted');
};

const exportToCsv = () => {
  const csv = xeroExportCsv(timeLogs.value);

  // Save Csv file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `TimeLog-${dayjs().format(yearAndMonthFormat)}.csv`);
};

const importCsv = async (file?: File) => {
  if (!file) return;

  const fileContent = await file.text();

  let dataWithIds: TimeLog[];
  try {
    dataWithIds = xeroImportCsv(fileContent);
  } catch (e) {
    notificationCenter.error('Import failed', { message: (e as Error).message });
    console.error(e);
    return;
  }

  await addLogs(dataWithIds.map((l) => ({ ...l, id: l.id ?? nanoid() })));
  await addProjects(uniqBy(dataWithIds.map((l) => ({ title: l.project })), 'title'));
  await addTasks(
    uniqBy(
      dataWithIds.filter((l) => l.task).map((l) => ({ project: l.project, title: l.task! })),
      (t) => `${t.project}-${t.title}`,
    ),
  );

  notificationCenter.success('Logs imported');
};
</script>

<template>
  <!-- Three-column layout: form | chart+logs | insights (lg+) -->
  <div class="home-layout">
    <!-- Left panel: log form, scrollable so its sticky actions work -->
    <VCard class="glass-acrylic form-panel d-flex flex-column overflow-hidden">
      <div class="form-scroll overflow-y-auto">
        <!-- Today's events, if any: a quiet reminder before logging -->
        <TodayEvents class="mx-4 mt-3" />
        <BulkLogForm
          v-model:selected-dates="selectedDates"
          :editing-log="editingLog"
          :clone-seed="cloneSeed"
          @submit="saveBulkLogs"
          @cancel="onBulkCancel"
          @month-changed="onMonthChanged"
        />
      </div>
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
      <WorkTimeBarChart v-else :current-month="currentMonth" :selected-project="selectedProject" class="flex-shrink-0" />

      <!-- Log list -->
      <LogList
        class="flex-grow-1 overflow-hidden"
        :items="timeLogs"
        :current-month="currentMonth"
        :selected-dates="selectedDates"
        v-model:selected-project="selectedProject"
        v-model:selected-task="selectedTask"
        v-model:date-range="dateRangeModel"
        v-model:search-text="searchText"
        @edit-log="onEditLog"
        @clone-log="onCloneLog"
        @delete-log="onDeleteLog"
        @import="importCsv"
        @export="exportToCsv"
      />
    </div>

    <!-- Right panel: Insights — inline only on wide viewports (>= INSIGHTS_INLINE_MIN), hideable from the header -->
    <InsightsPanel
      v-if="insightsShowInline"
      class="insights-panel"
      :time-logs="timeLogs"
      :current-month="currentMonth"
      :filtered-time-logs="filteredTimeLogs"
      :has-active-filter="hasActiveFilter"
      :selected-dates="selectedDates"
      @toggle-date="onToggleMissingDate"
      v-model:selected-project="selectedProject"
    />

    <!-- Small screens: same panel in an opt-in right drawer (toggled from the header).
         Transparent shell + side gaps so the panel floats like the app's other glass cards. -->
    <VNavigationDrawer
      v-if="!insightsInline"
      v-model="insightsDrawerOpen"
      location="right"
      temporary
      width="332"
      class="insights-drawer"
    >
      <InsightsPanel
        :time-logs="timeLogs"
        :current-month="currentMonth"
        :filtered-time-logs="filteredTimeLogs"
        :has-active-filter="hasActiveFilter"
        :selected-dates="selectedDates"
        @toggle-date="onToggleMissingDate"
        v-model:selected-project="selectedProject"
      />
    </VNavigationDrawer>
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

/* Insights drawer (small screens): float the panel like the app's other glass
   cards — start below the app bar, gaps on the sides — instead of an
   edge-to-edge slab. The transparent shell lets the panel's own glass show. */
.insights-drawer {
  top: 65px !important; /* clear the 53px app bar + a 12px gap */
  bottom: 12px !important;
  height: auto !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* Content flexes so the panel fills the shell; padding-right lifts it off the
   screen edge (top/bottom gaps come from the shell offsets above). */
.insights-drawer :deep(.v-navigation-drawer__content) {
  display: flex;
  padding-right: 12px;
}

.insights-drawer :deep(.v-navigation-drawer__content) > * {
  flex: 1;
  min-height: 0;
}

.form-scroll {
  flex: 1;
  min-height: 0;
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

  /* Clear the overflow contexts so sticky form buttons work against page scroll */
  .form-panel .form-scroll {
    overflow: visible !important;
  }
}
</style>
