<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';

import { useStorage } from '@vueuse/core';
import { useTheme } from 'vuetify';

import dayjs from 'dayjs';

import { shortDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { useSettingsStore } from '@/stores/settings';
import { Chart } from 'chart.js/auto';
import { chain, round } from 'lodash';
import * as pattern from 'patternomaly';

// Theme integration
const theme = useTheme();
const isDark = computed(() => theme.global.name.value === 'dark');

// Theme-aware colors for chart
const chartColors = computed(() => ({
  gridColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  tickColor: isDark.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
  legendColor: isDark.value ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
}));

// Component props
const props = defineProps<{
  currentMonth?: number; // 1-based month, default to current month
  timeLogs?: TimeLog[]; // External time logs for reactivity
}>();

const { currentMonth } = toRefs(props);

const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: Chart | null = null;

// Composables
const projectColors = useProjectColors();
const settingsStore = useSettingsStore();

// Reactive computed properties for chart data
const selectedMonth = computed(() =>
  dayjs().month((currentMonth?.value ?? dayjs().month() + 1) - 1)
);

const daysInMonth = computed(() =>
  Array.from({ length: selectedMonth.value.daysInMonth() }, (_, i) =>
    selectedMonth.value.startOf('month').add(i, 'day')
  )
);

// Get time logs from storage (reactive to month changes)
const timeLogsStorage = computed(() => {
  const storageKey = `timeLogs-${selectedMonth.value.format(yearAndMonthFormat)}`;
  return useStorage<TimeLog[]>(storageKey, []);
});

// Use external timeLogs prop if provided, otherwise use storage
const timeLogs = computed(() => props.timeLogs ?? timeLogsStorage.value.value);

// Chart data computed property (automatically reactive to props and storage changes)
const chartData = computed(() => {
  try {
    // Process logs by project
    const loggedDataSet = chain(timeLogs.value)
      .filter((log) => !settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day()))
      .groupBy((l) => l.project)
      .map((logsByProject, projectName) => ({
        label: projectName,
        backgroundColor: projectColors.getProjectColor(projectName),
        data: daysInMonth.value.map((d) =>
          chain(logsByProject)
            .filter((item) => item.date === d.format(shortDateFormat))
            .map((item) => round(item.duration / 60, 1))
            .sum()
            .value()
        ),
      }))
      .value();

    // Weekend/invalid data
    const invalidDataSet = chain(timeLogs.value)
      .filter((log) => settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day()))
      .groupBy(() => 'Invalid Data')
      .map((logsByProject) => ({
        label: 'Invalid Data',
        backgroundColor: pattern.draw('diagonal', projectColors.invalidDataColor()),
        data: daysInMonth.value.map((d) =>
          chain(logsByProject)
            .filter((item) => item.date === d.format(shortDateFormat))
            .map((item) => round(item.duration / 60, 1))
            .sum()
            .value()
        ),
      }))
      .value();

    // Remaining hours (8-hour target minus logged hours)
    const remainingData = daysInMonth.value.map((d) => {
      const isWeekend = settingsStore.weekendDays.includes(d.day());
      if (isWeekend) return 0;

      const totalLogged = chain(timeLogs.value)
        .filter((log) => log.date === d.format(shortDateFormat))
        .filter((log) => !settingsStore.weekendDays.includes(dayjs(log.date, shortDateFormat).day()))
        .map((log) => round(log.duration / 60, 1))
        .sum()
        .value();

      return Math.max(8 - totalLogged, 0);
    });

    const remainingDataSet = {
      label: 'Remaining',
      backgroundColor: projectColors.remainingDataColor(),
      data: remainingData,
    };

    return {
      labels: daysInMonth.value.map((d) => d.format('DD')),
      datasets: [...loggedDataSet, ...invalidDataSet, remainingDataSet],
    };
  } catch (error) {
    console.error('Chart data generation error:', error);
    return {
      labels: ['Error'],
      datasets: [{
        label: 'Error',
        backgroundColor: '#f44336',
        data: [0],
      }],
    };
  }
});

const chartOptions = computed(() => ({
  scales: {
    x: {
      stacked: true,
      grid: {
        color: chartColors.value.gridColor,
      },
      ticks: {
        color: chartColors.value.tickColor,
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      max: 8, // 8-hour workday target
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
      labels: {
        color: chartColors.value.legendColor,
        generateLabels: (chart: Chart) => {
          const datasets = chart.data.datasets || [];
          return datasets.map((dataset, index) => ({
            text: dataset.label && dataset.label.length > 20
              ? `${dataset.label.substring(0, 20)}...`
              : dataset.label || '',
            fillStyle: Array.isArray(dataset.backgroundColor)
              ? dataset.backgroundColor[0]
              : dataset.backgroundColor,
            strokeStyle: Array.isArray(dataset.borderColor)
              ? dataset.borderColor[0]
              : dataset.borderColor,
            lineWidth: typeof dataset.borderWidth === 'number' ? dataset.borderWidth : 0,
            hidden: !chart.isDatasetVisible(index),
            datasetIndex: index,
            fontColor: chartColors.value.legendColor,
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

// Update chart when data changes
const updateChart = () => {
  if (!chartInstance) return;

  try {
    chartInstance.data = chartData.value;
    chartInstance.options = chartOptions.value;
    chartInstance.update('none');
  } catch (error) {
    console.error('Chart update failed:', error);
  }
};

// Watch for data changes and update chart automatically
watch(
  () => chartData.value,
  () => {
    updateChart();
  },
  { deep: true }
);

// Watch for theme changes and update chart colors
watch(isDark, () => {
  updateChart();
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
  <!-- Chart container - Only visible on medium+ screens -->
  <div class="d-none d-md-flex chart-container">
    <!-- Chart.js canvas element -->
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  height: 140px;
  width: 100%;
}
</style>
