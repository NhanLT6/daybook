<script setup lang="ts">
import { computed, ref } from 'vue';

import type { XeroLog } from '@/interfaces/XeroLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
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

const calendarAttrs = computed(() => {
  const fullyLoggedDates = chain(xeroLogs.value)
    .groupBy((item) => item.date)
    .map((items, date) => ({ date, durationSum: sumBy(items, 'duration') }))
    .filter((group) => {
      const loggedHours = group.durationSum / 60;
      return loggedHours >= 7.5 && loggedHours <= 8;
    })
    .map((log) => dayjs(log.date, shortDateFormat).toDate())
    .value();

  const invalidLoggedDates = chain(xeroLogs.value)
    .groupBy((item) => item.date)
    .map((items, date) => ({ date, durationSum: sumBy(items, 'duration') }))
    .filter((log) => {
      const isOverLogged = log.durationSum / 60 > 8;
      const isLoggedInWeekend = [0, 6, 7].includes(dayjs(log.date, shortDateFormat).day()); // 0 Sunday, 5 Friday, 6 Saturday

      return isOverLogged || isLoggedInWeekend;
    })
    .map((log) => dayjs(log.date, shortDateFormat).toDate())
    .value();

  return [
    // Today
    {
      key: 'today',
      highlight: {
        color: 'blue',
        fillMode: 'light',
      },
      dates: new Date(),
    },
    // Selected date
    {
      key: 'selected',
      highlight: {
        color: 'blue',
        fillMode: 'outline',
      },
      dates: selectedDate.value,
    },
    // Fully logged dates
    {
      key: 'fullyLogged',
      dot: 'green',
      dates: fullyLoggedDates,
    },
    // Invalid logged dates
    {
      key: 'invalidLogged',
      dot: 'red',
      dates: invalidLoggedDates,
    },
    // Friday and weekend
    {
      key: 'weekend',
      highlight: {
        color: 'gray',
        fillMode: 'light',
      },
      dates: {
        start: dayjs().startOf('month').toDate(),
        repeat: {
          every: 'week',
          weekdays: [1, 6, 7], // 1 Sunday, 6 Friday, 7 Saturday
        },
      },
    },
  ];
});

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
