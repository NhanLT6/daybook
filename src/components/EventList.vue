<script setup lang="ts">
import { computed, ref } from 'vue';

import EventForm from '@/components/EventForm.vue';

import type { AppEvent } from '@/interfaces/Event';

import dayjs from 'dayjs';
import { omit } from 'lodash';

import holidayImg from '@/assets/summer-holidays.png';
import { formatEventDate } from '@/common/DateHelpers';
import { atOccurrence, describeRepeat, eventDays, getNextOccurrence } from '@/common/eventRecurrence';
import { useEvents } from '@/composables/useEvents';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { nanoid } from 'nanoid';

// ─── Events from shared db collection ─────────────────────────
const { events, addEvent, removeEvent } = useEvents();
const notificationCenter = useNotificationCenterStore();

// ─── Filters ─────────────────────────────────────────────────
const typeFilter = ref<'all' | 'custom' | 'holiday'>('all');
const timeFilter = ref<'upcoming' | 'all'>('upcoming');

// One table row per event; `next` is its next occurrence (null once the series is over).
// Computed once per event here so the template never recomputes it.
interface EventRow {
  id: string;
  event: AppEvent;
  next: string | null;
}

// Events filtered by type + time, sorted by next occurrence (ended events fall back to their first date)
const filteredEvents = computed<EventRow[]>(() =>
  events.value
    .filter((e) => typeFilter.value === 'all' || e.type === typeFilter.value)
    .map((event) => ({ id: event.id, event, next: getNextOccurrence(event) }))
    // An event is past iff it has no occurrence left
    .filter((row) => timeFilter.value === 'all' || row.next !== null)
    .sort((a, b) => dayjs(a.next ?? a.event.date).diff(dayjs(b.next ?? b.event.date))),
);

// Empty-state copy reflects the active time filter
const emptyMessage = computed(() => (timeFilter.value === 'upcoming' ? 'No upcoming events' : 'No events'));

// Table columns — actions right-aligned via the slot (no header `align` to keep typing simple)
const headers = [
  { title: '', key: 'type', sortable: false, width: 56 },
  { title: 'Event', key: 'title', sortable: false },
  { title: 'When', key: 'when', sortable: false },
  { title: '', key: 'actions', sortable: false, width: 136 },
];

// Dim past events at the row level
const rowProps = ({ item }: { item: EventRow }) => ({
  class: item.next === null ? 'text-disabled' : '',
});

// ─── Modal state ─────────────────────────────────────────────
const isModalOpen = ref(false);
const editingEvent = ref<AppEvent | null>(null);

// ─── Actions ─────────────────────────────────────────────────

const openAddModal = () => {
  editingEvent.value = null;
  isModalOpen.value = true;
};

const openEditModal = (event: AppEvent) => {
  editingEvent.value = event;
  isModalOpen.value = true;
};

const onCancelModifyEvent = () => {
  isModalOpen.value = false;
};

const onSaveEvent = (event: AppEvent) => {
  // Assign ID for new events
  const savedEvent: AppEvent = {
    ...event,
    id: event.id || nanoid(),
  };

  addEvent(savedEvent);

  isModalOpen.value = false;
};

// Days of one occurrence without times, e.g. "Oct 6" or "Oct 5 – Oct 16" — a skip removes all of them
const occurrenceLabel = (event: AppEvent, occurrence: string) =>
  formatEventDate({ ...atOccurrence(event, occurrence), startTime: undefined, endTime: undefined });

// Leave the next occurrence out of a repeating series. Undo removes just that date from the
// event's CURRENT skip list, so a second skip made before undoing the first isn't lost.
const skipNextOccurrence = (event: AppEvent, next: string) => {
  if (!event.repeat) return;

  // Build new objects rather than mutating the reactive event; an empty list drops the key
  const withSkip = (target: AppEvent, skip: string[]): AppEvent => {
    const rule = omit(target.repeat!, 'skip');
    return { ...target, repeat: skip.length ? { ...rule, skip } : rule };
  };

  addEvent(withSkip(event, [...(event.repeat.skip ?? []), next]));

  const id = notificationCenter.success(`Skipped ${occurrenceLabel(event, next)}`, {
    message: event.title,
    expandOnEnqueue: true, // actions only render in the expanded island
    actions: [
      {
        id: 'undo',
        label: 'Undo',
        tone: 'primary',
        closeOnComplete: true,
        onClick: () => {
          const current = events.value.find((e) => e.id === event.id);
          if (current?.repeat) addEvent(withSkip(current, (current.repeat.skip ?? []).filter((d) => d !== next)));
        },
      },
    ],
  });
  // Store forces actionable notifications persistent by design; auto-close the undo offer ourselves.
  setTimeout(() => notificationCenter.dismiss(id), 6000);
};

const deleteEvent = (event: AppEvent) => {
  notificationCenter.confirm('Delete event?', {
    message: event.title,
    actions: [
      {
        id: 'cancel',
        label: 'Cancel',
        closeOnComplete: true,
      },
      {
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        closeOnComplete: true,
        onClick: () => {
          removeEvent(event.id);
        },
      },
    ],
  });
};
</script>

<template>
  <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
    <!-- Header -->
    <VCardTitle class="flex-shrink-0 pa-0">
      <VContainer class="page-inner pt-3 pb-0">
        <!-- Wrapping header: title and controls share one row when there's room and
             stack when there isn't. VToolbar can't wrap, so on narrow screens it
             crushed the title to zero width and clipped the filter labels. -->
        <div class="event-toolbar">
          <div class="text-h6 event-toolbar__title">Events</div>

          <div class="event-toolbar__controls">
            <!-- Type filter -->
            <VBtnToggle v-model="typeFilter" density="compact" variant="outlined" divided mandatory>
              <VBtn value="all" size="small">All</VBtn>
              <VBtn value="custom" size="small">Mine</VBtn>
              <VBtn value="holiday" size="small">Holidays</VBtn>
            </VBtnToggle>

            <!-- Time filter -->
            <VBtnToggle v-model="timeFilter" density="compact" variant="outlined" divided mandatory>
              <VBtn value="upcoming" size="small">Upcoming</VBtn>
              <VBtn value="all" size="small">All</VBtn>
            </VBtnToggle>

            <VTooltip>
              <template #activator="{ props }">
                <VBtn
                  prepend-icon="mdi-plus"
                  color="primary"
                  variant="tonal"
                  class="event-toolbar__add"
                  @click="openAddModal"
                  v-bind="props"
                >
                  New Event
                </VBtn>
              </template>
              Add event
            </VTooltip>
          </div>
        </div>
      </VContainer>
    </VCardTitle>

    <!-- Body — the table owns the scroll so its header stays fixed -->
    <div class="event-body">
      <VContainer class="page-inner event-inner">
        <!-- Empty state -->
        <div
          v-if="filteredEvents.length === 0"
          class="d-flex flex-column ga-2 py-8 align-center bg-container rounded-lg text-disabled"
        >
          <VIcon icon="mdi-calendar-blank-outline" />
          <div class="text-subtitle-1">{{ emptyMessage }}</div>
        </div>

        <!-- Events table -->
        <VCard v-else class="elevation-0 rounded-lg overflow-hidden event-table-card">
          <VDataTable
            :items="filteredEvents"
            :headers="headers"
            item-value="id"
            :items-per-page="-1"
            :row-props="rowProps"
            class="bg-container events-table"
            fixed-header
            hide-default-footer
          >
            <!-- Type avatar: holiday image vs custom icon -->
            <template #item.type="{ item }">
              <VAvatar size="small" variant="tonal">
                <VImg v-if="item.event.type === 'holiday'" :src="holidayImg" alt="Holiday" />
                <VIcon v-else icon="mdi-account-outline" class="text-disabled" />
              </VAvatar>
            </template>

            <!-- Title + optional muted description line -->
            <template #item.title="{ item }">
              <div class="py-1">
                <div>{{ item.event.title }}</div>
                <div v-if="item.event.description" class="text-caption text-medium-emphasis">
                  {{ item.event.description }}
                </div>
              </div>
            </template>

            <!-- Next occurrence (or first date once the series ended) + repeat summary -->
            <template #item.when="{ item }">
              <div class="py-1">
                <span class="text-no-wrap">{{
                  formatEventDate(item.next ? atOccurrence(item.event, item.next) : item.event)
                }}</span>
                <div v-if="item.event.repeat" class="text-caption text-medium-emphasis text-no-wrap">
                  <VIcon icon="mdi-repeat" size="x-small" class="mr-1" />{{
                    describeRepeat(eventDays(item.event), item.event.repeat)
                  }}
                </div>
              </div>
            </template>

            <!-- Skip next / edit / delete — custom events only -->
            <template #item.actions="{ item }">
              <div v-if="item.event.type === 'custom'" class="d-flex ga-1 justify-end">
                <!-- Tooltip wraps the button: VIconBtn's default slot would replace its icon -->
                <VTooltip v-if="item.event.repeat && item.next" :text="`Skip ${occurrenceLabel(item.event, item.next)}`">
                  <template #activator="{ props }">
                    <VIconBtn
                      v-bind="props"
                      icon="mdi-calendar-remove-outline"
                      size="small"
                      variant="text"
                      :aria-label="`Skip ${occurrenceLabel(item.event, item.next)}`"
                      @click="skipNextOccurrence(item.event, item.next)"
                    />
                  </template>
                </VTooltip>
                <VIconBtn icon="mdi-pencil-outline" size="small" variant="text" @click="openEditModal(item.event)" />
                <VIconBtn icon="mdi-trash-can-outline" size="small" variant="text" @click="deleteEvent(item.event)" />
              </div>
            </template>
          </VDataTable>
        </VCard>
      </VContainer>
    </div>

    <!-- Add / Edit Modal -->
    <VDialog v-model="isModalOpen" max-width="520" persistent scrollable>
      <EventForm :item="editingEvent" @save-event="onSaveEvent" @cancel-modify-event="onCancelModifyEvent" />
    </VDialog>
  </VCard>
</template>

<style scoped>
/* Header: one row while it fits, stacked once it doesn't. */
.event-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-block: 4px;
}

/* Grows to push the controls right, but may shrink to 0 rather than clip them. */
.event-toolbar__title {
  flex: 1 1 auto;
  min-width: 0;
}

.event-toolbar__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Below sm the title takes its own line and the controls span the full width, so
   the toggle groups render their labels instead of overflowing into scrollbars. */
@media (max-width: 599px) {
  .event-toolbar__title {
    flex-basis: 100%;
  }

  .event-toolbar__controls {
    width: 100%;
  }

  .event-toolbar__add {
    flex: 1 1 100%;
  }
}

/* Body fills the card; the table (not the page) owns the scroll so its header
   stays fixed via VDataTable's fixed-header. */
.event-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.event-inner {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.event-table-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Flex chain down through VDataTable's internals so .v-table__wrapper is the
   bounded scroll container (letting fixed-header stick) instead of growing to
   full content height. */
.event-table-card :deep(.v-data-table),
.event-table-card :deep(.v-table) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.event-table-card :deep(.v-table__wrapper) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Sticky header needs an opaque fill so scrolled rows don't bleed through the
   frosted glass card behind the semi-transparent .bg-container. */
.events-table :deep(thead th) {
  background: rgb(var(--v-theme-surface)) !important;
}
</style>
