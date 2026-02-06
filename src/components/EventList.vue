<script setup lang="ts">
import { computed, ref } from 'vue';

import EventForm from '@/components/EventForm.vue';

import type { AppEvent } from '@/interfaces/Event';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import holidayImg from '@/assets/summer-holidays.png';
import { formatEventDate } from '@/common/DateHelpers';
import { storageKeys } from '@/common/storageKeys';
import { nanoid } from 'nanoid';
import { toast } from 'vue-sonner';

// ─── Events from unified storage ─────────────────────────────
const events = useStorage<AppEvent[]>(storageKeys.events, []);

// Filter to current month + next month, sorted by date
const filteredEvents = computed<AppEvent[]>(() => {
  const startOfCurrentMonth = dayjs().startOf('month');
  const endOfNextMonth = dayjs().add(1, 'month').endOf('month');

  return events.value
    .filter((event) => {
      const eventDate = dayjs(event.date);
      return eventDate.isSameOrAfter(startOfCurrentMonth, 'day') && eventDate.isSameOrBefore(endOfNextMonth, 'day');
    })
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
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

  if (editingEvent.value) {
    events.value = events.value.map((e) => (e.id === savedEvent.id ? savedEvent : e));
  } else {
    events.value = [...events.value, savedEvent];
  }

  isModalOpen.value = false;
};

const deleteEvent = (event: AppEvent) => {
  toast.warning('Delete event?', {
    action: {
      label: 'Delete',
      onClick: () => {
        events.value = events.value.filter((e) => e.id !== event.id);
      },
    },
    duration: 20000,
  });
};
</script>

<template>
  <VCard class="event-list d-flex flex-column">
    <!-- Header — sticky so it stays visible while list scrolls -->
    <VCardTitle class="bg-surface" style="position: sticky; top: 0; z-index: 1000">
      <VToolbar class="bg-transparent" density="compact">
        <VToolbarTitle class="ms-0">Events</VToolbarTitle>

        <VSpacer />

        <div class="d-flex ga-2">
          <VTooltip>
            <template #activator="{ props }">
              <VIconBtn icon="mdi-plus" icon-size="small" rounded="lg" @click="openAddModal" v-bind="props" />
            </template>
            Add event
          </VTooltip>
        </div>
      </VToolbar>
    </VCardTitle>

    <!-- Scrollable content area -->
    <div class="scroll-content">
      <!-- Empty state — mirrors LogList pattern, different icon -->
      <VCardText v-if="filteredEvents.length === 0">
        <div class="d-flex flex-column ga-2 py-4 align-center bg-container rounded text-disabled">
          <VIcon icon="mdi-calendar-blank-outline" class="text-disabled" />
          <div class="text-subtitle-1 text-disabled">No events this month</div>
        </div>
      </VCardText>

      <!-- Event list -->
      <VList v-else lines="two" density="compact">
        <VHover v-for="event in filteredEvents" :key="event.id">
          <template #default="{ isHovering, props: hoverProps }">
            <VListItem
              v-bind="hoverProps"
              :class="{ 'text-disabled': isPastEvent(event.date) }"
              :title="event.title"
              :subtitle="formatEventDate(event)"
            >
              <!-- Avatar: holiday image vs custom icon -->
              <template #prepend>
                <VAvatar size="small" variant="tonal">
                  <VImg v-if="event.type === 'holiday'" :src="holidayImg" alt="Holiday" />
                  <VIcon v-else icon="mdi-account-outline" class="text-disabled" />
                </VAvatar>
              </template>

              <template v-if="event.type === 'custom' || event.description" #append>
                <div class="d-flex ga-1">
                  <!-- Edit / delete — custom events only -->
                  <template v-if="event.type === 'custom' && isHovering">
                    <VIconBtn icon="mdi-pencil-outline" size="small" variant="text" @click="openEditModal(event)" />
                    <VIconBtn icon="mdi-trash-can-outline" size="small" variant="text" @click="deleteEvent(event)" />
                  </template>

                  <!-- Description info -->
                  <VTooltip v-if="event.description" max-width="300">
                    <template #activator="{ props: tooltipProps }">
                      <VIconBtn
                        v-show="isHovering && event.description"
                        v-bind="tooltipProps"
                        icon="mdi-information-outline"
                        size="small"
                        variant="text"
                      />
                    </template>
                    {{ event.description }}
                  </VTooltip>
                </div>
              </template>
            </VListItem>
          </template>
        </VHover>
      </VList>
    </div>

    <!-- Add / Edit Modal -->
    <VDialog v-model="isModalOpen" max-width="400" persistent>
      <EventForm :item="editingEvent" @save-event="onSaveEvent" @cancel-modify-event="onCancelModifyEvent" />
    </VDialog>
  </VCard>
</template>

<style scoped>
/* Card fills remaining space in calendar-column and clips overflow */
.event-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Scrollable content area below the sticky header */
.scroll-content {
  flex: 1;
  overflow-y: auto;
}
</style>
