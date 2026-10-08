<script setup lang="ts">
import { computed } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { useNow } from '@vueuse/core';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { formatEventDate } from '@/common/DateHelpers';
import { atOccurrence, nextEventDay, occurrenceOn } from '@/common/eventRecurrence';
import { useEvents } from '@/composables/useEvents';
import { useWorkCalendar } from '@/composables/useWorkCalendar';

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

// What the day shows for one occurrence: its time (or "All day"), plus the full span when it runs over several days
const describeOn = (event: AppEvent, occurrence: string): string => {
  const shown = atOccurrence(event, occurrence);
  const time = shown.startTime ? `${shown.startTime} – ${shown.endTime}` : 'All day';
  if (!shown.endDate || shown.endDate === shown.date) return time;
  const span = formatEventDate({ ...shown, startTime: undefined, endTime: undefined });
  return shown.startTime ? `${span}, ${time}` : span;
};

const dayItems = computed<DayItem[]>(() =>
  events.value
    .flatMap((event) => {
      const occurrence = occurrenceOn(event, day, workCalendar.value);
      if (!occurrence) return [];
      return [
        {
          id: event.id,
          title: event.title,
          type: event.type,
          when: describeOn(event, occurrence),
          sortKey: event.startTime ?? '',
        },
      ];
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title)),
);

// Nothing on the day: point at what comes next instead of an empty card
const nextUp = computed(() => {
  if (dayItems.value.length) return null;
  const from = dayjs(day).add(1, 'day').format(isoDateFormat);
  let best: { event: AppEvent; on: string } | null = null;
  for (const event of events.value) {
    const on = nextEventDay(event, from, workCalendar.value);
    if (on && (!best || on < best.on)) best = { event, on };
  }
  if (!best) return null;

  // Count days from the shown day: "in 4 days" for today, "4 days later" for a picked day
  const gap = dayjs(best.on).diff(dayjs(day), 'day');
  const relative =
    day === today.value
      ? gap === 1
        ? 'tomorrow'
        : `in ${gap} days`
      : `${gap} ${gap === 1 ? 'day' : 'days'} later`;
  return {
    id: best.event.id,
    title: best.event.title,
    type: best.event.type,
    when: `${dayjs(best.on).format('ddd, MMM D')} · ${relative}`,
  };
});

// Same dot colours as the calendar: accent = holiday, info = your own event
const dotColor = (type: AppEvent['type']) => (type === 'holiday' ? 'accent' : 'info');
</script>

<template>
  <VCard class="glass-acrylic event-day-card">
    <!-- Header: which day this is -->
    <div class="d-flex align-baseline justify-space-between ga-2 px-4 pt-3">
      <span class="text-subtitle-1 font-weight-medium">{{ heading }}</span>
      <span class="text-caption text-medium-emphasis">{{ dateLabel }}</span>
    </div>

    <!-- The day's events; clicking one selects it like a row in the list -->
    <VList v-if="dayItems.length" density="compact" bg-color="transparent" class="py-1">
      <VListItem
        v-for="item in dayItems"
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

    <!-- Empty day: what's next, or that nothing is coming -->
    <div v-else class="px-4 pt-1 pb-3">
      <div class="text-body-2 text-medium-emphasis">Nothing on</div>
      <VListItem
        v-if="nextUp"
        :title="`Next: ${nextUp.title}`"
        :subtitle="nextUp.when"
        :active="nextUp.id === selectedEventId"
        color="primary"
        rounded="lg"
        density="compact"
        class="mt-1 mx-n2"
        @click="emit('selectEvent', nextUp.id)"
      >
        <template #prepend>
          <VIcon icon="mdi-circle" size="10" :color="dotColor(nextUp.type)" class="me-n4" />
        </template>
      </VListItem>
      <div v-else class="text-caption text-medium-emphasis">No upcoming events</div>
    </div>
  </VCard>
</template>
