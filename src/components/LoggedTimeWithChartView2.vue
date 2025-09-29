<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';
import type { ChartConfiguration, ChartData } from 'chart.js';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { useSettingsStore } from '@/stores/settings';
import { Chart } from 'chart.js/auto';
import { chain, round } from 'lodash';
import * as pattern from 'patternomaly';

// Component props
const { currentMonth } = defineProps<{
  currentMonth?: number; // Month not month index
}>();

// Reactive month selection and day calculation
const selectedMonth = computed(() => dayjs().month((currentMonth ?? dayjs().month() + 1) - 1)); // Convert from 1-based to 0-based

const daysInMonth = computed(() =>
  Array.from({ length: selectedMonth.value.daysInMonth() }, (_, i) =>
    selectedMonth.value.startOf('month').add(i, 'day'),
  ),
);

// Composables and stores
const projectColors = useProjectColors();
const settingsStore = useSettingsStore();

// Dynamic storage access based on selected month
const selectedMonthKey = computed(() => `timeLogs-${selectedMonth.value.format(yearAndMonthFormat)}`);
const timeLogs = useStorage<TimeLog[]>(selectedMonthKey.value, []);

// Chart dataset for logged work (excluding weekends)
const loggedDataSet = computed(() =>
  chain(timeLogs.value)
    .filter((log) => !settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day())) // Exclude weekend days
    .groupBy((l) => l.project)
    .map((logsByProject, projectName) => ({
      label: projectName,
      backgroundColor: projectColors.getProjectColor(projectName),
      data: daysInMonth.value.map((d) =>
        chain(logsByProject)
          .filter((item) => item.date === d.format(shortDateFormat))
          .map((item) => round(item.duration / 60, 1))
          .sum()
          .value(),
      ),
    }))
    .value(),
);

// Chart dataset for remaining hours (8-hour workday target)
const remainingDataSet = computed(() => ({
  label: 'Remaining',
  backgroundColor: projectColors.remainingDataColor,
  data: daysInMonth.value.map((d) => {
    const isWeekend = settingsStore.weekendDays.includes(d.day()); // Check if day is in configured weekend days
    if (isWeekend) return 0;

    const loggedHours = chain(timeLogs.value)
      .filter((item) => item.date === d.format(shortDateFormat))
      .map((item) => round(item.duration / 60, 1))
      .sum()
      .value();

    return Math.max(8 - loggedHours, 0);
  }),
}));

// Chart dataset for invalid weekend work (displayed with diagonal pattern)
const weekendDataSet = computed(() =>
  chain(timeLogs.value)
    .filter((log) => settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day())) // Include weekend days
    .groupBy((l) => l.project)
    .map((logsByProject) => ({
      label: 'Invalid Data',
      backgroundColor: pattern.draw('diagonal', projectColors.invalidDataColor),
      data: daysInMonth.value.map((d) =>
        chain(logsByProject)
          .filter((item) => item.date === d.format(shortDateFormat))
          .map((item) => round(item.duration / 60, 1))
          .sum()
          .value(),
      ),
    }))
    .value(),
);

const chartData: ChartData<'bar', number[], string> = {
  labels: daysInMonth.value.map((d) => d.format('DD')),
  datasets: [...loggedDataSet.value, ...weekendDataSet.value, remainingDataSet.value],
};

const truncateText = (text: string, maxLength = 20): string => {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

// Chart instance management
const chartCanvas = ref<HTMLCanvasElement>();
const chartInstance = ref<Chart>();

// Create non-reactive chart configuration to prevent circular references
const chartConfig = (): ChartConfiguration<'bar', number[], string> => ({
  type: 'bar',
  data: chartData,
  options: {
    scales: {
      x: { stacked: true },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 8,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    // animation: {
    //   duration: 750,
    //   easing: 'easeInOutQuart',
    // },
    plugins: {
      legend: {
        display: true,
        labels: {
          generateLabels: (chart) => {
            const datasets = chart.data.datasets || [];
            return datasets.map((dataset, index) => ({
              text: truncateText(dataset.label || ''),
              fillStyle: Array.isArray(dataset.backgroundColor)
                ? dataset.backgroundColor[0]
                : (dataset.backgroundColor as string),
              strokeStyle: Array.isArray(dataset.borderColor)
                ? dataset.borderColor[0]
                : (dataset.borderColor as string),
              lineWidth: typeof dataset.borderWidth === 'number' ? dataset.borderWidth : 0,
              hidden: !chart.isDatasetVisible(index),
              datasetIndex: index,
            }));
          },
        },
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (tooltipItems) => {
            const dataset = tooltipItems[0]?.dataset;
            return dataset?.label || '';
          },
        },
      },
    },
  },
});

// Initialize chart once when component mounts
const initializeChart = async () => {
  if (!chartCanvas.value) return;

  await nextTick();

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  chartInstance.value = new Chart(ctx, chartConfig());
};

// Update chart data using Chart.js update method
const updateChart = () => {
  if (!chartInstance.value) return;

  // Create completely new data structures without reactive references
  const rawTimeLogs = toRaw(timeLogs.value);
  const rawSelectedMonth = toRaw(selectedMonth.value);

  // Recalculate days for current month
  const monthDays = Array.from({ length: rawSelectedMonth.daysInMonth() }, (_, i) =>
    rawSelectedMonth.startOf('month').add(i, 'day'),
  );

  // Recalculate logged dataset without reactive computed properties
  const rawLoggedData = chain(rawTimeLogs)
    .filter((log) => !settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day()))
    .groupBy((l) => l.project)
    .map((logsByProject, projectName) => ({
      label: projectName,
      backgroundColor: projectColors.getProjectColor(projectName),
      data: monthDays.map((d) =>
        chain(logsByProject)
          .filter((item) => item.date === d.format(shortDateFormat))
          .map((item) => round(item.duration / 60, 1))
          .sum()
          .value(),
      ),
    }))
    .value();

  // Recalculate weekend dataset
  const rawWeekendData = chain(rawTimeLogs)
    .filter((log) => settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day()))
    .groupBy((l) => l.project)
    .map((logsByProject) => ({
      label: 'Invalid Data',
      backgroundColor: pattern.draw('diagonal', projectColors.invalidDataColor),
      data: monthDays.map((d) =>
        chain(logsByProject)
          .filter((item) => item.date === d.format(shortDateFormat))
          .map((item) => round(item.duration / 60, 1))
          .sum()
          .value(),
      ),
    }))
    .value();

  // Recalculate remaining dataset
  const rawRemainingData = {
    label: 'Remaining',
    backgroundColor: projectColors.remainingDataColor,
    data: monthDays.map((d) => {
      const isWeekend = settingsStore.weekendDays.includes(d.day());
      if (isWeekend) return 0;

      const loggedHours = chain(rawTimeLogs)
        .filter((item) => item.date === d.format(shortDateFormat))
        .map((item) => round(item.duration / 60, 1))
        .sum()
        .value();

      return Math.max(8 - loggedHours, 0);
    }),
  };

  // Update chart with completely new data structures
  chartInstance.value.data = {
    labels: monthDays.map((d) => d.format('DD')),
    datasets: [...rawLoggedData, ...rawWeekendData, rawRemainingData],
  };

  chartInstance.value.update();
};

// Initialize chart when component mounts
onMounted(async () => {
  await initializeChart();
});

watch(
  [/*selectedMonth,*/ timeLogs],
  () => {
    if (chartInstance.value) {
      updateChart();
    }
  },
  { deep: true },
);

// watch(
//   () => currentMonth,
//   () => {
//     updateChart();
//   },
// );

// Cleanup on component unmount
onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
    chartInstance.value = undefined;
  }
});
</script>

<template>
  <!-- Chart container - Only visible on medium+ screens -->
  <div class="d-none d-md-flex chart-container">
    <VBtn @click="() => updateChart()">Update chart</VBtn>
    <!-- Chart.js canvas element -->
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  height: 140%;
  width: 100%;
}
</style>
