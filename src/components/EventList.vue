<script setup lang="ts">
import { computed } from 'vue';

import type { Holiday } from '@/apis/holidayApi';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { nagerDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';

// Generic event interface for all event types
export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
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
      type: 'holiday',
      icon: 'mdi-party-popper',
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

// Format date display
const formatEventDate = (date: Date): string => {
  const eventDate = dayjs(date);
  const today = dayjs();
  const diffDays = eventDate.diff(today.startOf('day'), 'day');

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  return eventDate.format('MMM D');
};

// Check if event is in the past
const isPastEvent = (date: Date): boolean => {
  return dayjs(date).isBefore(dayjs(), 'day');
};
</script>

<template>
  <VCard v-if="events.length > 0" class="event-list">
    <VCardText class="pa-3">
      <!-- Header -->
      <div class="d-flex align-center ga-2 mb-2">
        <VIcon size="18" color="primary">mdi-calendar-star</VIcon>
        <span class="text-body-2 font-weight-medium">Events</span>
      </div>

      <!-- Events List -->
      <div class="events-container">
        <div
          v-for="event in events"
          :key="event.id"
          class="event-item d-flex align-center ga-2 py-1"
          :class="{ 'text-disabled': isPastEvent(event.date) }"
        >
          <VIcon :color="isPastEvent(event.date) ? 'disabled' : event.color" size="16">{{ event.icon }}</VIcon>
          <span class="event-title text-body-2 flex-grow-1 text-truncate">{{ event.title }}</span>
          <VChip size="x-small" variant="tonal" :color="isPastEvent(event.date) ? 'default' : event.color">
            {{ formatEventDate(event.date) }}
          </VChip>
        </div>
      </div>
    </VCardText>
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
