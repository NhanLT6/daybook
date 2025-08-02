<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { XeroLog } from '@/interfaces/XeroLog';
import type { ChartConfiguration, ChartData } from 'chart.js';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { Chart } from 'chart.js/auto';
import { chain, round } from 'lodash';
import * as pattern from 'patternomaly';

const daysInMonth = Array.from({ length: dayjs().daysInMonth() }, (_, i) => dayjs().startOf('month').add(i, 'day'));

const projectColors = useProjectColors();

const xeroLogs = useStorage<XeroLog[]>(storageKeys.xeroLogsOfCurrentMonth, []);

const loggedDataSet = computed(() =>
  chain(xeroLogs.value)
    .filter((log) => ![5, 6, 0].includes(dayjs(log.date, shortDateFormat).day())) // NOT in Friday (5), Saturday (6), Sunday (0)
    .groupBy((l) => l.project)
    .map((logsByProject, projectName) => ({
      label: projectName,
      backgroundColor: projectColors.getProjectColor(projectName),
      data: daysInMonth.map((d) =>
        chain(logsByProject)
          .filter((item) => item.date === d.format(shortDateFormat))
          .map((item) => round(item.duration / 60, 1))
          .sum()
          .value(),
      ),
    }))
    .value(),
);

const remainingDataSet = computed(() => ({
  label: 'Remaining',
  backgroundColor: projectColors.remainingDataColor,
  data: daysInMonth.map((d) => {
    const isWeekend = [5, 6, 0].includes(d.day()); // Friday (5), Saturday (6), Sunday (0)
    if (isWeekend) return 0;

    const loggedHours = chain(xeroLogs.value)
      .filter((item) => item.date === d.format(shortDateFormat))
      .map((item) => round(item.duration / 60, 1))
      .sum()
      .value();

    return Math.max(8 - loggedHours, 0);
  }),
}));

const weekendDataSet = computed(() =>
  chain(xeroLogs.value)
    .filter((log) => [5, 6, 0].includes(dayjs(log.date, shortDateFormat).day())) // NOT in Friday (5), Saturday (6), Sunday (0)
    .groupBy((l) => l.project)
    .map((logsByProject) => ({
      label: 'Invalid Data',
      backgroundColor: pattern.draw('diagonal', projectColors.invalidDataColor),
      data: daysInMonth.map((d) =>
        chain(logsByProject)
          .filter((item) => item.date === d.format(shortDateFormat))
          .map((item) => round(item.duration / 60, 1))
          .sum()
          .value(),
      ),
    }))
    .value(),
);

const data = computed<ChartData<'bar', number[], string>>(() => ({
  labels: daysInMonth.map((d) => d.format('DD')),
  datasets: [...loggedDataSet.value, ...weekendDataSet.value, remainingDataSet.value],
}));

const config = computed<ChartConfiguration<'bar', number[], string>>(() => ({
  type: 'bar',
  data: data.value,
  options: {
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true },
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
  },
}));

const chartCanvas = ref();
const chartInstance = ref();

onMounted(() => {
  chartInstance.value = new Chart(chartCanvas.value, config.value);
});

watch(
  xeroLogs,
  () => {
    chartInstance.value?.destroy();
    chartInstance.value = new Chart(chartCanvas.value, config.value);
  },
  { deep: true },
);
</script>

<template>
  <div class="d-none d-md-flex chart-container">
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
