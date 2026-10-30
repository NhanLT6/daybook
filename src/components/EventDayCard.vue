<script setup lang="ts">
import { computed } from 'vue';

import { useEvents } from '@/composables/useEvents';
import { useWorkCalendar } from '@/composables/useWorkCalendar';

import type { AppEvent } from '@/interfaces/Event';

import { useNow } from '@vueuse/core';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { formatEventDate } from '@/common/DateHelpers';
import { atOccurrence, getNextOccurrence, nextEventDay, occurrenceOn } from '@/common/eventRecurrence';

const { day, selectedEventId = null } = defineProps<{
  day: string; // YYYY-MM-DD: today, or the day picked on the calendar
  selectedEventId?: string | null;
}>();

const emit = defineEmits<{
  selectEvent: [id: string];
}>();

const { events } = useEvents();
const workCalendar = useWorkCalendar();

const now = useNow({ interval: 60_000 });
const today = computed(() => dayjs(now.value).format(isoDateFormat));

// Header: "Today" for today, the weekday otherwise; the date always underneath
const heading = computed(() => (day === today.value ? 'Today' : dayjs(day).format('dddd')));
const dateLabel = computed(() => dayjs(day).format('ddd, MMM D, YYYY'));

interface DayItem {
  id: string;
  title: string;
  type: AppEvent['type'];
  when: string;
  sortKey: string; // all-day first, then by start time
}

// Soonest first; on the same day, all-day events before timed ones
const bySortKey = (a: DayItem, b: DayItem) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title);

// What the day shows for one occurrence: its time (or "All day"), plus the full span when it runs over several days
const describeOn = (event: AppEvent, occurrence: string): string => {
  const shown = atOccurrence(event, occurrence);
  const time = shown.startTime ? `${shown.startTime} – ${shown.endTime}` : 'All day';
  if (!shown.endDate || shown.endDate === shown.date) return time;

  const span = formatEventDate({ ...shown, startTime: undefined, endTime: undefined });
  return shown.startTime ? `${span}, ${time}` : span;
};

// How far a later date is from the shown day: "tomorrow" / "in 4 days" for today, "4 days later" for a picked day
const describeGap = (on: string): string => {
  const gap = dayjs(on).diff(dayjs(day), 'day');
  if (day !== today.value) return `${gap} ${gap === 1 ? 'day' : 'days'} later`;
  return gap === 1 ? 'tomorrow' : `in ${gap} days`;
};

// The events on the shown day
const dayItems = computed<DayItem[]>(() =>
  events.value
    .flatMap((event) => {
      const occurrence = occurrenceOn(event, day, workCalendar.value);
      if (!occurrence) return [];

      return {
        id: event.id,
        title: atOccurrence(event, occurrence).title,
        type: event.type,
        when: describeOn(event, occurrence),
        sortKey: event.startTime ?? '',
      };
    })
    .sort(bySortKey),
);

// The next few events after the shown day, each at its first occurrence after it
const UPCOMING_COUNT = 3;

const upcoming = computed<DayItem[]>(() => {
  const from = dayjs(day).add(1, 'day').format(isoDateFormat);

  return events.value
    .flatMap((event) => {
      const on = nextEventDay(event, from, workCalendar.value);
      if (!on) return [];

      const occurrence = getNextOccurrence(event, from, workCalendar.value) ?? on;
      return {
        id: event.id,
        title: atOccurrence(event, occurrence).title,
        type: event.type,
        when: `${dayjs(on).format('ddd, MMM D')} · ${describeGap(on)}`,
        sortKey: `${on} ${event.startTime ?? ''}`,
      };
    })
    .sort(bySortKey)
    .slice(0, UPCOMING_COUNT);
});

// The card's two sections, drawn the same way: the shown day, then what comes next
const sections = computed(() => [
  { key: 'day', heading: heading.value, date: dateLabel.value, items: dayItems.value, empty: 'Nothing on' },
  { key: 'next', heading: 'Next', date: '', items: upcoming.value, empty: 'No upcoming events' },
]);

// Same dot colours as the calendar: accent = holiday, info = your own event
const dotColor = (type: AppEvent['type']) => (type === 'holiday' ? 'accent' : 'info');
</script>

<template>
  <VCard variant="text" class="event-day-card pb-2">
    <section v-for="section in sections" :key="section.key">
      <!-- Label (Today / weekday / Next), with the date on the right for the day section -->
      <div class="d-flex align-baseline justify-space-between ga-2 px-4 pt-3">
        <span class="text-subtitle-1 font-weight-medium">{{ section.heading }}</span>
        <span class="text-caption text-medium-emphasis">{{ section.date }}</span>
      </div>

      <!-- Its events; clicking one selects it like a row in the list -->
      <VList v-if="section.items.length" density="compact" bg-color="transparent" class="py-1">
        <VListItem
          v-for="item in section.items"
          :key="item.id"
          :title="item.title"
          :subtitle="item.when"
          :active="item.id === selectedEventId"
          color="primary"
          rounded="lg"
          class="mx-2"
          @click="emit('selectEvent', item.id)"
        >
          <template #prepend>
            <VIcon icon="mdi-circle" size="10" :color="dotColor(item.type)" class="me-n4" />
          </template>
        </VListItem>
      </VList>

      <div v-else class="text-body-2 text-medium-emphasis px-4 pt-1">{{ section.empty }}</div>
    </section>
  </VCard>
</template>
