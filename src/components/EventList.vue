<script setup lang="ts">
import { computed } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import holidayImg from '@/assets/summer-holidays.png';
import { shortDateFormat } from '@/common/DateFormat';
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

// Events from storage (holidays + custom events)
const events = useStorage<AppEvent[]>(storageKeys.events, []);

// Convert AppEvents to generic CalendarEvent format
const calendarEvents = computed<CalendarEvent[]>(() => {
  const eventList: CalendarEvent[] = [];

  for (const event of events.value) {
    const date = dayjs(event.date);
    if (!date.isValid()) continue;

    eventList.push({
      id: event.id,
      title: event.title,
      date: date.toDate(),
      displayDate: dayjs(date).format(shortDateFormat),
      type: event.type === 'holiday' ? 'holiday' : 'custom',
      icon: '',
      color: 'accent',
    });
  }

  return eventList;
});

// TODO: Add Google Calendar events in future
// const googleEvents = computed<CalendarEvent[]>(() => []);

// TODO: Add custom user events in future
// const customEvents = computed<CalendarEvent[]>(() => []);

// Get events for current month and next month
const eventList = computed(() => {
  const startOfCurrentMonth = dayjs().startOf('month');
  const endOfNextMonth = dayjs().add(1, 'month').endOf('month');

  // Combine all event sources
  const allEvents = [...calendarEvents.value];

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
  <VCard v-if="eventList.length > 0" class="event-list">
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
        v-for="event in eventList"
        :key="event.id"
        :class="{ 'text-disabled': isPastEvent(event.date) }"
        :subtitle="event.displayDate"
        :title="event.title"
      >
        <template #prepend>
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
