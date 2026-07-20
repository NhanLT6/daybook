<script setup lang="ts">
import { computed } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { shortDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { computeTaskBreakdown, type TaskBreakdownItem } from '@/composables/useTaskBreakdown';
import { useSettingsStore } from '@/stores/settings';
import { sumBy, uniqBy } from 'lodash';

const props = defineProps<{
  timeLogs: TimeLog[];
  currentMonth: number;
}>();

const selectedProject = defineModel<string | null>('selectedProject', { default: null });

const settingsStore = useSettingsStore();
const { getProjectColor, getTaskColors } = useProjectColors();

// Per-project task breakdown for every project with >=2 distinct tasks.
// Keyed by project name; absent = "simple" project (no expandable detail).
const breakdownByProject = computed(() => {
  const map: Record<string, TaskBreakdownItem[]> = {};
  for (const project of new Set(props.timeLogs.map((l) => l.project))) {
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

const totalMinutes = computed(() => sumBy(props.timeLogs, 'duration'));

const currentMonthKey = computed(() => {
  // currentMonth is 1-based; convert to 0-based for dayjs
  return dayjs()
    .month(props.currentMonth - 1)
    .format(yearAndMonthFormat);
});

const lastMonthKey = computed(() => {
  return dayjs(currentMonthKey.value, yearAndMonthFormat).subtract(1, 'month').format(yearAndMonthFormat);
});

// Week-over-week delta
const weekStartDate = computed(() => {
  const today = dayjs();
  const diff = (today.day() - settingsStore.firstDayOfWeek + 7) % 7;
  return today.subtract(diff, 'day').startOf('day');
});

const thisWeekMinutes = computed(() => {
  const weekStart = weekStartDate.value;
  const today = dayjs().endOf('day');
  return sumBy(
    props.timeLogs.filter((log) => {
      const d = dayjs(log.date, shortDateFormat);
      return d.isValid() && !d.isBefore(weekStart) && !d.isAfter(today);
    }),
    'duration',
  );
});

const lastWeekMinutes = computed(() => {
  const lastWeekStart = weekStartDate.value.subtract(7, 'day');
  const lastWeekEnd = weekStartDate.value.subtract(1, 'day').endOf('day');
  // Read from both current and previous month in case the week spans a month boundary
  let total = 0;
  for (const key of [currentMonthKey.value, lastMonthKey.value]) {
    const raw = localStorage.getItem(`timeLogs-${key}`);
    if (!raw) continue;
    try {
      const logs: TimeLog[] = JSON.parse(raw);
      total += sumBy(
        logs.filter((log) => {
          const d = dayjs(log.date, shortDateFormat);
          return d.isValid() && !d.isBefore(lastWeekStart) && !d.isAfter(lastWeekEnd);
        }),
        'duration',
      );
    } catch {
      // ignore malformed storage
    }
  }
  return total;
});

const delta = computed(() => thisWeekMinutes.value - lastWeekMinutes.value);

const deltaLabel = computed(() => {
  if (lastWeekMinutes.value === 0) return null;
  return `${minutesToHourWithMinutes(Math.abs(delta.value))} vs last week`;
});

const deltaIcon = computed(() => {
  if (delta.value > 0) return 'mdi-chevron-up';
  if (delta.value < 0) return 'mdi-chevron-down';
  return null;
});

const deltaIconColor = computed(() => {
  if (delta.value > 0) return 'success';
  if (delta.value < 0) return 'error';
  return '';
});

// ── Days logged ───────────────────────────────────────────────────────────────

const daysLogged = computed(() => uniqBy(props.timeLogs, 'date').length);

const workdaysInMonth = computed(() => {
  const monthDate = dayjs(currentMonthKey.value, yearAndMonthFormat);
  const daysInMonth = monthDate.daysInMonth();
  const weekendDays = settingsStore.weekendDays;
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = monthDate.date(d).day(); // 0=Sunday, 6=Saturday
    if (!weekendDays.includes(dow)) count++;
  }
  return count;
});

const daysProgress = computed(() => (workdaysInMonth.value > 0 ? (daysLogged.value / workdaysInMonth.value) * 100 : 0));

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
      <!-- Total hours -->
      <VCard>
        <div class="pa-4">
          <div class="text-h5 font-weight-bold">{{ minutesToHourWithMinutes(totalMinutes) }}</div>
          <div v-if="deltaLabel" class="d-flex align-center ga-1 text-caption text-medium-emphasis mt-1">
            <VIcon v-if="deltaIcon" :color="deltaIconColor" :icon="deltaIcon" size="14" />
            {{ deltaLabel }}
          </div>
        </div>
      </VCard>

      <!-- Days logged -->
      <div>
        <div class="text-overline text-medium-emphasis ms-2">Days logged</div>
        <VCard>
          <div class="pa-4">
            <div class="text-body-2 mb-2">{{ daysLogged }} / {{ workdaysInMonth }} workdays</div>
            <VProgressLinear :model-value="daysProgress" bg-color="rgba(var(--v-theme-on-surface), 0.08)" rounded />
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
                      ? { backgroundColor: `${getProjectColor(item.project)}40` }
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
                     wrapped in a rounded tinted card so it reads as distinct from its parent row -->
                <VExpansionPanelText v-if="breakdownByProject[item.project]">
                  <VCard class="elevation-0 rounded-lg">
                    <VList class="bg-container px-2 py-1" density="compact">
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
                  </VCard>
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
    </div>
  </VCard>
</template>
