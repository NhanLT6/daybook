<script setup lang="ts">
import { computed, ref } from 'vue';

import type { AppEvent } from '@/interfaces/Event';
import type { Page } from 'v-calendar/dist/types/src/utils/page.d.ts';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';

// Theme integration
const theme = useTheme();
const isDark = computed(() => theme.global.name.value === 'dark');

const { singleDateMode = false, view = 'weekly' } = defineProps<{
  singleDateMode?: boolean;
  view?: 'weekly' | 'monthly';
}>();

const emit = defineEmits<{
  monthChanged: [month: number];
}>();

const selectedDates = defineModel<Date[]>('selectedDates', { default: () => [] });

const settingsStore = useSettingsStore();

// Template ref for calendar component
const calendar = ref();

const lastEmittedMonth = ref(new Date().getMonth() + 1);
const isTodayVisible = ref(true);

const events = useStorage<AppEvent[]>(storageKeys.events, []);

// Calendar attributes - static, not reactive to displayed month to avoid recursion
const todayAttribute = computed(() => ({
  key: 'today',
  highlight: { color: 'green', fillMode: 'light' },
  dates: new Date(),
}));

const selectedDateAttribute = computed(() => ({
  key: 'selected',
  highlight: { color: 'green', fillMode: 'outline' },
  dates: selectedDates.value,
}));

// Wrapper classes that gate weekend-color CSS rules — only the weekday-N rules
// matching a has-weekend-N class on the wrapper will apply
const weekendClasses = computed(() => settingsStore.vCalendarWeekendDays.map((d) => `has-weekend-${d}`));

// Event attributes — holidays in deep-purple, custom events in indigo
// For multi-day events, create dots for each day in the range
const eventAttributes = computed(() => {
  return events.value
    .filter((event) => dayjs(event.date).isValid())
    .flatMap((event) => {
      const startDate = dayjs(event.date);
      const endDate = event.endDate ? dayjs(event.endDate) : startDate;
      const dates: Date[] = [];

      // Generate array of dates from start to end (inclusive)
      let currentDate = startDate;
      while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
        dates.push(currentDate.toDate());
        currentDate = currentDate.add(1, 'day');
      }

      // Create an attribute for each date in the range
      return dates.map((date) => ({
        dates: date,
        dot: { color: event.type === 'holiday' ? '#673AB7' : '#3F51B5' },
        popover: { label: event.title },
      }));
    });
});

const calendarAttrs = computed(() => [todayAttribute.value, selectedDateAttribute.value, ...eventAttributes.value]);

const onDayClick = (day: { date: Date }) => {
  const clickedDate = day.date;
  const fmt = (d: Date) => dayjs(d).format('YYYY-MM-DD');

  if (singleDateMode) {
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
  <VCard class="mb-4" style="overflow: visible; z-index: auto">
    <Calendar
      ref="calendar"
      :class="weekendClasses"
      :view="view"
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
/* Calendar day interaction styles */
:deep(.vc-day) {
  cursor: pointer;
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
</style>
