<script setup lang="ts">
import { computed, ref } from 'vue';

import EventForm from '@/components/EventForm.vue';

import type { AppEvent } from '@/interfaces/Event';

import dayjs from 'dayjs';

import holidayImg from '@/assets/summer-holidays.png';
import { formatEventDate } from '@/common/DateHelpers';
import { useEvents } from '@/composables/useEvents';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { nanoid } from 'nanoid';

// ─── Events from shared db collection ─────────────────────────
const { events, addEvent, removeEvent } = useEvents();
const notificationCenter = useNotificationCenterStore();

// ─── Filters ─────────────────────────────────────────────────
const typeFilter = ref<'all' | 'custom' | 'holiday'>('all');
const timeFilter = ref<'upcoming' | 'all'>('upcoming');

// Events filtered by type + time, sorted chronologically
const filteredEvents = computed<AppEvent[]>(() =>
  events.value
    .filter((e) => typeFilter.value === 'all' || e.type === typeFilter.value)
    .filter((e) => timeFilter.value === 'all' || !isPastEvent(e.date))
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date))),
);

// Empty-state copy reflects the active time filter
const emptyMessage = computed(() => (timeFilter.value === 'upcoming' ? 'No upcoming events' : 'No events'));

// Table columns — actions right-aligned via the slot (no header `align` to keep typing simple)
const headers = [
  { title: '', key: 'type', sortable: false, width: 56 },
  { title: 'Event', key: 'title', sortable: false },
  { title: 'When', key: 'when', sortable: false },
  { title: '', key: 'actions', sortable: false, width: 96 },
];

// Dim past events at the row level
const rowProps = ({ item }: { item: AppEvent }) => ({
  class: isPastEvent(item.date) ? 'text-disabled' : '',
});

const isPastEvent = (date: string): boolean => dayjs(date).isBefore(dayjs(), 'day');

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
            :items-per-page="-1"
            :row-props="rowProps"
            class="bg-container events-table"
            fixed-header
            hide-default-footer
          >
            <!-- Type avatar: holiday image vs custom icon -->
            <template #item.type="{ item }">
              <VAvatar size="small" variant="tonal">
                <VImg v-if="item.type === 'holiday'" :src="holidayImg" alt="Holiday" />
                <VIcon v-else icon="mdi-account-outline" class="text-disabled" />
              </VAvatar>
            </template>

            <!-- Title + optional muted description line -->
            <template #item.title="{ item }">
              <div class="py-1">
                <div>{{ item.title }}</div>
                <div v-if="item.description" class="text-caption text-medium-emphasis">{{ item.description }}</div>
              </div>
            </template>

            <!-- Formatted date/time — keep on one line -->
            <template #item.when="{ item }">
              <span class="text-no-wrap">{{ formatEventDate(item) }}</span>
            </template>

            <!-- Edit / delete — custom events only -->
            <template #item.actions="{ item }">
              <div v-if="item.type === 'custom'" class="d-flex ga-1 justify-end">
                <VIconBtn icon="mdi-pencil-outline" size="small" variant="text" @click="openEditModal(item)" />
                <VIconBtn icon="mdi-trash-can-outline" size="small" variant="text" @click="deleteEvent(item)" />
              </div>
            </template>
          </VDataTable>
        </VCard>
      </VContainer>
    </div>

    <!-- Add / Edit Modal -->
    <VDialog v-model="isModalOpen" max-width="400" persistent>
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
