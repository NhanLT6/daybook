<script setup lang="ts">
import { computed, ref } from 'vue';

import type { Holiday } from '@/apis/holidayApi';
import type { Page } from 'v-calendar/dist/types/src/utils/page.d.ts';

import { useStorage } from '@vueuse/core';
import { useTheme } from 'vuetify';

import dayjs from 'dayjs';

import { nagerDateFormat } from '@/common/DateFormat';
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

const holidays = useStorage<Holiday[]>(storageKeys.holidays, []);

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

// Weekend attribute - simplified to avoid date interval issues
const weekendAttribute = computed(() => ({
  key: 'weekend',
  highlight: { color: 'gray', fillMode: 'light' },
  dates: {
    start: new Date(1900, 0, 1),
    repeat: {
      every: 'week',
      weekdays: settingsStore.vCalendarWeekendDays,
    },
  },
}));

// Holiday attributes - show all holidays without month filtering to avoid recursion
const holidayAttributes = computed(() => {
  return holidays.value
    .filter((holiday) => {
      const holidayDate = dayjs(holiday.date, nagerDateFormat);
      return holidayDate.isValid();
    })
    .map((holiday) => ({
      dates: dayjs(holiday.date, nagerDateFormat).toDate(),
      dot: { color: 'purple' },
      popover: { label: holiday.localName },
    }));
});

const calendarAttrs = computed(() => [
  todayAttribute.value,
  selectedDateAttribute.value,
  weekendAttribute.value,
  ...holidayAttributes.value,
]);

// Next holiday (including today, next 30 days)
const nextHoliday = computed(() => {
  if (holidays.value.length === 0) return null;

  const today = dayjs();
  const in30Days = today.add(30, 'day');

  const holiday = holidays.value
    .map((holiday) => ({
      ...holiday,
      dayjs: dayjs(holiday.date, nagerDateFormat),
      daysFromToday: dayjs(holiday.date, nagerDateFormat).diff(today, 'day'),
    }))
    .filter(
      (holiday) => holiday.dayjs.isValid() && holiday.daysFromToday >= 0 && holiday.dayjs.isBefore(in30Days, 'day'),
    )
    .sort((a, b) => a.daysFromToday - b.daysFromToday)[0]; // Get the first (closest) holiday

  return holiday || null;
});

const upcomingHolidaysDisplay = computed(() => {
  if (!nextHoliday.value) return '';

  const holiday = nextHoliday.value;

  if (holiday.daysFromToday === 0) {
    return `Today: ${holiday.localName}`;
  } else {
    let dateText: string;
    if (holiday.daysFromToday === 1) {
      dateText = 'Tomorrow';
    } else if (holiday.daysFromToday <= 7) {
      dateText = `In ${holiday.daysFromToday} days`;
    } else {
      dateText = holiday.dayjs.format('MMM D');
    }

    return `Next: ${holiday.localName} (${dateText})`;
  }
});

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
  <!-- Main calendar component with attributes and event handlers -->
  <Calendar
    ref="calendar"
    view="monthly"
    expanded
    title-position="left"
    color="primary"
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

  <!-- Holidays Banner -->
  <VCard v-if="upcomingHolidaysDisplay" class="elevation-0 mt-2" color="accent-light">
    <VCardText class="d-flex align-center ga-2 py-3">
      <VIcon color="accent" size="18">mdi-party-popper</VIcon>
      <div class="text-body-2 text-accent holiday-banner-text">
        {{ upcomingHolidaysDisplay }}
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
/* Calendar day interaction styles */
:deep(.vc-day) {
  cursor: pointer;
}

:deep(.vc-day:hover) {
  background-color: rgba(0, 0, 0, 0.04);
}

:deep(.vc-dark .vc-day:hover) {
  background-color: rgba(255, 255, 255, 0.08);
}

.holiday-banner-text {
  line-height: 1.3;
  word-break: break-word;
}
</style>
