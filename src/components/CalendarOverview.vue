<script setup lang="ts">
import { computed, ref } from 'vue';

import type { Holiday } from '@/apis/holidayApi';
import type { Page } from 'v-calendar/dist/types/src/utils/page.d.ts';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

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

// Check if a day is a weekend based on settings
const isWeekend = (weekday: number) => {
  return settingsStore.vCalendarWeekendDays.includes(weekday);
};

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

const calendarAttrs = computed(() => [todayAttribute.value, selectedDateAttribute.value, ...holidayAttributes.value]);

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
      <!-- Custom day content with weekend text color styling -->
      <template #day-content="{ day }">
        <span class="vc-day-content" :class="{ 'weekend-day': isWeekend(day.weekday) }" @click="onDayClick(day)">
          {{ day.day }}
        </span>
      </template>

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

/* Custom day content - match v-calendar's default centering */
:deep(.vc-day-content) {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

/* Weekend day text color */
.weekend-day {
  color: rgb(var(--v-theme-primary));
}
</style>
