<script setup lang="ts">
import { computed, ref } from 'vue';

import CalendarOverview from '@/components/CalendarOverview.vue';
import EventDayCard from '@/components/EventDayCard.vue';
import EventList from '@/components/EventList.vue';

import dayjs from 'dayjs';

import { storageKeys } from '@/common/storageKeys';
import { useEvents } from '@/composables/useEvents';

const { events } = useEvents();

// One selection at a time: a picked day (highlights its events in the list) or a clicked event
// (highlights its occurrences on the calendar). Picking one clears the other.
const selectedDates = ref<Date[]>([]);
const selectedEventId = ref<string | null>(null);

const selectedDay = computed(() => (selectedDates.value[0] ? dayjs(selectedDates.value[0]).format('YYYY-MM-DD') : null));
const highlightEvent = computed(() => events.value.find((e) => e.id === selectedEventId.value) ?? null);

// The day card shows the day last picked on the calendar, or today. Kept apart from selectedDates: selecting
// an event clears the calendar's day, but the card should stay on the day the user is looking at.
const pickedDay = ref<string | null>(null);
const cardDay = computed(() => pickedDay.value ?? dayjs().format('YYYY-MM-DD'));

const onSelectDates = (dates: Date[]) => {
  selectedDates.value = dates;
  pickedDay.value = dates[0] ? dayjs(dates[0]).format('YYYY-MM-DD') : null;
  if (dates.length) selectedEventId.value = null;
};

// Clicking the selected row again clears it
const onSelectEvent = (id: string) => {
  selectedEventId.value = selectedEventId.value === id ? null : id;
  if (selectedEventId.value) selectedDates.value = [];
};
</script>

<template>
  <div class="page-fill event-page">
    <!-- Calendar column: fixed width, opens on the month (remembered apart from Home's week/month), with the
         picked day's (or today's) events underneath -->
    <div class="event-side">
      <CalendarOverview
        class="glass-acrylic"
        single-date-mode
        :selected-dates="selectedDates"
        :view-storage-key="storageKeys.settings.eventCalendarView"
        default-view="monthly"
        :highlight-event="highlightEvent"
        @update:selected-dates="onSelectDates"
      />

      <EventDayCard :day="cardDay" :selected-event-id="selectedEventId" @select-event="onSelectEvent" />
    </div>

    <!-- Event list takes the remaining space -->
    <EventList
      class="event-list"
      :selected-day="selectedDay"
      :selected-event-id="selectedEventId"
      @select-event="onSelectEvent"
    />
  </div>
</template>

<style scoped>
.event-page {
  display: flex;
  gap: 12px;
}

/* Calendar + day card keep their natural height instead of the page's full-height panel rule */
.event-side {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-self: flex-start;
}

.event-page > .event-list {
  flex: 1 1 0;
  min-width: 0;
}

/* Below md the calendar stacks above the list and the page scrolls, so the list keeps a usable height */
@media (max-width: 959px) {
  .event-page {
    flex-direction: column;
    overflow-y: auto;
  }

  .event-side {
    flex-basis: auto;
    align-self: stretch;
  }

  .event-page > .event-list {
    flex: 0 0 auto;
    height: auto;
    min-height: 480px;
  }
}
</style>
