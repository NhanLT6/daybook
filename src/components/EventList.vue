<script setup lang="ts">
import { computed } from 'vue';

import type { Holiday } from '@/apis/holidayApi';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import holidayImg from '@/assets/summer-holidays.png';
import { nagerDateFormat, shortDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';

// Generic event interface for all event types
export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  displayDate: string;
  type: 'holiday' | 'google' | 'custom';
  icon: string;
  color: string;
}

// Holidays from storage
const holidays = useStorage<Holiday[]>(storageKeys.holidays, []);

// Convert holidays to generic CalendarEvent format
const holidayEvents = computed<CalendarEvent[]>(() => {
  const events: CalendarEvent[] = [];

  for (const holiday of holidays.value) {
    const date = dayjs(holiday.date, nagerDateFormat);
    if (!date.isValid()) continue;

    events.push({
      id: `holiday-${holiday.date}`,
      title: holiday.localName,
      date: date.toDate(),
      displayDate: dayjs(date).format(shortDateFormat),
      type: 'holiday',
      icon: '',
      color: 'accent',
    });
  }

  return events;
});

// TODO: Add Google Calendar events in future
// const googleEvents = computed<CalendarEvent[]>(() => []);

// TODO: Add custom user events in future
// const customEvents = computed<CalendarEvent[]>(() => []);

// Get events for current month and next month
const events = computed(() => {
  const startOfCurrentMonth = dayjs().startOf('month');
  const endOfNextMonth = dayjs().add(1, 'month').endOf('month');

  // Combine all event sources
  const allEvents = [...holidayEvents.value];

  return allEvents
    .filter((event) => {
      const eventDate = dayjs(event.date);
      return eventDate.isSameOrAfter(startOfCurrentMonth, 'day') && eventDate.isSameOrBefore(endOfNextMonth, 'day');
    })
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
});

// Check if event is in the past
const isPastEvent = (date: Date): boolean => {
  return dayjs(date).isBefore(dayjs(), 'day');
};

const onAddEvent = () => {
  console.log('Add event');
};
</script>

<template>
  <VCard v-if="events.length > 0" class="event-list">
    <VCardTitle>
      <VToolbar class="bg-transparent" density="compact">
        <VToolbarTitle class="ms-0">Events</VToolbarTitle>

        <VSpacer />

        <!-- Temporally disable add event button -->
        <div class="d-none ga-2">
          <!-- Add event-->
          <VTooltip>
            <template #activator="{ props }">
              <VIconBtn icon="mdi-plus" icon-size="small" rounded="lg" @click="onAddEvent" v-bind="props" />
            </template>

            Add event
          </VTooltip>
        </div>
      </VToolbar>
    </VCardTitle>

    <!-- Events List -->
    <VList lines="two" density="compact">
      <VListItem
        v-for="event in events"
        :key="event.id"
        :class="{ 'text-disabled': isPastEvent(event.date) }"
        :subtitle="event.displayDate"
        :title="event.title"
      >
        <template v-slot:prepend>
          <VAvatar v-if="event.type === 'holiday'" size="small" variant="tonal">
            <VImg :src="holidayImg" alt="Holiday" />
          </VAvatar>

          <VAvatar v-if="event.type === 'custom'" size="small" variant="tonal">
            <VIcon :icon="event.icon || 'mdi-account'" />
          </VAvatar>

          <VAvatar v-if="event.type === 'google'" size="small" variant="tonal">
            <VIcon icon="mdi-calendar-account-outline" />
          </VAvatar>
        </template>
      </VListItem>
    </VList>
  </VCard>
</template>

<style scoped>
.event-item {
  border-radius: 4px;
  padding-left: 4px;
  padding-right: 4px;
}

.event-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.event-title {
  line-height: 1.3;
}

.events-container {
  max-height: 200px;
  overflow-y: auto;
}
</style>
