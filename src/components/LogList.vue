<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useDailyTarget } from '@/composables/useDailyTarget';
import { useDateDisplay } from '@/composables/useDateDisplay';
import { computeDateBounds, filterTimeLogs } from '@/composables/useLogFilters';
import { NO_TASK } from '@/composables/useTaskBreakdown';

import GroupedTable from '@/components/GroupedTable.vue';
import ListPanel from '@/components/ListPanel.vue';

import type { TableColumn } from '@/components/GroupedTable.vue';
import type { TimeLog } from '@/interfaces/TimeLog';

import { useDisplay } from 'vuetify';

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
const { smAndUp } = useDisplay();

const panel = ref<InstanceType<typeof ListPanel> | null>(null);

// Scroll to the selected date's group if it's outside the list's viewport
const scrollToSelectedDate = async (date: Date) => {
  if (!date) return;

  // Wait for DOM to update and panels to expand
  await nextTick();

  // Get the date and find its element
  const dateId = dayjs(date).format(isoDateFormat);
  const element = document.getElementById(dateId);
  if (!element) return;

  const rect = element.getBoundingClientRect();

  const container = panel.value?.body;
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

const columns: TableColumn[] = [
  { key: 'project', title: 'Project' },
  { key: 'task', title: 'Task', hideBelow: 'sm' },
  { key: 'duration', title: 'Duration', width: 104, align: 'end' },
  { key: 'description', title: 'Description', hideBelow: 'md' },
];

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

  // One table group per day, keyed (and DOM id'd) by its date; a gap opens before each new week
  return groups.map((group, i) => ({
    ...group,
    key: group.date,
    id: group.date,
    rows: group.tasks,
    gapBefore: i > 0 && weekStartOf(groups[i - 1].date) !== weekStartOf(group.date),
  }));
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
  <ListPanel
    ref="panel"
    v-model:search="searchText"
    class="log-list"
    title="Logs"
    :count="filteredItems.length"
    search-placeholder="Search logs"
    :divided="hasChart"
  >
    <!-- Project filter: shows the focused project; the popup also holds task + date range -->
    <template #filters>
      <VMenu v-model="isFilterMenuOpen" :close-on-content-click="false" location="bottom end" offset="8">
        <template #activator="{ props: menuProps }">
          <VBadge
            :model-value="panelFilterCount > 0"
            :content="panelFilterCount"
            color="error"
            offset-x="4"
            offset-y="4"
          >
            <VBtn
              class="list-filter-btn"
              variant="flat"
              rounded="lg"
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
    </template>

    <!-- List actions, always at hand: expand/collapse every day, CSV import/export -->
    <template #actions>
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
    </template>

    <!-- Days as collapsible table groups, their logs as rows -->
    <GroupedTable
      v-if="loggedTimeByDates.length > 0"
      v-model:expanded="openedPanels"
      :columns="columns"
      :groups="loggedTimeByDates"
      :row-key="(log) => log.id"
      collapsible
    >
      <!-- Day row: weekday + date, the day's total under Duration -->
      <template #group="{ group }">
        <span class="log-day__weekday">{{ dayjs(group.date, isoDateFormat).format('ddd').toUpperCase() }}</span>
        <span class="font-weight-medium">{{ formatInternalDateForDisplay(group.date) }}</span>
      </template>

      <template #group.duration="{ group }">
        <span
          class="log-day__total"
          :class="getColorHint(group.date, group.durationSum) && `text-${getColorHint(group.date, group.durationSum)}`"
        >
          {{ minutesToHourWithMinutes(group.durationSum) }}
        </span>
      </template>

      <!-- Phones drop the Task column, so the task rides under the project -->
      <template #cell.project="{ row }">
        <div>{{ row.project }}</div>
        <div v-if="!smAndUp && row.task" class="text-caption text-medium-emphasis">{{ row.task }}</div>
      </template>

      <template #cell.task="{ row }">
        <span :class="{ 'text-disabled': !row.task }">{{ row.task || '-' }}</span>
      </template>

      <template #cell.duration="{ row }">
        <VChip v-if="row.type === 'plan'" color="success" size="x-small" variant="tonal">Plan</VChip>
        <span v-else>{{ minutesToHourWithMinutes(row.duration ?? 0) }}</span>
      </template>

      <template #cell.description="{ row }">
        <span class="text-medium-emphasis">{{ row.description }}</span>
      </template>

      <!-- Tooltip as activator="parent" child (not the v-tooltip directive):
           the directive's update hook throws when these keyed rows re-patch -->
      <template #actions="{ row }">
        <VBtn icon variant="text" size="28" rounded="lg" aria-label="Edit" @click="onEditLog(row)">
          <VIcon icon="mdi-pencil-outline" size="16" />
          <VTooltip activator="parent" text="Edit" />
        </VBtn>

        <VBtn icon variant="text" size="28" rounded="lg" aria-label="Clone" @click="onCloneLog(row)">
          <VIcon icon="mdi-content-duplicate" size="16" />
          <VTooltip activator="parent" text="Clone" />
        </VBtn>

        <VBtn icon variant="text" size="28" rounded="lg" aria-label="Delete" @click="onDeleteLog(row)">
          <VIcon icon="mdi-trash-can-outline" size="16" />
          <VTooltip activator="parent" text="Delete" />
        </VBtn>
      </template>
    </GroupedTable>

    <!-- No data -->
    <div v-else class="list-empty">
      <VIcon icon="mdi-package-variant-closed" />
      <div>{{ hasActiveFilter ? 'No logs match filters' : 'No data' }}</div>
    </div>
  </ListPanel>
</template>

<style scoped>
.log-list {
  min-height: 0;
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

.log-day__weekday {
  min-width: 32px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.log-day__total {
  font-weight: 500;
}
</style>
