<script setup lang="ts">
import { computed } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { useSettingsStore } from '@/stores/settings';
import { chain, sumBy } from 'lodash';

const props = defineProps<{
  timeLogs: TimeLog[];
  selectedDates: Date[];
  currentMonth: number; // 1-based
}>();

const settingsStore = useSettingsStore();
const { getProjectColor } = useProjectColors();

// Determine the reference date for centering the displayed week.
// Priority: selectedDates[0] if it's within currentMonth, else today if
// today is in currentMonth, else first day of currentMonth.
const referenceDate = computed(() => {
  const first = props.selectedDates[0];
  if (first && dayjs(first).month() + 1 === props.currentMonth) {
    return dayjs(first);
  }
  const today = dayjs();
  if (today.month() + 1 === props.currentMonth) {
    return today;
  }
  return dayjs()
    .month(props.currentMonth - 1)
    .date(1);
});

// Build the 7-day window starting from the user-configured first day of week.
// settingsStore.firstDayOfWeek: 0 = Sunday, 1 = Monday (default), etc.
const weekDays = computed(() => {
  const ref = referenceDate.value;
  const startDay = settingsStore.firstDayOfWeek;
  const dayOffset = (ref.day() - startDay + 7) % 7;
  const weekStart = ref.subtract(dayOffset, 'day');
  return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
});

// Single-letter day labels in the same week order as weekDays.
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index = dayjs .day()
const dayLabels = computed(() => weekDays.value.map((d) => DAY_LETTERS[d.day()]));

// Per-day stacked segment data.
const todayStr = dayjs().format(shortDateFormat);

const dayData = computed(() =>
  weekDays.value.map((day) => {
    const dateStr = day.format(shortDateFormat);
    const logsForDay = props.timeLogs.filter((l) => l.date === dateStr);

    const segments = chain(logsForDay)
      .groupBy('project')
      .map((logs, project) => ({
        project,
        duration: sumBy(logs, 'duration'),
        color: getProjectColor(project),
      }))
      .value();

    return {
      dateStr,
      isToday: dateStr === todayStr,
      totalDuration: sumBy(segments, 'duration'),
      segments,
    };
  }),
);

// Scale: max minutes across the week, with a floor of 480 (8h) so an
// all-light week doesn't render at 100% height and look misleading.
const maxDuration = computed(() => {
  const max = Math.max(...dayData.value.map((d) => d.totalDuration));
  return Math.max(max, 480);
});
</script>

<template>
  <VCard class="glass-mica pa-2">
    <div class="week-chart">
      <div v-for="(day, i) in dayData" :key="day.dateStr" class="day-col" :class="{ 'day-today': day.isToday }">
        <!-- Bar area: segments stack from bottom via column-reverse -->
        <div class="bar-wrap">
          <div
            v-for="seg in day.segments"
            :key="seg.project"
            class="bar-seg"
            :style="{
              height: (seg.duration / maxDuration) * 100 + '%',
              background: seg.color,
            }"
          />
        </div>

        <!-- Day letter label -->
        <div class="day-label">{{ dayLabels[i] }}</div>
      </div>
    </div>
  </VCard>
</template>

<style scoped>
.week-chart {
  display: flex;
  gap: 4px;
  height: 56px;
  padding: 0 12px;
}

.day-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-radius: 4px;
  padding: 2px;
}

.day-today {
  background: rgba(var(--v-theme-primary), 0.08);
}

/* Segments stack from the bottom: column-reverse puts first child at bottom */
.bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column-reverse;
  overflow: hidden;
  border-radius: 3px;
  /* Subtle background visible when no logs */
  background: rgba(128, 128, 128, 0.07);
}

.bar-seg {
  width: 100%;
  flex-shrink: 0;
}

.day-label {
  font-size: 0.6rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-weight: 500;
  flex-shrink: 0;
  line-height: 1;
}

.day-today .day-label {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
</style>
