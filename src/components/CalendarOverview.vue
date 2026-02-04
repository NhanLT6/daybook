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

const { singleDateMode = false } = defineProps<{
  singleDateMode?: boolean;
}>();

const emit = defineEmits<{
  monthChanged: [month: number];
}>();

const selectedDates = defineModel<Date[]>({ default: () => [] });

const settingsStore = useSettingsStore();

// Template ref for calendar component
const calendar = ref();

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
const eventAttributes = computed(() => {
  return events.value
    .filter((event) => dayjs(event.date).isValid())
    .map((event) => ({
      dates: dayjs(event.date).toDate(),
      dot: { color: event.type === 'holiday' ? '#673AB7' : '#3F51B5' },
      popover: { label: event.title },
    }));
});

const calendarAttrs = computed(() => [todayAttribute.value, selectedDateAttribute.value, ...eventAttributes.value]);

const onDayClick = (day: { date: Date }) => {
  const clickedDate = day.date;

  if (singleDateMode) {
    // Single date mode: Replace selection with clicked date
    const isSameDate =
      selectedDates.value.length === 1 &&
      dayjs(selectedDates.value[0]).format('YYYY-MM-DD') === dayjs(clickedDate).format('YYYY-MM-DD');

    if (isSameDate) {
      // Clicking the same date deselects it
      selectedDates.value = [];
    } else {
      // Replace with new date
      selectedDates.value = [clickedDate];
    }
  } else {
    // Multi-date mode: Toggle date selection
    const dateIndex = selectedDates.value.findIndex(
      (date) => dayjs(date).format('YYYY-MM-DD') === dayjs(clickedDate).format('YYYY-MM-DD'),
    );

    if (dateIndex > -1) {
      selectedDates.value.splice(dateIndex, 1);
    } else {
      selectedDates.value.push(clickedDate);
    }
  }

  // selectedDates is automatically synced with parent via v-model
};

// Handle calendar page navigation
const onPageChange = (pages: Page[]) => {
  const newSelectedMonth = pages[0];
  // Only emit month change, don't track internal state to avoid recursion
  emit('monthChanged', newSelectedMonth.month);
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
  <!-- Calendar Island -->
  <VCard class="pa-2">
    <!-- Main calendar component with attributes and event handlers -->
    <Calendar
      ref="calendar"
      :class="weekendClasses"
      view="monthly"
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
      <!-- Calendar footer with Today navigation button -->
      <template #footer>
        <div class="pa-2">
          <VBtn block variant="tonal" color="primary" @click="goToToday">
            <VIcon start>mdi-calendar-today</VIcon>
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
</style>
