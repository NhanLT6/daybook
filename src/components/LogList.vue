<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useDateDisplay } from '@/composables/useDateDisplay';

import SingleFilePicker from '@/components/app/SingleFilePicker.vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
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
}

const { items: logItems, selectedDates, currentMonth } = defineProps<LogListProps>();

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

// Expanded date panels. Single ref, two disjoint drivers coordinated by
// `hasActiveFilter` (see the watchers below) so they never compete:
//   • no filter → follow calendar selection (original behaviour)
//   • any filter → expand every surviving date
const openedPanels = ref<string[]>([]);

// ── Filter state ──────────────────────────────────────────────────────────────
// `selectedProject` is shared (defineModel above); the rest are LogList-local.
const selectedTask = ref<string | null>(null);
const searchText = ref('');
const dateRangeModel = ref<unknown[]>([]); // raw VDatePicker range output (Date[])
const isFilterMenuOpen = ref(false);

// Toolbar search: collapsed to a magnify button, expands to a field on demand
const searchExpanded = ref(false);
const searchFieldRef = ref<{ focus: () => void } | null>(null);

const toggleSearch = async () => {
  // Toggling closed also clears the query so no hidden filter lingers
  if (searchExpanded.value) {
    searchExpanded.value = false;
    searchText.value = '';
    return;
  }
  searchExpanded.value = true;
  await nextTick();
  searchFieldRef.value?.focus();
};

// Collapse when focus leaves an empty field — an active query stays visible
const onSearchFocusChange = (focused: boolean) => {
  if (!focused && !searchText.value.trim()) searchExpanded.value = false;
};

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

// Week start key for a date, derived from the configured firstDayOfWeek (matches WorkTimeBarChart)
const weekStartOf = (date: string) => {
  const d = dayjs(date, shortDateFormat);
  const diff = (d.day() - settingsStore.firstDayOfWeek + 7) % 7;
  return d.subtract(diff, 'day').format('YYYY-MM-DD');
};

// ── Filter option lists (from the month's logs) ─────────────────────────────────
const projectOptions = computed(() => uniq(logItems.map((l) => l.project)).sort());

const taskOptions = computed(() => {
  const scoped = selectedProject.value ? logItems.filter((l) => l.project === selectedProject.value) : logItems;
  return uniq(scoped.map((l) => l.task)).sort();
});

// ── Date-range bounds (clamped to the current month) ────────────────────────────
const monthDate = computed(() => dayjs().month(currentMonth - 1));
const monthMin = computed(() => monthDate.value.startOf('month').toDate());
const monthMax = computed(() => monthDate.value.endOf('month').toDate());

const dateBounds = computed(() => {
  const arr = dateRangeModel.value;
  if (!arr.length) return null;
  return {
    from: dayjs(arr[0] as Date).startOf('day'),
    to: dayjs(arr[arr.length - 1] as Date).endOf('day'),
  };
});

const dateRangeLabel = computed(() => {
  const b = dateBounds.value;
  return b ? `${b.from.format('MMM D')} – ${b.to.format('MMM D')}` : '';
});

// ── Filtered logs: project → task → date range → text search ────────────────────
const filteredItems = computed(() => {
  let result = logItems;
  if (selectedProject.value) result = result.filter((l) => l.project === selectedProject.value);
  if (selectedTask.value) result = result.filter((l) => l.task === selectedTask.value);
  const bounds = dateBounds.value;
  if (bounds) {
    result = result.filter((l) => {
      const d = dayjs(l.date, shortDateFormat);
      return d.isValid() && !d.isBefore(bounds.from) && !d.isAfter(bounds.to);
    });
  }
  const q = searchText.value.trim().toLowerCase();
  if (q) {
    result = result.filter((l) => [l.project, l.task, l.description].some((f) => f?.toLowerCase().includes(q)));
  }
  return result;
});

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
      openedPanels.value = newDates.map((date) => dayjs(date).format(shortDateFormat));
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
      selectedDates && selectedDates.length > 0
        ? selectedDates.map((date) => dayjs(date).format(shortDateFormat))
        : [];
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

        <div class="d-flex ga-2 align-center">
          <!-- Search: magnify button that expands into a field (button hides while open) -->
          <div class="log-search" :class="{ 'log-search--open': searchExpanded }">
            <VIconBtn
              v-if="!searchExpanded"
              icon="mdi-magnify"
              icon-size="small"
              rounded="lg"
              variant="flat"
              @click="toggleSearch"
              v-tooltip="'Search'"
            />
            <div class="log-search__wrap">
              <VTextField
                ref="searchFieldRef"
                v-model="searchText"
                placeholder="Search"
                prepend-inner-icon="mdi-magnify"
                variant="plain"
                density="compact"
                hide-details
                single-line
                clearable
                class="log-search__field"
                @click:clear="searchText = ''"
                @update:focused="onSearchFocusChange"
              />
            </div>
          </div>

          <!-- Filters -->
          <VMenu v-model="isFilterMenuOpen" :close-on-content-click="false" location="bottom end" offset="8">
            <template #activator="{ props: menuProps }">
              <VBadge
                :model-value="panelFilterCount > 0"
                :content="panelFilterCount"
                color="error"
                offset-x="6"
                offset-y="6"
              >
                <VIconBtn
                  icon="mdi-filter-variant"
                  icon-size="small"
                  rounded="lg"
                  variant="flat"
                  v-bind="menuProps"
                  v-tooltip="'Filter logs'"
                />
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

          <!-- Expand logs-->
          <VIconBtn
            icon="mdi-arrow-expand"
            icon-size="small"
            rounded="lg"
            variant="flat"
            @click="onExpand"
            v-tooltip="'Expand logs'"
          />

          <!-- Collapse logs -->
          <VIconBtn
            icon="mdi-arrow-collapse"
            icon-size="small"
            rounded="lg"
            variant="flat"
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
                variant="flat"
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
            variant="flat"
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
  </VCard>
</template>

<style scoped>
.scroll-content {
  flex: 1;
  overflow-y: auto;
}

/* Toolbar search: magnify button expands into a field */
.log-search {
  display: flex;
  align-items: center;
}

/* Collapsed = width 0; opening animates the wrap open (field is clipped by overflow) */
.log-search__wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.25s ease;
}

.log-search--open .log-search__wrap {
  width: 180px;
}

/* Keep the field's intrinsic width so text doesn't reflow mid-animation */
.log-search__field {
  min-width: 180px;
}

/* Match the icon buttons' 40px height (compact density otherwise makes it shorter) */
.log-search__field :deep(.v-field) {
  border-radius: 8px;
  min-height: 40px;
}

.log-search__field :deep(.v-field__input) {
  min-height: 40px;
  padding-top: 0;
  padding-bottom: 0;
}

/* Nudge the magnify icon off the left edge */
.log-search__field :deep(.v-field__prepend-inner) {
  padding-inline-start: 8px;
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
