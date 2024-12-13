<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import type { XeroLog } from '@/interfaces/XeroLog';
import type { ChartConfiguration, ChartData } from 'chart.js';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { chain, sumBy } from 'lodash';

const weekdaysInMonth = Array.from({ length: dayjs().daysInMonth() }, (_, i) => dayjs().startOf('month').add(i, 'day'));

const xeroLogs = useStorage<XeroLog[]>(storageKeys.xeroLogsOfCurrentMonth, []);

const loggedTimeByDates = computed(() =>
  chain(xeroLogs.value)
    .groupBy((item) => item.date)
    .map((items, date) => ({
      date,
      durationSum: (sumBy(items, 'duration') / 60).toFixed(1),
      tasks: items,
    }))
    .orderBy((item) => item.date)
    .value(),
);

const loggedDataSet = computed(() =>
  weekdaysInMonth.map((d) => {
    const isWeekend = [5, 6, 0].includes(d.day()); // Friday (5), Saturday (6), Sunday (0)
    if (isWeekend) return 0;

    const found = loggedTimeByDates.value.find((item) => item.date === d.format(shortDateFormat));

    return Number(found?.durationSum) || 0;
  }),
);

const remainingDataSet = computed(() =>
  weekdaysInMonth.map((d) => {
    const isWeekend = [5, 6, 0].includes(d.day()); // Friday (5), Saturday (6), Sunday (0)
    if (isWeekend) return 0;

    const found = loggedTimeByDates.value.find((item) => item.date === d.format(shortDateFormat));

    return 8 - Number(found?.durationSum || 0);
  }),
);

const invalidData = computed(() =>
  weekdaysInMonth.map((d) => {
    const isWeekend = [5, 6, 0].includes(d.day()); // Friday (5), Saturday (6), Sunday (0)
    if (isWeekend) {
      const found = loggedTimeByDates.value.find((item) => item.date === d.format(shortDateFormat));
      return Number(found?.durationSum) || 0;
    }

    return 0;
  }),
);

const data = computed<ChartData<'bar', number[], string>>(() => ({
  labels: weekdaysInMonth.map((d) => d.format('DD')),
  datasets: [
    {
      data: loggedDataSet.value,
      backgroundColor: '#A5D6A7',
    },
    {
      data: remainingDataSet.value,
      backgroundColor: '#E8F5E9',
      datalabels: { labels: { title: null } },
    },
    {
      data: invalidData.value,
      backgroundColor: '#FFCDD2',
      // datalabels: { labels: { title: null } },
    },
  ],
}));

const config = computed<ChartConfiguration<'bar', number[], string>>(() => ({
  type: 'bar',
  data: data.value,
  plugins: [ChartDataLabels],
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true },
      y: { stacked: true },
    },
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: function (context) {
          const dataValue = context.dataset.data[context.dataIndex];
          return typeof dataValue === 'number' && dataValue > 0;
        },
      },
      tooltip: {
        enabled: false,
      },
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
  <div class="d-none d-md-flex" style="position: relative; height: 100px; width: 100%">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<style scoped></style>
