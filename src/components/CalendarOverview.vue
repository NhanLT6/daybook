<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useEvents } from '@/composables/useEvents';
import type { AppEvent } from '@/interfaces/Event';
import type { Page } from 'v-calendar/dist/types/src/utils/page.d.ts';

import { useTheme } from 'vuetify';

import { useNow, useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { atOccurrence, eventDays, getOccurrences } from '@/common/eventRecurrence';
import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';

// Theme integration
const theme = useTheme();
const isDark = computed(() => theme.global.name.value === 'dark');

type CalendarViewMode = 'weekly' | 'monthly';

const props = withDefaults(
  defineProps<{
    singleDateMode?: boolean;
    view?: CalendarViewMode;
  }>(),
  {
    singleDateMode: false,
    // Undefined means "use the remembered view", so it stays the default
    view: undefined,
  },
);

const emit = defineEmits<{
  monthChanged: [month: number];
  'update:view': [view: CalendarViewMode];
}>();

const selectedDates = defineModel<Date[]>('selectedDates', { default: () => [] });

const settingsStore = useSettingsStore();

// Template ref for calendar component
const calendar = ref();
const calendarView = useStorage<CalendarViewMode>(storageKeys.settings.calendarView, props.view ?? 'weekly');

const now = useNow({ interval: 60_000 });

const lastEmittedMonth = ref(new Date().getMonth() + 1);
const isTodayVisible = ref(true);

const { events } = useEvents();

// Visible date range (YYYY-MM-DD), kept in sync with v-calendar's pages so repeating events only
// expand into the days on screen. The default (current month + a week of padding each side, enough
// for leading/trailing days) gives the first render dots before the first update:pages event fires.
const DATE_FORMAT = 'YYYY-MM-DD';
const visibleRange = ref({
  from: dayjs().startOf('month').subtract(7, 'day').format(DATE_FORMAT),
  to: dayjs().endOf('month').add(7, 'day').format(DATE_FORMAT),
});

// Calendar attributes - depend on the visible range only through `visibleRange`, which onPageChange
// updates solely when the range really changes, so attributes -> update:pages -> attributes settles
// after one pass instead of recursing
const todayAttribute = computed(() => ({
  key: 'today',
  highlight: { color: 'green', fillMode: 'outline' },
  dates: now.value,
}));

const selectedDateAttribute = computed(() => ({
  key: 'selected',
  highlight: { color: 'green', fillMode: 'solid' },
  dates: selectedDates.value,
}));

// Wrapper classes that gate weekend-color CSS rules — only the weekday-N rules
// matching a has-weekend-N class on the wrapper will apply
const weekendClasses = computed(() => settingsStore.vCalendarWeekendDays.map((d) => `has-weekend-${d}`));

// Each colour has one meaning: accent (purple) = holiday, info (blue) = your own event; green stays
// reserved for today/selected. Theme CSS vars (not hex, which v-calendar ignores) follow light/dark.
const markerColor = (event: AppEvent) => `rgb(var(--v-theme-${event.type === 'holiday' ? 'accent' : 'info'}))`;

// Calendar attributes for one occurrence. Single and separately picked days each get a dot; ranges
// (e.g. back-to-back sprints) only mark their first and last day, so the calendar stays quiet.
const toOccurrenceAttributes = (event: AppEvent) => {
  const dot = { style: { backgroundColor: markerColor(event) } };
  if (!event.endDate || event.endDate === event.date) {
    return eventDays(event).map((day) => ({ dates: dayjs(day).toDate(), dot, popover: { label: event.title } }));
  }

  // Triangles point into the range: ▸ on the first day, ◂ on the last (see .range-edge styles)
  return [
    {
      dates: dayjs(event.date).toDate(),
      dot: { ...dot, class: 'range-edge range-edge--start' },
      popover: { label: `${event.title} starts` },
    },
    {
      dates: dayjs(event.endDate).toDate(),
      dot: { ...dot, class: 'range-edge range-edge--end' },
      popover: { label: `${event.title} ends` },
    },
  ];
};

// Event attributes — repeating events are expanded into their occurrences within the visible range
const eventAttributes = computed(() => {
  const { from, to } = visibleRange.value;
  return events.value
    .filter((event) => dayjs(event.date).isValid())
    .flatMap((event) =>
      getOccurrences(event, from, to).flatMap((occurrence) => toOccurrenceAttributes(atOccurrence(event, occurrence))),
    );
});

const calendarAttrs = computed(() => [todayAttribute.value, selectedDateAttribute.value, ...eventAttributes.value]);
const nextCalendarView = computed<CalendarViewMode>(() => (calendarView.value === 'weekly' ? 'monthly' : 'weekly'));
const calendarViewButtonLabel = computed(() => (nextCalendarView.value === 'weekly' ? 'Week' : 'Month'));
const calendarViewButtonIcon = computed(() =>
  nextCalendarView.value === 'weekly' ? 'mdi-calendar-week' : 'mdi-calendar-month',
);

watch(
  () => props.view,
  (view) => {
    if (view) {
      calendarView.value = view;
    }
  },
  { immediate: true },
);

watch(calendarView, (view) => {
  emit('update:view', view);
});

const toggleCalendarView = () => {
  calendarView.value = nextCalendarView.value;
};

const onDayClick = (day: { date: Date }) => {
  const clickedDate = day.date;
  const fmt = (d: Date) => dayjs(d).format('YYYY-MM-DD');

  if (props.singleDateMode) {
    const isSameDate = selectedDates.value.length === 1 && fmt(selectedDates.value[0]) === fmt(clickedDate);
    selectedDates.value = isSameDate ? [] : [clickedDate];
  } else {
    const exists = selectedDates.value.some((d) => fmt(d) === fmt(clickedDate));
    selectedDates.value = exists
      ? selectedDates.value.filter((d) => fmt(d) !== fmt(clickedDate))
      : [...selectedDates.value, clickedDate];
  }
};

const removeDate = (dateToRemove: Date) => {
  const fmt = (d: Date) => dayjs(d).format('YYYY-MM-DD');
  selectedDates.value = selectedDates.value.filter((d) => fmt(d) !== fmt(dateToRemove));
};

// Handle calendar page navigation — emit month changes and track today's visibility
const onPageChange = (pages: Page[]) => {
  const newMonth = pages[0].month;
  if (newMonth !== lastEmittedMonth.value) {
    lastEmittedMonth.value = newMonth;
    emit('monthChanged', newMonth);
  }
  const todayStr = dayjs().format('YYYY-MM-DD');
  isTodayVisible.value = pages[0].viewDays?.some((day) => dayjs(day.date).format('YYYY-MM-DD') === todayStr) ?? false;

  // First page's first day to last page's last day. Assign only on a real change: the attributes
  // this triggers make v-calendar re-emit update:pages with the same range, which must be a no-op
  const firstDay = pages[0].viewDays?.[0];
  const lastViewDays = pages[pages.length - 1].viewDays;
  const lastDay = lastViewDays?.[lastViewDays.length - 1];
  if (firstDay && lastDay) {
    const from = dayjs(firstDay.date).format(DATE_FORMAT);
    const to = dayjs(lastDay.date).format(DATE_FORMAT);
    if (from !== visibleRange.value.from || to !== visibleRange.value.to) {
      visibleRange.value = { from, to };
    }
  }
};

// Navigate to today using v-calendar's move API
const goToToday = async () => {
  if (calendar.value) {
    try {
      await calendar.value.move(new Date());
    } catch (error) {
      console.warn('Failed to navigate to today:', error);
    }
  }
};
</script>

<template>
  <!-- Wrap in VCard for standalone use; render as plain div when embedded inside a parent card -->
  <!-- overflow:visible so the popover isn't clipped; z-index:auto prevents this card from
       creating a stacking context that would trap the popover below the form fields -->
  <VCard class="calendar-overview-card" style="overflow: visible; z-index: auto">
    <VBtn
      class="calendar-view-toggle"
      color="primary"
      density="compact"
      size="small"
      variant="text"
      :aria-label="`Switch to ${calendarViewButtonLabel} view`"
      @click="toggleCalendarView"
    >
      <VIcon :icon="calendarViewButtonIcon" size="16" />
      <span class="calendar-view-label">{{ calendarViewButtonLabel }}</span>
    </VBtn>

    <Calendar
      ref="calendar"
      :class="weekendClasses"
      :view="calendarView"
      expanded
      title-position="left"
      color="primary"
      borderless
      :is-dark="isDark"
      :first-day-of-week="settingsStore.vCalendarFirstDay"
      :attributes="calendarAttrs"
      @dayclick="onDayClick"
      @update:pages="onPageChange"
    >
      <!-- Calendar footer: chips + Today button as a flat wrapping row -->
      <template #footer>
        <div class="pa-2 d-flex flex-wrap ga-1">
          <VDivider v-if="selectedDates?.length > 0" class="my-2"></VDivider>

          <TransitionGroup name="chip">
            <VChip
              v-for="date in selectedDates"
              :key="date.getTime()"
              closable
              color="primary"
              @click:close="removeDate(date)"
            >
              {{ dayjs(date).format('MMM D') }}
            </VChip>

            <VChip
              v-if="selectedDates.length > 1"
              color="error"
              append-icon="mdi-close-circle"
              @click="selectedDates = []"
            >
              Clear all
            </VChip>
          </TransitionGroup>

          <VBtn v-if="!isTodayVisible" variant="tonal" @click="goToToday" prepend-icon="mdi-calendar-today">
            Today
          </VBtn>
        </div>
      </template>
    </Calendar>
  </VCard>
</template>

<style scoped>
.calendar-overview-card {
  position: relative;
}

/* Range edges: dot-sized triangles pointing into the range — ▸ on the first day, ◂ on the last. A pointed
   shape keeps its direction at this size, where half circles or brackets blur into plain dots */
.calendar-overview-card :deep(.range-edge) {
  width: 6px;
  height: 7px;
  border-radius: 0;
}

.calendar-overview-card :deep(.range-edge--start) {
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

.calendar-overview-card :deep(.range-edge--end) {
  clip-path: polygon(100% 0, 0 50%, 100% 100%);
}

.calendar-view-toggle {
  position: absolute;
  top: 10px;
  right: 78px;
  z-index: 2;
  min-width: 68px;
  height: 30px;
  padding-inline: 8px;
}

.calendar-view-toggle :deep(.v-btn__content) {
  gap: 4px;
}

/* Calendar day interaction styles */
:deep(.vc-day) {
  cursor: pointer;
}

/* Show adjacent months' days (v-calendar hides them with opacity 0 and has no prop for it), dimmed to
   Vuetify's VDatePicker show-adjacent-months look (opacity 0.5) and still clickable. Event markers show too:
   eventAttributes already covers the whole grid (visibleRange comes from viewDays). */
:deep(.vc-monthly .is-not-in-month *) {
  opacity: 1;
  pointer-events: auto;
}

:deep(.vc-monthly .is-not-in-month) {
  opacity: 0.5;
}

/* Constrain calendar to its parent container width so chips in the footer wrap correctly */
:deep(.vc-container) {
  width: 100% !important;
  max-width: 100%;
}

/* Weekend day text color — only weekday-N rules matching a has-weekend-N class fire */
:deep(.has-weekend-1 .vc-day.weekday-1 .vc-day-content),
:deep(.has-weekend-2 .vc-day.weekday-2 .vc-day-content),
:deep(.has-weekend-3 .vc-day.weekday-3 .vc-day-content),
:deep(.has-weekend-4 .vc-day.weekday-4 .vc-day-content),
:deep(.has-weekend-5 .vc-day.weekday-5 .vc-day-content),
:deep(.has-weekend-6 .vc-day.weekday-6 .vc-day-content),
:deep(.has-weekend-7 .vc-day.weekday-7 .vc-day-content) {
  color: rgb(var(--v-theme-primary));
}

/* Chip enter/leave transitions required by TransitionGroup */
.chip-enter-active {
  transition: all 0.2s ease-out;
}

.chip-leave-active {
  transition: all 0.15s ease-in;
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.7);
}

.chip-leave-to {
  opacity: 0;
  transform: scale(0.7);
}

@media (max-width: 520px) {
  .calendar-view-toggle {
    right: 76px;
    min-width: 34px;
    padding-inline: 7px;
  }

  .calendar-view-label {
    display: none;
  }
}
</style>
