<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue';

import { useDailyTarget } from '@/composables/useDailyTarget';
import { useProjectColors } from '@/composables/useProjectColors';
import { NO_TASK, useTaskBreakdown } from '@/composables/useTaskBreakdown';
import { useTimeLogs } from '@/composables/useTimeLogs';

import type { TimeLog } from '@/interfaces/TimeLog';
import type { Plugin, TooltipItem } from 'chart.js';

import { useTheme } from 'vuetify';

import dayjs from 'dayjs';

import { isoDateFormat, yearAndMonthFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes, sumMinutesToHours } from '@/common/DateHelpers';
import { useSettingsStore } from '@/stores/settings';
import { Chart } from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { chain } from 'lodash';

Chart.register(annotationPlugin);

const REMAINING = 'Remaining';

// Theme integration
const theme = useTheme();
const isDark = computed(() => theme.global.name.value === 'dark');

// '#FB8C00' → '251, 140, 0' for rgba()
const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

// Theme-aware colors for chart
const chartColors = computed(() => ({
  gridColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  tickColor: isDark.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
  legendColor: isDark.value ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
  // Target line is informative only, so it sits just above the grid lines in strength
  targetLineColor: isDark.value ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
  // Theme warning at reduced alpha: a gentle flag, not an alarm
  offDayOutline: `rgba(${hexToRgb(theme.global.current.value.colors.warning)}, ${isDark.value ? 0.5 : 0.45})`,
}));

// Shared per-dataset border config: segments touch, no hairline between them (Nhan: the white edge read as noise)
const segmentBorder = computed(() => ({
  borderColor: 'transparent',
  borderWidth: 0,
  borderSkipped: false as const,
}));

// Component props
const props = defineProps<{
  currentMonth?: number; // 1-based month, default to current month
  timeLogs?: TimeLog[]; // External time logs for reactivity
  selectedProject?: string | null;
  // Folds the chart away under the header (Home's Logs toolbar owns the toggle)
  collapsed?: boolean;
}>();

const { currentMonth } = toRefs(props);

const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: Chart | null = null;

// Composables
const projectColors = useProjectColors();
const settingsStore = useSettingsStore();
const { targetMinutes, isOffDay } = useDailyTarget();

// Reactive computed properties for chart data
const selectedMonth = computed(() => dayjs().month((currentMonth?.value ?? dayjs().month() + 1) - 1));

const daysInMonth = computed(() =>
  Array.from({ length: selectedMonth.value.daysInMonth() }, (_, i) =>
    selectedMonth.value.startOf('month').add(i, 'day'),
  ),
);

// Get time logs from the repo (reactive to month changes)
const { forMonth } = useTimeLogs();
const monthLogs = computed(() => forMonth(selectedMonth.value.format(yearAndMonthFormat)));

// Use external timeLogs prop if provided, otherwise use the repo's month logs
const timeLogs = computed(() => props.timeLogs ?? monthLogs.value);

// Task-level breakdown of the selected project (drives task stacking below)
const taskBreakdown = useTaskBreakdown(timeLogs, () => props.selectedProject ?? null);

// Header stats — only shown when viewing the current month
const isCurrentMonth = computed(() => (currentMonth?.value ?? dayjs().month() + 1) === dayjs().month() + 1);

const todayStr = computed(() => dayjs().format(isoDateFormat));

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
      const d = dayjs(log.date, isoDateFormat);
      return d.isValid() && !d.isBefore(weekStart) && !d.isAfter(dayjs().endOf('day'));
    })
    .reduce((sum, log) => sum + (log.duration ?? 0), 0);
});

// Tiny segments (a 15m standup next to a 7h task) would draw as a hairline nobody can hover, so each
// logged segment is drawn at least MIN_SEGMENT_SHARE of the month's tallest day. Only the drawing
// changes: `realMinutes` keeps the true time for the tooltip, and Remaining shrinks by the same amount so
// a full day still ends at the target.
const MIN_SEGMENT_SHARE = 0.08;

type HoursDataset = { label: string; data: number[]; realMinutes: number[] };

const withMinSegments = <D extends HoursDataset>(datasets: D[]): D[] => {
  const dayCount = datasets[0]?.data.length ?? 0;
  const dayTotals = Array.from({ length: dayCount }, (_, i) => datasets.reduce((sum, ds) => sum + ds.data[i], 0));
  const minHours = Math.max(...dayTotals, 0) * MIN_SEGMENT_SHARE;
  return datasets.map((ds) => ({
    ...ds,
    data: ds.data.map((h) => (h > 0 && h < minHours ? minHours : h)),
  }));
};

// Chart data computed property (automatically reactive to props and storage changes)
const chartData = computed(() => {
  try {
    // Precompute once per recompute (avoids dayjs.format in inner loops)
    const dayKeys = daysInMonth.value.map((d) => d.format(isoDateFormat));

    // Per-day logged hours (summed then rounded once) for a set of logs, indexed by day-of-month
    const dailyMinutes = (logs: TimeLog[]) =>
      dayKeys.map((key) => logs.filter((l) => l.date === key).reduce((sum, l) => sum + (l.duration ?? 0), 0));
    const dailyHours = (logs: TimeLog[]) =>
      dayKeys.map((key) => sumMinutesToHours(logs.filter((l) => l.date === key).map((l) => l.duration ?? 0)));

    const labels = daysInMonth.value.map((d) => d.format('DD'));

    // Selected project → stack by task (or a single series for simple projects)
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
              logs: projectLogs.filter((l) => (t.task === NO_TASK ? !l.task : l.task === t.task)),
            }));
          })()
        : [
            {
              label: props.selectedProject,
              color: projectColors.getProjectColor(props.selectedProject),
              logs: projectLogs,
            },
          ];

      const datasets = series.map((s) => ({
        label: s.label,
        backgroundColor: s.color,
        ...segmentBorder.value,
        data: dailyHours(s.logs),
        realMinutes: dailyMinutes(s.logs),
      }));

      return { labels, datasets: withMinSegments(datasets) };
    }

    // All-projects view: one series per project
    const loggedDataSet = withMinSegments(
      chain(timeLogs.value)
        .groupBy((l) => l.project)
        .map((logsByProject, projectName) => {
          const projectColor = projectColors.getProjectColor(projectName);
          return {
            label: projectName,
            backgroundColor: projectColor,
            ...segmentBorder.value,
            data: dailyHours(logsByProject),
            realMinutes: dailyMinutes(logsByProject),
          };
        })
        .value(),
    );

    // No daily target ("no limit") → nothing to fill up to
    if (targetMinutes.value === null) return { labels, datasets: loggedDataSet };

    // Remaining fills each workday up to the daily target; weekends and holidays get none (an outline flags logs there).
    // Drawn from the drawn (min-height) segments so the column still ends at the target; the tooltip shows the true gap.
    const targetHours = targetMinutes.value / 60;
    const remainingFrom = (perDay: number[]) =>
      perDay.map((h, i) => (isOffDay(dayKeys[i]) ? 0 : Math.max(targetHours - h, 0)));
    const drawnPerDay = dayKeys.map((_, i) => loggedDataSet.reduce((sum, ds) => sum + ds.data[i], 0));

    const remainingDataSet = {
      label: REMAINING,
      backgroundColor: projectColors.remainingDataColor(),
      ...segmentBorder.value,
      data: remainingFrom(drawnPerDay),
      realMinutes: remainingFrom(dailyMinutes(timeLogs.value).map((m) => m / 60)).map((h) => Math.round(h * 60)),
    };

    return { labels, datasets: [...loggedDataSet, remainingDataSet] };
  } catch (error) {
    console.error('Chart data generation error:', error);
    return {
      labels: ['Error'],
      datasets: [{ label: 'Error', backgroundColor: '#f44336', data: [0] }],
    };
  }
});

// Weekend / holiday columns (indexes into the month) — logging on them is flagged, not hidden
const offDayIndexes = computed(() =>
  daysInMonth.value.flatMap((d, i) => (isOffDay(d.format(isoDateFormat)) ? [i] : [])),
);

// Amber outline around a whole weekend/holiday column that has logged time: a soft "worked on a day off" flag
// in place of recolouring the bars, so side work (studying on a Saturday) keeps its project colours.
const offDayOutline: Plugin<'bar'> = {
  id: 'offDayOutline',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.strokeStyle = chartColors.value.offDayOutline;
    ctx.lineWidth = 1.5;
    for (const i of offDayIndexes.value) {
      const visible = chart.data.datasets
        .map((ds, d) => ({ ds, d }))
        .filter(({ ds, d }) => chart.isDatasetVisible(d) && Number(ds.data[i]) > 0);
      if (!visible.some(({ ds }) => ds.label !== REMAINING)) continue;

      // Final (post-animation) geometry of each stacked segment in the column
      const bars = visible.map(({ d }) =>
        chart.getDatasetMeta(d).data[i].getProps(['x', 'y', 'base', 'width'], true),
      ) as { x: number; y: number; base: number; width: number }[];
      const top = Math.min(...bars.map((b) => b.y));
      const bottom = Math.max(...bars.map((b) => b.base));
      const { x, width } = bars[0];
      ctx.beginPath();
      ctx.roundRect(x - width / 2 - 1, top - 1, width + 2, bottom - top + 2, 3);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// Dashed target line, only in the all-projects view and only once some day goes past the target: below it the
// Remaining bars already mark where a full day ends.
const targetLineHours = computed((): number | null => {
  if (props.selectedProject || targetMinutes.value === null) return null;
  const targetHours = targetMinutes.value / 60;
  const totals = chain(timeLogs.value)
    .groupBy((l) => l.date)
    .map((logs) => sumMinutesToHours(logs.map((l) => l.duration ?? 0)))
    .value();
  return totals.some((h) => h > targetHours) ? targetHours : null;
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
            fillStyle: dataset.backgroundColor as string,
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
    annotation: {
      annotations:
        targetLineHours.value === null
          ? {}
          : {
              target: {
                type: 'line' as const,
                yMin: targetLineHours.value,
                yMax: targetLineHours.value,
                borderColor: chartColors.value.targetLineColor,
                borderWidth: 1,
                borderDash: [6, 4],
                label: {
                  display: true,
                  content: minutesToHourWithMinutes(targetLineHours.value * 60),
                  position: 'start' as const,
                  color: chartColors.value.targetLineColor,
                  backgroundColor: 'transparent',
                  font: { size: 10 },
                  padding: 2,
                  yAdjust: -8,
                },
              },
            },
    },
    tooltip: {
      enabled: true,
      callbacks: {
        title: (tooltipItems: TooltipItem<'bar'>[]) => {
          const dataset = tooltipItems[0]?.dataset;
          return dataset?.label || '';
        },
        // True hours, not the drawn (possibly min-height) segment
        label: (tooltipItem: TooltipItem<'bar'>) => {
          const real = (tooltipItem.dataset as { realMinutes?: number[] }).realMinutes?.[tooltipItem.dataIndex];
          return real === undefined ? `${tooltipItem.parsed.y}h` : minutesToHourWithMinutes(real);
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
      plugins: [offDayOutline],
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
// Theme and off days are read at draw time (colours, outline plugin), not from chartData
watch([isDark, offDayIndexes], () => {
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
  <!-- Chart section of Home's shared chart + logs card: renders no card of its own -->
  <section class="month-chart">
    <!-- Header: month + subtitle on the left; today / this week stats and any parent actions on the right -->
    <div class="month-chart__head">
      <div class="month-chart__heading">
        <h2 class="month-chart__title">{{ selectedMonth.format('MMMM YYYY') }}</h2>
        <div class="text-caption text-medium-emphasis">Hours logged per day · stacked by project</div>
      </div>

      <VSpacer />

      <div class="d-flex align-center ga-4">
        <!-- TODAY / THIS WEEK — current month only -->
        <template v-if="isCurrentMonth">
          <div class="month-chart__stat">
            <b>{{ minutesToHourWithMinutes(todayMinutes) }}</b>
            <span>Today</span>
          </div>
          <div class="month-chart__stat">
            <b>{{ minutesToHourWithMinutes(thisWeekMinutes) }}</b>
            <span>This week</span>
          </div>
        </template>

        <slot name="actions" />
      </div>
    </div>

    <!-- The wrap animates its height; the canvas keeps a fixed height so Chart.js never redraws squashed bars.
         Chart + legend sit directly on the glass, like the log list below -->
    <div class="month-chart__wrap" :class="{ 'month-chart__wrap--collapsed': collapsed }" :aria-hidden="collapsed">
      <div class="month-chart__card">
        <div class="chart-container">
          <canvas ref="chartCanvas"></canvas>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.month-chart__head {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 14px var(--panel-pad, 16px) 8px;
}

.month-chart__heading {
  min-width: 0;
}

.month-chart__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.4;
}

/* "3h 30m TODAY": value first, small caps label after it on the same baseline */
.month-chart__stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.month-chart__stat b {
  font-size: 0.9375rem;
  font-weight: 500;
}

.month-chart__stat span {
  font-size: 0.6875rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Same curve as the Insights column: fast start, long soft settle, no overshoot */
.month-chart__wrap {
  height: 177px;
  overflow: hidden;
  padding: 0 var(--panel-pad, 16px);
  transition: height 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.month-chart__wrap--collapsed {
  height: 0;
}

.month-chart__card {
  padding: 8px 0 4px;
  background: transparent;
}

.chart-container {
  position: relative;
  height: 157px;
  width: 100%;
}
</style>
