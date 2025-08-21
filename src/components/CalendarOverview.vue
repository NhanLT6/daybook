<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import type { Holiday } from '@/apis/holidayApi';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { fetchVnHolidays } from '@/apis/holidayApi';
import { nagerDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { toast } from 'vue-sonner';

const props = defineProps<{
  selectedDates: Date[];
}>();

const emit = defineEmits<{
  selectedDatesChanged: [days: Date[]];
}>();

const viewModeToggle = ref(1);
const calendarViewMode = computed(() => (viewModeToggle.value === 0 ? 'weekly' : 'monthly'));

const selectedDates = ref<Date[]>(props.selectedDates ?? []);

const holidays = useStorage<Holiday[]>(storageKeys.holidays, []);

// Watch for prop changes
watch(
  () => props.selectedDates,
  (newDates) => {
    selectedDates.value = [...newDates];
  },
  { immediate: true },
);

// Fetch holidays if not already cached for the current year
onMounted(async () => {
  if (holidays.value.length === 0) {
    try {
      holidays.value = await fetchVnHolidays();
    } catch (error) {
      toast.warning('Failed to fetch holidays:');
      console.warn('Failed to fetch holidays:', error);

      holidays.value = [];
    }
  }
});

// Calendar attributes
const todayAttribute = computed(() => ({
  key: 'today',
  highlight: { color: 'blue', fillMode: 'light' },
  dates: new Date(),
}));

const selectedDateAttribute = computed(() => ({
  key: 'selected',
  highlight: { color: 'blue', fillMode: 'outline' },
  dates: selectedDates.value,
}));

const weekendAttribute = computed(() => ({
  key: 'weekend',
  highlight: { color: 'gray', fillMode: 'light' },
  dates: {
    start: dayjs().startOf('month').toDate(),
    repeat: {
      every: 'week',
      weekdays: [1, 6, 7], // 1 Sunday, 6 Friday, 7 Saturday
    },
  },
}));

const holidayAttributes = computed(() =>
  holidays.value.map((holiday) => ({
    dates: dayjs(holiday.date, nagerDateFormat).toDate(),
    dot: { color: 'purple' },
    popover: { label: holiday.localName },
  })),
);

const calendarAttrs = computed(() => [
  todayAttribute.value,
  selectedDateAttribute.value,
  weekendAttribute.value,
  ...holidayAttributes.value,
]);

// Upcoming holidays (next 30 days)
const upcomingHolidays = computed(() => {
  if (holidays.value.length === 0) return [];

  const today = dayjs();
  const in30Days = today.add(30, 'day');

  return holidays.value
    .map((holiday) => ({
      ...holiday,
      dayjs: dayjs(holiday.date, nagerDateFormat),
    }))
    .filter(
      (holiday) =>
        holiday.dayjs.isValid() && holiday.dayjs.isAfter(today, 'day') && holiday.dayjs.isBefore(in30Days, 'day'),
    )
    .sort((a, b) => a.dayjs.diff(b.dayjs))
    .slice(0, 3); // Show only next 3 holidays
});

const upcomingHolidaysText = computed(() => {
  if (upcomingHolidays.value.length === 0) return '';

  const today = dayjs();
  return upcomingHolidays.value
    .map((holiday) => {
      const diff = holiday.dayjs.diff(today, 'day');
      let dateText: string;

      if (diff === 1) {
        dateText = 'Tomorrow';
      } else if (diff <= 7) {
        dateText = `In ${diff} days`;
      } else {
        dateText = holiday.dayjs.format('MMM D');
      }

      return `${holiday.localName} (${dateText})`;
    })
    .join(' • ');
});

const onDayClick = (day: any) => {
  const clickedDate = day.date;

  // Toggle date selection
  const dateIndex = selectedDates.value.findIndex(
    (date) => dayjs(date).format('YYYY-MM-DD') === dayjs(clickedDate).format('YYYY-MM-DD'),
  );

  if (dateIndex > -1) {
    selectedDates.value.splice(dateIndex, 1);
  } else {
    selectedDates.value.push(clickedDate);
  }

  emit('selectedDatesChanged', [...selectedDates.value]);
};
</script>

<template>
  <Calendar
    :view="calendarViewMode"
    :attributes="calendarAttrs"
    expanded
    :first-day-of-week="2"
    @dayclick="onDayClick"
    :min-date="dayjs().startOf('month').toDate()"
    :max-date="dayjs().endOf('month').toDate()"
  />

  <!-- Upcoming Holidays Banner -->
  <VCard v-if="upcomingHolidaysText" class="elevation-0 border mt-2" color="purple-lighten-5">
    <VCardText class="d-flex align-center ga-2 py-3">
      <VIcon color="purple-darken-1" size="18">mdi-party-popper</VIcon>
      <div class="text-body-2 text-purple-darken-2 holiday-banner-text">
        <span class="font-weight-medium">Next:</span> {{ upcomingHolidaysText }}
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
:deep(.vc-day) {
  cursor: pointer;
}

:deep(.vc-day:hover) {
  background-color: rgba(0, 0, 0, 0.04);
}

.holiday-banner-text {
  line-height: 1.3;
  word-break: break-word;
}
</style>
