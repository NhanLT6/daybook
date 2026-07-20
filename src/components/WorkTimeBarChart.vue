<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes, sumMinutesToHours } from '@/common/DateHelpers';
import { useTaskBreakdown } from '@/composables/useTaskBreakdown';
import { useSettingsStore } from '@/stores/settings';
import { Chart } from 'chart.js/auto';
import { chain } from 'lodash';
import * as pattern from 'patternomaly';

// Theme integration
const theme = useTheme();
const isDark = computed(() => theme.global.name.value === 'dark');

// Theme-aware colors for chart
const chartColors = computed(() => ({
  gridColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  tickColor: isDark.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
  legendColor: isDark.value ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
  // Border between stacked segments — matches the card surface so it reads as a thin gap,
  // separating similar pastel fills without changing the palette
  segmentBorder: theme.global.current.value.colors.surface,
}));

// Shared per-dataset border config: a hairline gap between stacked segments
const segmentBorder = computed(() => ({
  borderColor: chartColors.value.segmentBorder,
  borderWidth: 1,
  borderSkipped: false as const,
}));

// Red diagonal-hatch flag colour (theme danger) drawn over weekend cells
const weekendHatchColor = computed(() => theme.global.current.value.colors.error);

// Component props
const props = defineProps<{
  currentMonth?: number; // 1-based month, default to current month
  timeLogs?: TimeLog[]; // External time logs for reactivity
  selectedProject?: string | null;
}>();

const { currentMonth } = toRefs(props);

const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: Chart | null = null;

// Composables
const projectColors = useProjectColors();
const settingsStore = useSettingsStore();

// Reactive computed properties for chart data
const selectedMonth = computed(() => dayjs().month((currentMonth?.value ?? dayjs().month() + 1) - 1));

const daysInMonth = computed(() =>
  Array.from({ length: selectedMonth.value.daysInMonth() }, (_, i) =>
    selectedMonth.value.startOf('month').add(i, 'day'),
  ),
);

// Get time logs from storage (reactive to month changes)
const timeLogsStorage = computed(() => {
  const storageKey = `timeLogs-${selectedMonth.value.format(yearAndMonthFormat)}`;
  return useStorage<TimeLog[]>(storageKey, []);
});

// Use external timeLogs prop if provided, otherwise use storage
const timeLogs = computed(() => props.timeLogs ?? timeLogsStorage.value.value);

// Task-level breakdown of the selected project (drives task stacking below)
const taskBreakdown = useTaskBreakdown(timeLogs, () => props.selectedProject ?? null);

// Header stats — only shown when viewing the current month
const isCurrentMonth = computed(() => (currentMonth?.value ?? dayjs().month() + 1) === dayjs().month() + 1);

const todayStr = computed(() => dayjs().format(shortDateFormat));

const weekStartDate = computed(() => {
  const today = dayjs();
  const diff = (today.day() - settingsStore.firstDayOfWeek + 7) % 7;
  return today.subtract(diff, 'day').startOf('day');
});

const todayMinutes = computed(() =>
  timeLogs.value.filter((log) => log.date === todayStr.value).reduce((sum, log) => sum + (log.duration ?? 0), 0),
);

const thisWeekMinutes = computed(() => {
  const weekStart = weekStartDate.value;
  return timeLogs.value
    .filter((log) => {
      const d = dayjs(log.date, shortDateFormat);
      return d.isValid() && !d.isBefore(weekStart) && !d.isAfter(dayjs().endOf('day'));
    })
    .reduce((sum, log) => sum + (log.duration ?? 0), 0);
});

// Chart data computed property (automatically reactive to props and storage changes)
const chartData = computed(() => {
  try {
    // Precompute once per recompute (avoids dayjs.format in inner loops)
    const dayKeys = daysInMonth.value.map((d) => d.format(shortDateFormat));
    const weekendDay = daysInMonth.value.map((d) => settingsStore.weekendDays.includes(d.day()));
    const isWeekendLog = (log: TimeLog) => settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day());

    // Per-day logged hours (summed then rounded once) for a set of logs, indexed by day-of-month
    const dailyHours = (logs: TimeLog[]) =>
      dayKeys.map((key) => sumMinutesToHours(logs.filter((l) => l.date === key).map((l) => l.duration ?? 0)));

    const labels = daysInMonth.value.map((d) => d.format('DD'));

    // Selected project → stack by task (or a single series for simple projects).
    // Weekday cells use the solid shade; weekend cells get a red diagonal-hatch flag.
    if (props.selectedProject) {
      const projectLogs = timeLogs.value.filter((log) => log.project === props.selectedProject);

      const series = taskBreakdown.value.hasBreakdown
        ? (() => {
            const colors = projectColors.getTaskColors(
              props.selectedProject,
              taskBreakdown.value.tasks.map((t) => t.task),
            );
            return taskBreakdown.value.tasks.map((t) => ({
              label: t.task,
              color: colors[t.task],
              logs: projectLogs.filter((l) => l.task === t.task),
            }));
          })()
        : [
            {
              label: props.selectedProject,
              color: projectColors.getProjectColor(props.selectedProject),
              logs: projectLogs,
            },
          ];

      const datasets = series.map((s) => {
        const hatched = pattern.draw('diagonal', s.color, weekendHatchColor.value);
        return {
          label: s.label,
          backgroundColor: weekendDay.map((w) => (w ? hatched : s.color)),
          ...segmentBorder.value,
          data: dailyHours(s.logs),
        };
      });

      return { labels, datasets };
    }

    // All-projects view: per-project weekday bars + a lumped Weekend flag + Remaining
    const weekdayLogs = timeLogs.value.filter((log) => !isWeekendLog(log));
    const weekendLogs = timeLogs.value.filter(isWeekendLog);

    const loggedDataSet = chain(weekdayLogs)
      .groupBy((l) => l.project)
      .map((logsByProject, projectName) => ({
        label: projectName,
        backgroundColor: projectColors.getProjectColor(projectName),
        ...segmentBorder.value,
        data: dailyHours(logsByProject),
      }))
      .value();

    // Weekend work is flagged (not invalid) — one diagonal-hatch segment per day
    const weekendDataSet = weekendLogs.length
      ? [
          {
            label: 'Weekend',
            backgroundColor: pattern.draw('diagonal', projectColors.weekendDataColor()),
            ...segmentBorder.value,
            data: dailyHours(weekendLogs),
          },
        ]
      : [];

    const loggedPerDay = dailyHours(weekdayLogs);
    const remainingDataSet = {
      label: 'Remaining',
      backgroundColor: projectColors.remainingDataColor(),
      ...segmentBorder.value,
      data: loggedPerDay.map((h, i) => (weekendDay[i] ? 0 : Math.max(8 - h, 0))),
    };

    return { labels, datasets: [...loggedDataSet, ...weekendDataSet, remainingDataSet] };
  } catch (error) {
    console.error('Chart data generation error:', error);
    return {
      labels: ['Error'],
      datasets: [{ label: 'Error', backgroundColor: '#f44336', data: [0] }],
    };
  }
});

const chartOptions = computed(() => ({
  scales: {
    x: {
      stacked: true,
      grid: {
        display: false,
      },
      ticks: {
        color: chartColors.value.tickColor,
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      max: props.selectedProject ? undefined : 8,
      grid: {
        color: chartColors.value.gridColor,
      },
      ticks: {
        color: chartColors.value.tickColor,
      },
    },
  },
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 750,
    easing: 'easeInOutQuart' as const,
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      align: 'start' as const,
      labels: {
        color: chartColors.value.legendColor,
        usePointStyle: true,
        generateLabels: (chart: Chart) => {
          const datasets = chart.data.datasets || [];
          return datasets.map((dataset, index) => ({
            text:
              dataset.label && dataset.label.length > 20 ? `${dataset.label.substring(0, 20)}...` : dataset.label || '',
            fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[0] : dataset.backgroundColor,
            strokeStyle: Array.isArray(dataset.borderColor) ? dataset.borderColor[0] : dataset.borderColor,
            lineWidth: typeof dataset.borderWidth === 'number' ? dataset.borderWidth : 0,
            hidden: !chart.isDatasetVisible(index),
            datasetIndex: index,
            fontColor: chartColors.value.legendColor,
            pointStyle: 'rectRounded' as const,
          }));
        },
      },
    },
    tooltip: {
      enabled: true,
      callbacks: {
        title: (tooltipItems: any[]) => {
          const dataset = tooltipItems[0]?.dataset;
          return dataset?.label || '';
        },
        label: (tooltipItem: any) => `${tooltipItem.parsed.y}h`,
      },
    },
  },
}));

// Initialize chart
const initializeChart = () => {
  if (!chartCanvas.value) return;

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  try {
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: chartData.value,
      options: chartOptions.value,
    });
  } catch (error) {
    console.error('Chart initialization failed:', error);
  }
};

// Update chart — pass 'none' to skip animation (e.g. theme changes)
const updateChart = (mode?: 'none') => {
  if (!chartInstance) return;

  try {
    chartInstance.data = chartData.value;
    chartInstance.options = chartOptions.value;
    chartInstance.update(mode);
  } catch (error) {
    console.error('Chart update failed:', error);
  }
};

// Watch for data changes and update chart automatically (animated)
watch(
  () => chartData.value,
  () => {
    updateChart();
  },
  { deep: true },
);

// Watch for theme changes and update chart colors (no animation)
watch(isDark, () => {
  updateChart('none');
});

// Expose updateChart method for parent components
defineExpose({
  updateChart,
});

// Lifecycle hooks
onMounted(() => {
  initializeChart();
});

onUnmounted(() => {
  if (chartInstance) {
    try {
      chartInstance.destroy();
    } catch (error) {
      console.warn('Chart cleanup error:', error);
    }
    chartInstance = null;
  }
});
</script>

<template>
  <VCard class="glass-acrylic">
    <!-- Header -->
    <VCardTitle>
      <VToolbar>
        <VToolbarTitle class="ms-0">
          <div>{{ selectedMonth.format('MMMM YYYY') }}</div>
          <div class="text-caption text-medium-emphasis font-weight-regular">
            Hours logged per day · stacked by project
          </div>
        </VToolbarTitle>
        <!-- TODAY / THIS WEEK — right side of header, current month only -->
        <template v-if="isCurrentMonth">
          <VSpacer />
          <div class="d-flex ga-4 me-2">
            <div class="d-flex align-baseline ga-1">
              <span class="text-subtitle-1 font-weight-bold">{{ minutesToHourWithMinutes(todayMinutes) }}</span>
              <span class="text-caption text-medium-emphasis">TODAY</span>
            </div>
            <div class="d-flex align-baseline ga-1">
              <span class="text-subtitle-1 font-weight-bold">{{ minutesToHourWithMinutes(thisWeekMinutes) }}</span>
              <span class="text-caption text-medium-emphasis">THIS WEEK</span>
            </div>
          </div>
        </template>
      </VToolbar>
    </VCardTitle>

    <!-- Chart card -->
    <div class="px-2 pb-2">
      <VCard>
        <div class="pa-4">
          <!-- Chart -->
          <div class="chart-container">
            <canvas ref="chartCanvas"></canvas>
          </div>
        </div>
      </VCard>
    </div>
  </VCard>
</template>

<style scoped>
.chart-container {
  position: relative;
  height: 140px;
  width: 100%;
}
</style>
