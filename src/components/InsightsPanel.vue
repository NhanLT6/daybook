<script setup lang="ts">
import { computed } from 'vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';
import { sumBy, uniqBy } from 'lodash';

import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { yearAndMonthFormat } from '@/common/DateFormat';
import { useProjectColors } from '@/composables/useProjectColors';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps<{
  timeLogs: TimeLog[];
  currentMonth: number;
}>();

const settingsStore = useSettingsStore();
const { getProjectColor } = useProjectColors();

// ── Totals ────────────────────────────────────────────────────────────────────

const totalMinutes = computed(() => sumBy(props.timeLogs, 'duration'));

const currentMonthKey = computed(() => {
  // currentMonth is 1-based; convert to 0-based for dayjs
  return dayjs().month(props.currentMonth - 1).format(yearAndMonthFormat);
});

const lastMonthKey = computed(() => {
  return dayjs(currentMonthKey.value, yearAndMonthFormat).subtract(1, 'month').format(yearAndMonthFormat);
});

const lastMonthTotal = computed(() => {
  // Read prior-month logs directly from localStorage (read-only, no need to reactify)
  const raw = localStorage.getItem(`timeLogs-${lastMonthKey.value}`);
  if (!raw) return 0;
  try {
    const logs: TimeLog[] = JSON.parse(raw);
    return sumBy(logs, 'duration');
  } catch {
    return 0;
  }
});

const delta = computed(() => totalMinutes.value - lastMonthTotal.value);

const deltaLabel = computed(() => {
  if (lastMonthTotal.value === 0) return null;
  const sign = delta.value >= 0 ? '+' : '-';
  return `${sign}${minutesToHourWithMinutes(Math.abs(delta.value))} vs last month`;
});

const deltaColor = computed(() => {
  if (delta.value > 0) return 'success';
  if (delta.value < 0) return 'error';
  return 'medium-emphasis';
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

const daysProgress = computed(() =>
  workdaysInMonth.value > 0 ? (daysLogged.value / workdaysInMonth.value) * 100 : 0,
);



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
    grouped[log.project] = (grouped[log.project] ?? 0) + log.duration;
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

const monthLabel = computed(() =>
  dayjs(currentMonthKey.value, yearAndMonthFormat).format('MMM YYYY'),
);

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
    <div class="overflow-y-auto flex-grow-1 px-4 pb-4 d-flex flex-column ga-3">
      <!-- Total hours -->
      <VCard>
        <div class="pa-4">
          <div class="text-h5 font-weight-bold">{{ minutesToHourWithMinutes(totalMinutes) }}</div>
          <div v-if="deltaLabel" class="text-caption" :class="`text-${deltaColor}`">
            {{ deltaLabel }}
          </div>
        </div>
      </VCard>

      <!-- Days logged -->
      <VCard>
        <div class="pa-4">
          <div class="text-overline text-medium-emphasis mb-1">Days logged</div>
          <div class="text-body-2 mb-2">{{ daysLogged }} / {{ workdaysInMonth }} workdays</div>
          <VProgressLinear
            :model-value="daysProgress"
            color="primary"
            bg-color="rgba(var(--v-theme-on-surface), 0.08)"
            rounded
            height="6"
          />
        </div>
      </VCard>

      <!-- Time by project -->
      <VCard v-if="projectBreakdown.length > 0">
        <div class="pa-4">
          <div class="text-overline text-medium-emphasis mb-2">Time by project</div>

          <div class="d-flex flex-column ga-3">
            <div v-for="item in projectBreakdown" :key="item.project">
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
          </div>

          <!-- +N more -->
          <div v-if="extraProjectCount > 0" class="text-caption text-medium-emphasis mt-2">
            +{{ extraProjectCount }} more
          </div>

          <!-- Focus line -->
          <template v-if="uniqueProjectCount >= 2">
            <VDivider class="mt-4 mb-3" />
            <div class="text-caption text-medium-emphasis">
              {{ uniqueProjectCount }} tickets · top 2 took {{ top2Pct }}% of your time
            </div>
          </template>
        </div>
      </VCard>
    </div>
  </VCard>
</template>

