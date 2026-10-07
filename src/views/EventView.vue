<script setup lang="ts">
import { computed, ref } from 'vue';

import CalendarOverview from '@/components/CalendarOverview.vue';
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

const onSelectDates = (dates: Date[]) => {
  selectedDates.value = dates;
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
    <!-- Calendar column: fixed width, opens on the month (remembered apart from Home's week/month) -->
    <CalendarOverview
      class="glass-acrylic event-calendar"
      single-date-mode
      :selected-dates="selectedDates"
      :view-storage-key="storageKeys.settings.eventCalendarView"
      default-view="monthly"
      :highlight-event="highlightEvent"
      @update:selected-dates="onSelectDates"
    />

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

/* Calendar keeps its natural height instead of the page's full-height panel rule */
.event-page > .event-calendar {
  flex: 0 0 340px;
  height: auto;
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

  .event-page > .event-calendar {
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
