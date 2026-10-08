<script setup lang="ts">
import { computed } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { useNow } from '@vueuse/core';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { occurrenceOn } from '@/common/eventRecurrence';
import { useEvents } from '@/composables/useEvents';
import { useWorkCalendar } from '@/composables/useWorkCalendar';

const { events } = useEvents();
const workCalendar = useWorkCalendar();

const now = useNow({ interval: 60_000 });
const today = computed(() => dayjs(now.value).format(isoDateFormat));

// Today's events, all-day first then by start time; the line hides itself when there are none
const items = computed(() =>
  events.value
    .filter((event) => occurrenceOn(event, today.value, workCalendar.value) !== null)
    .map((event) => ({
      id: event.id,
      label: event.startTime ? `${event.title} · ${event.startTime}` : event.title,
      type: event.type,
      sortKey: event.startTime ?? '',
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.label.localeCompare(b.label)),
);

// Same dot colours as the calendar: accent = holiday, info = your own event
const dotColor = (type: AppEvent['type']) => (type === 'holiday' ? 'accent' : 'info');
</script>

<template>
  <!-- A quiet one-glance reminder above the log form: text chips, no fill, wrap only if there are many -->
  <div v-if="items.length" class="d-flex align-center flex-wrap ga-1 text-body-2">
    <VIcon icon="mdi-calendar-star" size="small" class="text-medium-emphasis me-1" />
    <span class="text-medium-emphasis me-1">Today</span>
    <VChip v-for="item in items" :key="item.id" size="small" variant="text" class="px-1">
      <template #prepend>
        <VIcon icon="mdi-circle" size="8" :color="dotColor(item.type)" class="me-1" />
      </template>
      {{ item.label }}
    </VChip>
  </div>
</template>
