<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useDailyTarget } from '@/composables/useDailyTarget';
import { useDateDisplay } from '@/composables/useDateDisplay';
import { computeDateBounds, filterTimeLogs } from '@/composables/useLogFilters';
import { NO_TASK } from '@/composables/useTaskBreakdown';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { useSettingsStore } from '@/stores/settings';
import { chain, sumBy, uniq } from 'lodash';

export interface LogListProps {
  items: TimeLog[];

  // Current month (1-based) — bounds the date-range filter and resets it on change
  currentMonth: number;

  // Selected dates to auto-expand panels
  selectedDates?: Date[];

  // Sits under a chart in the same card: draws the hairline above the toolbar and shows the chart toggle
  hasChart?: boolean;
}

const { items: logItems, selectedDates, currentMonth, hasChart = false } = defineProps<LogListProps>();


// Project focus — two-way synced with Insights + chart through HomeView
const selectedProject = defineModel<string | null>('selectedProject', { default: null });

const emit = defineEmits<{
  editLog: [log: TimeLog];
  cloneLog: [log: TimeLog];
  deleteLog: [log: TimeLog];
  import: [file?: File];
  export: [];
}>();

const { formatInternalDateForDisplay } = useDateDisplay();
const notificationCenter = useNotificationCenterStore();
const settingsStore = useSettingsStore();

const scrollContentRef = ref<HTMLElement | null>(null);

// Scroll to the selected date's expansion panel if it's outside viewport
const scrollToSelectedDate = async (date: Date) => {
  if (!date) return;

  // Wait for DOM to update and panels to expand
  await nextTick();

  // Get the date and find its element
  const dateId = dayjs(date).format(isoDateFormat);
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

// Expanded date panels. Single ref, two disjoint drivers coordinated by
// `hasActiveFilter` (see the watchers below) so they never compete:
//   • no filter → follow calendar selection (original behaviour)
//   • any filter → expand every surviving date
const openedPanels = ref<string[]>([]);

// ── Filter state ──────────────────────────────────────────────────────────────
// All shared (defineModel) so HomeView can compute the same filtered set for Insights'
// filtered-stats section — see docs/features/log-list-filters.md.
const selectedTask = defineModel<string | null>('selectedTask', { default: null });
const searchText = defineModel<string>('searchText', { default: '' });
const dateRangeModel = defineModel<unknown[]>('dateRange', { default: () => [] }); // raw VDatePicker range output (Date[])
const isFilterMenuOpen = ref(false);

// Day total colour against the daily target: over it → error, logged on a weekend/holiday → warning, within
// 30 min of it → primary. No colour when there's no target at all.
const { targetMinutes, isOffDay } = useDailyTarget();
const getColorHint = (date: string, minutes: number) => {
  const target = targetMinutes.value;
  if (!target) return '';

  if (minutes > target) return 'error';
  if (isOffDay(date)) return 'warning';
  if (minutes >= target - 30) return 'primary';
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

// Week start key for a date, derived from the configured firstDayOfWeek (matches WorkTimeBarChart)
const weekStartOf = (date: string) => {
  const d = dayjs(date, isoDateFormat);
  const diff = (d.day() - settingsStore.firstDayOfWeek + 7) % 7;
  return d.subtract(diff, 'day').format(isoDateFormat);
};

// ── Filter option lists (from the month's logs) ─────────────────────────────────
const projectOptions = computed(() => uniq(logItems.map((l) => l.project)).sort());

const taskOptions = computed(() => {
  const scoped = selectedProject.value ? logItems.filter((l) => l.project === selectedProject.value) : logItems;
  const realTasks = uniq(scoped.map((l) => l.task).filter((t): t is string => !!t)).sort();
  return scoped.some((l) => !l.task) ? [...realTasks, NO_TASK] : realTasks;
});

// ── Date-range bounds (clamped to the current month) ────────────────────────────
const monthDate = computed(() => dayjs().month(currentMonth - 1));
const monthMin = computed(() => monthDate.value.startOf('month').toDate());
const monthMax = computed(() => monthDate.value.endOf('month').toDate());

const dateBounds = computed(() => computeDateBounds(dateRangeModel.value));

const dateRangeLabel = computed(() => {
  const b = dateBounds.value;
  return b ? `${b.from.format('MMM D')} – ${b.to.format('MMM D')}` : '';
});

// ── Filtered logs: project → task → date range → text search ────────────────────
const filteredItems = computed(() =>
  filterTimeLogs(logItems, {
    project: selectedProject.value,
    task: selectedTask.value,
    dateBounds: dateBounds.value,
    search: searchText.value,
  }),
);

// Badge counts only the in-panel filters — search has its own always-visible field
const panelFilterCount = computed(
  () => (selectedProject.value ? 1 : 0) + (selectedTask.value ? 1 : 0) + (dateBounds.value ? 1 : 0),
);
const hasActiveFilter = computed(() => panelFilterCount.value > 0 || !!searchText.value.trim());

const clearFilters = () => {
  selectedProject.value = null;
  selectedTask.value = null;
  dateRangeModel.value = [];
  searchText.value = '';
  isFilterMenuOpen.value = false; // close the popup on clear
};

const loggedTimeByDates = computed(() => {
  const groups = chain(filteredItems.value)
    .groupBy((item) => item.date)
    .map((items, date) => ({
      date,
      durationSum: sumBy(items, (item) => item.duration ?? 0),
      tasks: items,
    }))
    .orderBy((item) => item.date)
    .value();

  // Flag the first/last panel of each week so the template can space and round week groups
  return groups.map((group, i) => {
    const week = weekStartOf(group.date);
    const isWeekStart = i === 0 || weekStartOf(groups[i - 1].date) !== week;
    const isWeekEnd = i === groups.length - 1 || weekStartOf(groups[i + 1].date) !== week;
    return { ...group, isWeekStart, isWeekEnd, gapBefore: isWeekStart && i > 0 };
  });
});

// Reset dependent filters when their context changes
watch(selectedProject, () => {
  selectedTask.value = null; // a task belongs to a project
});
watch(
  () => currentMonth,
  () => {
    dateRangeModel.value = []; // range is month-scoped
  },
);

// Driver 1 — calendar selection. Yields to filters (filter owns expansion when active).
watch(
  () => selectedDates,
  (newDates) => {
    if (hasActiveFilter.value) return;
    if (newDates && newDates.length > 0) {
      openedPanels.value = newDates.map((date) => dayjs(date).format(isoDateFormat));
      scrollToSelectedDate(newDates[newDates.length - 1]);
    } else {
      openedPanels.value = [];
    }
  },
  { immediate: true, deep: true },
);

// Driver 2 — filters. Expand every surviving date; on clearing the last filter,
// hand expansion back to the calendar selection.
watch([hasActiveFilter, filteredItems], ([active], [prevActive]) => {
  if (active) {
    openedPanels.value = uniq(filteredItems.value.map((l) => l.date));
  } else if (prevActive) {
    openedPanels.value =
      selectedDates && selectedDates.length > 0 ? selectedDates.map((date) => dayjs(date).format(isoDateFormat)) : [];
  }
});

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
    message: log.task ? `${log.project} · ${log.task}` : log.project,
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

// CSV import: the ⋯ menu item clicks this hidden input. Reset after each pick so the same file can be re-imported.
const csvInput = ref<HTMLInputElement | null>(null);
const onCsvPicked = (event: Event) => {
  const input = event.target as HTMLInputElement;
  emit('import', input.files?.[0]);
  input.value = '';
};
</script>

<template>
  <!-- Logs section: renders no card of its own, the parent card wraps it (with the chart on desktop) -->
  <section class="log-list d-flex flex-column">
    <!-- Toolbar: title + count, search, project filter, chart toggle, ⋯ menu -->
    <div class="log-toolbar" :class="{ 'log-toolbar--below-chart': hasChart }">
      <h3 class="log-toolbar__title">Logs</h3>
      <span class="log-toolbar__count">{{ filteredItems.length }}</span>

      <!-- Search: always visible, compact -->
      <div class="log-search">
        <VTextField
          v-model="searchText"
          placeholder="Search logs"
          prepend-inner-icon="mdi-magnify"
          variant="solo"
          flat
          density="compact"
          hide-details
          single-line
          clearable
          class="log-search__field"
          @click:clear="searchText = ''"
        />
      </div>

      <!-- Project filter: shows the focused project; the popup also holds task + date range -->
      <VMenu v-model="isFilterMenuOpen" :close-on-content-click="false" location="bottom end" offset="8">
        <template #activator="{ props: menuProps }">
          <VBadge
            :model-value="panelFilterCount > 0"
            :content="panelFilterCount"
            color="error"
            offset-x="4"
            offset-y="4"
            class="log-filter"
          >
            <VBtn
              class="log-filter__btn text-none"
              variant="flat"
              rounded="lg"
              height="32"
              prepend-icon="mdi-filter-variant"
              append-icon="mdi-chevron-down"
              v-bind="menuProps"
              v-tooltip="'Filter logs'"
            >
              <span class="log-filter__label">{{ selectedProject ?? 'All projects' }}</span>
            </VBtn>
          </VBadge>
        </template>

        <!-- Controls mirror BulkLogForm styling (default filled variant) -->
        <VCard min-width="300" class="pa-3 d-flex flex-column ga-2">
          <!-- Project (shared with Insights) -->
          <VSelect v-model="selectedProject" :items="projectOptions" label="Project" hide-details clearable />

          <!-- Task (scoped to the selected project) -->
          <VSelect
            v-model="selectedTask"
            :items="taskOptions"
            label="Task"
            hide-details
            clearable
            :disabled="taskOptions.length === 0"
          />

          <!-- Date range (current month) -->
          <VMenu :close-on-content-click="false" location="bottom">
            <template #activator="{ props: dateProps }">
              <VTextField
                v-bind="dateProps"
                :model-value="dateRangeLabel"
                label="Date range"
                hide-details
                readonly
                clearable
                append-inner-icon="mdi-calendar"
                @click:clear="dateRangeModel = []"
              />
            </template>
            <VDatePicker
              :model-value="dateRangeModel"
              multiple="range"
              :first-day-of-week="settingsStore.firstDayOfWeek"
              :min="monthMin"
              :max="monthMax"
              hide-title
              @update:model-value="dateRangeModel = $event"
            />
          </VMenu>

          <!-- Footer -->
          <div class="d-flex justify-end">
            <VBtn variant="text" size="small" :disabled="!hasActiveFilter" @click="clearFilters"> Clear all </VBtn>
          </div>
        </VCard>
      </VMenu>

      <VSpacer />

      <!-- List actions, always at hand: expand/collapse every day, CSV import/export -->
      <VIconBtn
        icon="mdi-arrow-expand"
        aria-label="Expand logs"
        size="32"
        icon-size="20"
        rounded="lg"
        variant="text"
        v-tooltip="'Expand logs'"
        @click="onExpand"
      />
      <VIconBtn
        icon="mdi-arrow-collapse"
        aria-label="Collapse logs"
        size="32"
        icon-size="20"
        rounded="lg"
        variant="text"
        v-tooltip="'Collapse logs'"
        @click="onCollapse"
      />
      <VIconBtn
        icon="mdi-import"
        aria-label="Import CSV"
        size="32"
        icon-size="20"
        rounded="lg"
        variant="text"
        v-tooltip="'Import data from CSV template'"
        @click="csvInput?.click()"
      />
      <VIconBtn
        icon="mdi-export"
        aria-label="Export CSV"
        size="32"
        icon-size="20"
        rounded="lg"
        variant="text"
        v-tooltip="'Export to CSV'"
        @click="emit('export')"
      />
      <input ref="csvInput" type="file" accept=".csv" hidden @change="onCsvPicked" />
    </div>

    <!-- Scrollable content area -->
    <div ref="scrollContentRef" class="scroll-content">
      <!-- No data -->
      <VCard v-if="loggedTimeByDates.length === 0" class="ma-4">
        <div class="d-flex flex-column ga-2 py-4 align-center bg-container rounded text-disabled">
          <VIcon icon="mdi-package-variant-closed" class="text-disabled" />
          <div class="text-subtitle-1 text-disabled">{{ hasActiveFilter ? 'No logs match filters' : 'No data' }}</div>
        </div>
      </VCard>
      <VExpansionPanels variant="accordion" v-model="openedPanels" multiple flat class="pa-2 pt-2 pe-2">
        <VExpansionPanel
          v-for="group in loggedTimeByDates"
          :id="group.date"
          :key="group.date"
          :value="group.date"
          :class="{
            'border-b-sm': !group.isWeekEnd,
            'week-gap': group.gapBefore,
            'week-start': group.isWeekStart,
            'week-end': group.isWeekEnd,
          }"
        >
          <VExpansionPanelTitle>
            <div class="me-2 d-flex align-center ga-2">
              <span class="text-caption text-medium-emphasis" style="min-width: 36px">
                {{ dayjs(group.date, isoDateFormat).format('ddd').toUpperCase() }}
              </span>
              <span class="font-weight-bold" style="min-width: 110px">
                {{ formatInternalDateForDisplay(group.date) }}
              </span>
            </div>

            <VChip prepend-icon="mdi-timer-outline" :color="getColorHint(group.date, group.durationSum)" variant="text">
              {{ minutesToHourWithMinutes(group.durationSum) }}
            </VChip>
          </VExpansionPanelTitle>

          <VExpansionPanelText>
            <VCard class="elevation-0 rounded-lg">
              <VDataTable :items="group.tasks" :headers="headers" class="bg-container" hide-default-footer>
                <template #item.task="{ item }">
                  <span :class="{ 'text-disabled': !item.task }">{{ item.task || '-' }}</span>
                </template>

                <template #item.duration="{ item }">
                  <VChip v-if="item.type === 'plan'" color="success" size="x-small" variant="tonal">Plan</VChip>
                  <span v-else>{{ minutesToHourWithMinutes(item.duration ?? 0) }}</span>
                </template>

                <!--suppress VueUnrecognizedSlot -->
                <template #item.actions="{ item }">
                  <!-- Tooltip as activator="parent" child (not the v-tooltip directive):
                       the directive's update hook throws when these keyed rows re-patch -->
                  <div class="d-flex">
                    <VBtn icon variant="text" size="small" @click="onEditLog(item)">
                      <VIcon icon="mdi-pencil-outline" />
                      <VTooltip activator="parent" text="Edit" />
                    </VBtn>

                    <VBtn icon variant="text" size="small" @click="onCloneLog(item)">
                      <VIcon icon="mdi-content-duplicate" />
                      <VTooltip activator="parent" text="Clone" />
                    </VBtn>

                    <VBtn icon variant="text" size="small" @click="onDeleteLog(item)">
                      <VIcon icon="mdi-trash-can-outline" />
                      <VTooltip activator="parent" text="Delete" />
                    </VBtn>
                  </div>
                </template>
              </VDataTable>
            </VCard>
          </VExpansionPanelText>
        </VExpansionPanel>
      </VExpansionPanels>
    </div>
  </section>
</template>

<style scoped>
.log-list {
  min-height: 0;
}

.scroll-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Toolbar row, framed by hairlines like the mock's sheet; the top one only when a chart sits above it */
.log-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 8px 18px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.09);
}

.log-toolbar--below-chart {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.09);
}

.log-toolbar__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}

.log-toolbar__count {
  font-size: 0.8125rem;
  margin-left: 2px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

.log-search {
  flex: 1 1 260px;
  min-width: 120px;
  max-width: 260px;
  margin-left: 10px;
}

/* 32px tall, softly tinted fields: out-specifies .glass-acrylic .v-field's solid surface */
.log-search__field :deep(.v-field),
.log-filter__btn {
  background-color: rgba(var(--v-theme-on-surface), 0.05) !important;
}

.log-search__field :deep(.v-field) {
  border-radius: 12px;
  min-height: 32px;
  font-size: 0.8125rem;
}

.log-search__field :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
}

.log-search__field :deep(.v-field__prepend-inner) {
  padding-inline-start: 2px;
}

.log-search__field :deep(.v-field__prepend-inner .v-icon) {
  font-size: 18px;
}

.log-filter__btn {
  font-size: 0.8125rem;
  letter-spacing: normal;
  padding-inline: 10px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.log-filter__label {
  display: inline-block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Phones: the funnel + chevron alone, the search field keeps the room */
@media (max-width: 599px) {
  .log-filter__label {
    display: none;
  }
}

/* Week grouping: gap between weeks + rounded corners so each week reads as its own card.
   Scoped to the accordion context to out-specify Vuetify's
   `.v-expansion-panels--variant-accordion > .v-expansion-panel { margin-top: 0; border-radius: 0 }`. */
:deep(.v-expansion-panels--variant-accordion > .v-expansion-panel.week-gap) {
  margin-top: 12px;
}

/* !important mirrors Vuetify's own accordion rule that resets middle-panel radius:
   `... > :not(:first-child):not(:last-child) { border-radius: 0 !important }` */
:deep(.v-expansion-panels--variant-accordion > .v-expansion-panel.week-start) {
  border-top-left-radius: 8px !important;
  border-top-right-radius: 8px !important;
  overflow: hidden;
}

:deep(.v-expansion-panels--variant-accordion > .v-expansion-panel.week-end) {
  border-bottom-left-radius: 8px !important;
  border-bottom-right-radius: 8px !important;
  overflow: hidden;
}
</style>
