<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import type { Holiday } from '@/apis/holidayApi';
import type { XeroLog } from '@/interfaces/XeroLog';

import dayjs from 'dayjs';

import { fetchVnHolidays } from '@/apis/holidayApi';
import { nagerDateFormat, shortDateFormat } from '@/common/DateFormat';
import { chain, sumBy } from 'lodash';

const props = defineProps<{
  selectedDate: Date; // | Date[];
  xeroLogs?: XeroLog[];
}>();

const emit = defineEmits<{
  selectedDateChanged: [day: Date];
}>();

const viewModeToggle = ref(1);
const calendarViewMode = computed(() => (viewModeToggle.value === 0 ? 'weekly' : 'monthly'));

const selectedDate = ref<Date>(props.selectedDate);
const xeroLogs = computed(() => props.xeroLogs ?? []);

const holidays = ref<Holiday[]>([]);

onMounted(async () => {
  try {
    holidays.value = await fetchVnHolidays();
  } catch {
    holidays.value = [];
  }
});

// Extracted to compute grouped duration sums by date
const groupedDurations = computed(() =>
  chain(xeroLogs.value)
    .groupBy((item) => item.date)
    .map((items, date) => ({ date, durationSum: sumBy(items, 'duration') }))
    .value(),
);

// Individual calendar attributes with inline data processing
const todayAttribute = computed(() => ({
  key: 'today',
  highlight: { color: 'blue', fillMode: 'light' },
  dates: new Date(),
}));

const selectedDateAttribute = computed(() => ({
  key: 'selected',
  highlight: { color: 'blue', fillMode: 'outline' },
  dates: selectedDate.value,
}));

const fullyLoggedAttribute = computed(() => ({
  key: 'fullyLogged',
  dot: 'green',
  dates: groupedDurations.value
    .filter((group) => {
      const loggedHours = group.durationSum / 60;
      return loggedHours >= 7.5 && loggedHours <= 8;
    })
    .map((log) => dayjs(log.date, shortDateFormat).toDate()),
}));

const invalidLoggedAttribute = computed(() => ({
  key: 'invalidLogged',
  dot: 'red',
  dates: groupedDurations.value
    .filter((log) => {
      const isOverLogged = log.durationSum / 60 > 8;
      const dayOfWeek = dayjs(log.date, shortDateFormat).day();
      const isWeekend = [0, 5, 6].includes(dayOfWeek);
      return isOverLogged || isWeekend;
    })
    .map((log) => dayjs(log.date, shortDateFormat).toDate()),
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

// All attributes
const calendarAttrs = computed(() => [
  todayAttribute.value,
  selectedDateAttribute.value,
  fullyLoggedAttribute.value,
  invalidLoggedAttribute.value,
  weekendAttribute.value,
  ...holidayAttributes.value,
]);

const onDayClick = (day: any) => {
  selectedDate.value = day.date;
  emit('selectedDateChanged', day.date);
};

const gotoToday = () => {
  selectedDate.value = new Date();
  emit('selectedDateChanged', new Date());
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

  <VCard class="elevation-0 border">
    <VCardText class="d-flex justify-space-between align-center">
      <VBtn prepend-icon="mdi-calendar-today-outline" variant="text" @click="gotoToday">Today</VBtn>

      <VBtnToggle v-model="viewModeToggle" variant="tonal">
        <VBtn icon="mdi-view-week-outline" />
        <VBtn icon="mdi-calendar-month-outline" />
      </VBtnToggle>
    </VCardText>
  </VCard>
</template>

<style scoped></style>
