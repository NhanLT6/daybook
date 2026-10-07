<script setup lang="ts">
import { computed } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';

import { useNow } from '@vueuse/core';

import dayjs from 'dayjs';

import { isoDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { computeTaskBreakdown, type TaskBreakdownItem } from '@/composables/useTaskBreakdown';
import { useWorkCalendar } from '@/composables/useWorkCalendar';
import { sumBy, uniqBy } from 'lodash';

const props = defineProps<{
  timeLogs: TimeLog[];
  currentMonth: number;
  // The logs LogList is currently showing (project/task/date range/search applied) —
  // see src/composables/useLogFilters.ts. Powers the "Filtered" stats section below.
  filteredTimeLogs: TimeLog[];
  hasActiveFilter: boolean;
}>();

const selectedProject = defineModel<string | null>('selectedProject', { default: null });

const { getProjectColor, getTaskColors } = useProjectColors();
const workCalendar = useWorkCalendar();
const now = useNow({ interval: 60_000 });

// Alpha-hex suffixes appended to a project colour for the selected-row tints
const SELECTED_TINT = '40'; // ~25% — selected project title
const DETAIL_TINT = '1A'; // ~10% — expanded breakdown body

// Per-project task breakdown, limited to the projects actually rendered below.
// Keyed by project name; absent = "simple" project (no expandable detail).
const breakdownByProject = computed(() => {
  const map: Record<string, TaskBreakdownItem[]> = {};
  for (const { project } of projectBreakdown.value) {
    const breakdown = computeTaskBreakdown(props.timeLogs, project);
    if (breakdown.hasBreakdown) map[project] = breakdown.tasks;
  }
  return map;
});

// Task color shades per breakdown project (matches the chart's coloring).
const taskColorsByProject = computed(() => {
  const map: Record<string, Record<string, string>> = {};
  for (const [project, tasks] of Object.entries(breakdownByProject.value)) {
    map[project] = getTaskColors(
      project,
      tasks.map((t) => t.task),
    );
  }
  return map;
});

// Sync the single-open accordion with the shared selectedProject state.
const onPanelChange = (value: string | undefined) => {
  selectedProject.value = value ?? null;
};

// ── Totals ────────────────────────────────────────────────────────────────────

const totalMinutes = computed(() => sumBy(props.timeLogs, (l) => l.duration ?? 0));

const currentMonthKey = computed(() => {
  // currentMonth is 1-based; convert to 0-based for dayjs
  return dayjs()
    .month(props.currentMonth - 1)
    .format(yearAndMonthFormat);
});

// ── Overview: how complete the month's logging is ───────────────────────────────

// Workdays of the month: not a weekend day (Settings) and not a holiday event
const workdays = computed(() => {
  const month = dayjs(currentMonthKey.value, yearAndMonthFormat);
  const { weekendDays, holidays } = workCalendar.value;
  return Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1))
    .filter((day) => !weekendDays.includes(day.day()) && !holidays.has(day.format(isoDateFormat)))
    .map((day) => day.format(isoDateFormat));
});

// Days with logged time — plan entries have no duration and don't count
const loggedDates = computed(
  () => new Set(props.timeLogs.filter((l) => (l.duration ?? 0) > 0).map((l) => l.date)),
);

const daysLogged = computed(() => loggedDates.value.size);
const daysProgress = computed(() =>
  workdays.value.length > 0 ? Math.min(100, (daysLogged.value / workdays.value.length) * 100) : 0,
);

// Workdays before today with nothing logged — the gaps to fill before syncing the month to Xero.
// Today is left out: it isn't missing while it's still being worked.
const today = computed(() => dayjs(now.value).format(isoDateFormat));
const pastWorkdays = computed(() => workdays.value.filter((day) => day < today.value));
const missingDays = computed(() => pastWorkdays.value.filter((day) => !loggedDates.value.has(day)));

const MISSING_SHOWN = 4;
const missingLabel = computed(() => {
  if (missingDays.value.length === 0) return 'None';
  const shown = missingDays.value.slice(0, MISSING_SHOWN).map((day) => dayjs(day, isoDateFormat).format('MMM D'));
  const more = missingDays.value.length - shown.length;
  return `${shown.join(', ')}${more > 0 ? ` +${more} more` : ''}`;
});

const avgPerDay = computed(() => (daysLogged.value > 0 ? Math.round(totalMinutes.value / daysLogged.value) : 0));

// ── Project breakdown ─────────────────────────────────────────────────────────

interface ProjectBreakdownItem {
  project: string;
  minutes: number;
  pct: number;
}

const allProjectsSorted = computed((): ProjectBreakdownItem[] => {
  const total = totalMinutes.value;
  if (total === 0) return [];

  const grouped: Record<string, number> = {};
  for (const log of props.timeLogs) {
    grouped[log.project] = (grouped[log.project] ?? 0) + (log.duration ?? 0);
  }

  return Object.entries(grouped)
    .map(([project, minutes]) => ({
      project,
      minutes,
      pct: Math.round((minutes / total) * 100),
    }))
    .sort((a, b) => b.minutes - a.minutes);
});

const projectBreakdown = computed(() => allProjectsSorted.value.slice(0, 6));

const uniqueProjectCount = computed(() => allProjectsSorted.value.length);

const top2Pct = computed(() => {
  const total = totalMinutes.value;
  if (total === 0 || projectBreakdown.value.length < 2) return 0;
  const top2Minutes = projectBreakdown.value[0].minutes + projectBreakdown.value[1].minutes;
  return Math.round((top2Minutes / total) * 100);
});

const extraProjectCount = computed(() => Math.max(0, uniqueProjectCount.value - 6));

// ── Filtered stats (last section — reflects LogList's current filter) ───────────

const filteredMinutes = computed(() => sumBy(props.filteredTimeLogs, (l) => l.duration ?? 0));
const filteredEntryCount = computed(() => props.filteredTimeLogs.length);
const filteredDaysLogged = computed(() => uniqBy(props.filteredTimeLogs, 'date').length);

const filteredAvgPerDay = computed(() =>
  filteredDaysLogged.value > 0 ? Math.round(filteredMinutes.value / filteredDaysLogged.value) : 0,
);

const filteredPctOfMonth = computed(() =>
  totalMinutes.value > 0 ? Math.round((filteredMinutes.value / totalMinutes.value) * 100) : 0,
);

const filteredDateRangeLabel = computed(() => {
  if (props.filteredTimeLogs.length === 0) return null;
  const dates = props.filteredTimeLogs.map((l) => l.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) return dayjs(first, isoDateFormat).format('MMM D');
  return `${dayjs(first, isoDateFormat).format('MMM D')} – ${dayjs(last, isoDateFormat).format('MMM D')}`;
});

// ── Month label ───────────────────────────────────────────────────────────────

const monthLabel = computed(() => dayjs(currentMonthKey.value, yearAndMonthFormat).format('MMM YYYY'));

// Truncate project names at 16 chars
const truncate = (str: string, len = 16) => (str.length > len ? str.slice(0, len) + '…' : str);
</script>

<template>
  <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
    <!-- Header -->
    <VCardTitle>
      <VToolbar>
        <VToolbarTitle class="ms-0">
          <div>Insights</div>
          <div class="text-caption text-medium-emphasis font-weight-regular">{{ monthLabel }}</div>
        </VToolbarTitle>
      </VToolbar>
    </VCardTitle>

    <!-- Scrollable body -->
    <div class="overflow-y-auto flex-grow-1 px-2 pb-2 d-flex flex-column ga-3">
      <!-- Overview: month total, then how complete the month's logging is -->
      <div>
        <div class="text-overline text-medium-emphasis ms-2">Overview</div>
        <VCard>
          <div class="pa-4">
            <div class="text-h5 font-weight-bold">{{ minutesToHourWithMinutes(totalMinutes) }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Total logged</div>
            <VDivider class="my-3" />

            <!-- Days logged + progress against the month's workdays -->
            <div class="d-flex justify-space-between text-caption">
              <span class="text-medium-emphasis">Days logged</span>
              <span>{{ daysLogged }} / {{ workdays.length }} workdays</span>
            </div>
            <VProgressLinear
              :model-value="daysProgress"
              bg-color="rgba(var(--v-theme-on-surface), 0.08)"
              class="mt-1 mb-2"
              rounded
            />

            <!-- Past workdays with nothing logged (hidden for a month that hasn't started) -->
            <div v-if="pastWorkdays.length" class="d-flex justify-space-between ga-4 text-caption mt-1">
              <span class="text-medium-emphasis text-no-wrap">Not logged</span>
              <span class="text-end" :class="missingDays.length ? 'text-warning' : 'text-success'">
                {{ missingLabel }}
              </span>
            </div>
            <div class="d-flex justify-space-between text-caption mt-1">
              <span class="text-medium-emphasis">Avg per day</span>
              <span>{{ minutesToHourWithMinutes(avgPerDay) }}</span>
            </div>
          </div>
        </VCard>
      </div>

      <!-- Time by project -->
      <div v-if="projectBreakdown.length > 0">
        <div class="text-overline text-medium-emphasis ms-2">Time by project</div>
        <VCard>
          <div class="pa-2">
            <!-- Accordion: each project expands to its task breakdown (simple projects have no chevron/detail) -->
            <VExpansionPanels
              variant="accordion"
              flat
              :model-value="selectedProject ?? undefined"
              @update:model-value="onPanelChange"
            >
              <VExpansionPanel
                v-for="item in projectBreakdown"
                :key="item.project"
                :value="item.project"
                :hide-actions="!breakdownByProject[item.project]"
              >
                <!-- Project row (selected → project-colored tint) -->
                <VExpansionPanelTitle
                  :style="
                    selectedProject === item.project
                      ? { backgroundColor: `${getProjectColor(item.project)}${SELECTED_TINT}` }
                      : undefined
                  "
                >
                  <div class="flex-grow-1 me-3">
                    <!-- Row 1: dot + name + hours (pct) -->
                    <div class="d-flex align-center ga-2 mb-1">
                      <span
                        class="flex-shrink-0"
                        :style="{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getProjectColor(item.project),
                        }"
                      />
                      <span class="text-body-2 text-truncate flex-grow-1">{{ truncate(item.project) }}</span>
                      <span class="text-caption text-medium-emphasis flex-shrink-0">
                        {{ minutesToHourWithMinutes(item.minutes) }} ({{ item.pct }}%)
                      </span>
                    </div>
                    <!-- Row 2: progress bar -->
                    <VProgressLinear
                      :model-value="item.pct"
                      :color="getProjectColor(item.project)"
                      bg-color="rgba(var(--v-theme-on-surface), 0.08)"
                      rounded
                      height="5"
                    />
                  </div>
                </VExpansionPanelTitle>

                <!-- Task breakdown list (only for projects with >=2 tasks) —
                     shares the project tint with the title; a top divider separates the two -->
                <VExpansionPanelText
                  v-if="breakdownByProject[item.project]"
                  :style="{
                    backgroundColor: `${getProjectColor(item.project)}${DETAIL_TINT}`,
                    borderTop: '1px solid rgba(var(--v-theme-on-surface), 0.12)',
                  }"
                >
                  <VList class="bg-transparent px-1 py-1" density="compact">
                    <VListItem v-for="t in breakdownByProject[item.project]" :key="t.task" class="px-1">
                      <!-- Task row: shade dot + name + hours (pct) -->
                      <div class="d-flex align-center ga-2 mb-1">
                        <span
                          class="flex-shrink-0"
                          :style="{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: taskColorsByProject[item.project]?.[t.task],
                          }"
                        />
                        <span class="text-caption text-truncate flex-grow-1">{{ truncate(t.task) }}</span>
                        <span class="text-caption text-medium-emphasis flex-shrink-0">
                          {{ minutesToHourWithMinutes(t.minutes) }} ({{ t.pct }}%)
                        </span>
                      </div>
                      <!-- Task progress bar -->
                      <VProgressLinear
                        :model-value="t.pct"
                        :color="taskColorsByProject[item.project]?.[t.task]"
                        bg-color="rgba(var(--v-theme-on-surface), 0.08)"
                        rounded
                        height="4"
                      />
                    </VListItem>
                  </VList>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>

            <!-- +N more -->
            <div v-if="extraProjectCount > 0" class="text-caption text-medium-emphasis mt-2 ms-3">
              +{{ extraProjectCount }} more
            </div>

            <!-- Focus line -->
            <template v-if="uniqueProjectCount >= 2">
              <VDivider class="mt-4 mb-3" />
              <div class="text-caption text-medium-emphasis ms-3">
                {{ uniqueProjectCount }} tickets · top 2 took {{ top2Pct }}% of your time
              </div>
            </template>
          </div>
        </VCard>
      </div>

      <!-- Filtered stats — reflects LogList's current project/task/date/search filter -->
      <div v-if="hasActiveFilter">
        <div class="text-overline text-medium-emphasis ms-2">Filtered</div>
        <VCard>
          <div class="pa-4">
            <div class="text-h5 font-weight-bold">{{ minutesToHourWithMinutes(filteredMinutes) }}</div>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ filteredEntryCount }} {{ filteredEntryCount === 1 ? 'entry' : 'entries' }} · {{ filteredPctOfMonth }}%
              of month
            </div>
            <VDivider class="my-3" />
            <div class="d-flex justify-space-between text-caption">
              <span class="text-medium-emphasis">Avg per day</span>
              <span>{{ minutesToHourWithMinutes(filteredAvgPerDay) }}</span>
            </div>
            <div v-if="filteredDateRangeLabel" class="d-flex justify-space-between text-caption mt-1">
              <span class="text-medium-emphasis">Date range</span>
              <span>{{ filteredDateRangeLabel }}</span>
            </div>
          </div>
        </VCard>
      </div>
    </div>
  </VCard>
</template>
