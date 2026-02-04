<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { nanoid } from 'nanoid';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { storageKeys } from '@/common/storageKeys';
import { formatEventDate } from '@/common/DateHelpers';
import holidayImg from '@/assets/summer-holidays.png';
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
const editingEvent = ref<AppEvent | null>(null); // null = add mode

// Form fields
const formTitle = ref('');
const formDescription = ref('');
const formAllDay = ref(true);
const dateMode = ref<'single' | 'range'>('single');
const formDate = ref(dayjs().format('YYYY-MM-DD'));
const formEndDate = ref<string | null>(null);
const formStartTime = ref('09:00');
const formEndTime = ref('10:00');

// Popover open states
const isDatePickerOpen = ref(false);
const isStartTimeOpen = ref(false);
const isEndTimeOpen = ref(false);

// ─── Computed ────────────────────────────────────────────────

// VDatePicker model: string in single mode, [start, end] array in range mode
const datePickerModel = computed({
  get: () =>
    dateMode.value === 'range' ? [formDate.value, formEndDate.value ?? formDate.value] : formDate.value,
  set: (val) => {
    if (dateMode.value === 'range') {
      const arr = val as string[];
      formDate.value = arr[0];
      formEndDate.value = arr.length > 1 && arr[1] !== arr[0] ? arr[1] : null;
    } else {
      formDate.value = val as string;
      formEndDate.value = null;
    }
  },
});

// Text shown in the date trigger field
const displayDate = computed(() => {
  if (formEndDate.value) {
    return `${dayjs(formDate.value).format('MMM D')} – ${dayjs(formEndDate.value).format('MMM D')}`;
  }
  return dayjs(formDate.value).format('MMM D');
});

// Validation — title required; end time > start time on same day
const titleError = computed(() => (!formTitle.value.trim() ? 'Title is required' : ''));
const timeError = computed(() => {
  if (formAllDay.value || formEndDate.value) return ''; // multi-day or all-day: no time conflict possible
  return formStartTime.value >= formEndTime.value ? 'End time must be after start time' : '';
});
const hasError = computed(() => !!titleError.value || !!timeError.value);

// ─── Watchers ────────────────────────────────────────────────

// Switching back to single date clears the end date
watch(dateMode, (newMode) => {
  if (newMode === 'single') formEndDate.value = null;
});

// ─── Actions ─────────────────────────────────────────────────

const resetForm = () => {
  formTitle.value = '';
  formDescription.value = '';
  formAllDay.value = true;
  dateMode.value = 'single';
  formDate.value = dayjs().format('YYYY-MM-DD');
  formEndDate.value = null;
  formStartTime.value = '09:00';
  formEndTime.value = '10:00';
};

const openAddModal = () => {
  editingEvent.value = null;
  resetForm();
  isModalOpen.value = true;
};

const openEditModal = (event: AppEvent) => {
  editingEvent.value = event;
  formTitle.value = event.title;
  formDescription.value = event.description ?? '';
  formAllDay.value = !event.startTime;
  formDate.value = event.date;

  if (event.endDate && event.endDate !== event.date) {
    dateMode.value = 'range';
    formEndDate.value = event.endDate;
  } else {
    dateMode.value = 'single';
    formEndDate.value = null;
  }

  formStartTime.value = event.startTime ?? '09:00';
  formEndTime.value = event.endTime ?? '10:00';
  isModalOpen.value = true;
};

const saveEvent = () => {
  if (hasError.value) return;

  const event: AppEvent = {
    id: editingEvent.value?.id ?? nanoid(),
    title: formTitle.value.trim(),
    date: formDate.value,
    ...(formEndDate.value ? { endDate: formEndDate.value } : {}),
    type: 'custom',
    // VTimePicker may emit "HH:mm:ss" — slice to "HH:mm"
    ...(formAllDay.value
      ? {}
      : {
          startTime: formStartTime.value.slice(0, 5),
          endTime: formEndTime.value.slice(0, 5),
        }),
    ...(formDescription.value.trim() ? { description: formDescription.value.trim() } : {}),
  };

  if (editingEvent.value) {
    events.value = events.value.map((e) => (e.id === event.id ? event : e));
  } else {
    events.value = [...events.value, event];
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
  <VCard class="event-list">
    <!-- Header -->
    <VCardTitle>
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

    <!-- Empty state — mirrors LogList pattern, different icon -->
    <VCardText v-if="filteredEvents.length === 0">
      <div class="d-flex flex-column ga-2 py-4 align-center bg-container rounded text-disabled">
        <VIcon icon="mdi-calendar-blank-outline" class="text-disabled" />
        <div class="text-subtitle-1 text-disabled">No events this month</div>
      </div>
    </VCardText>

    <!-- Event list -->
    <VList v-else lines="two" density="compact">
      <VListItem
        v-for="event in filteredEvents"
        :key="event.id"
        :class="{ 'text-disabled': isPastEvent(event.date) }"
        :title="event.title"
        :subtitle="formatEventDate(event)"
      >
        <!-- Avatar: holiday image vs custom icon -->
        <template #prepend>
          <VAvatar v-if="event.type === 'holiday'" size="small" variant="tonal">
            <VImg :src="holidayImg" alt="Holiday" />
          </VAvatar>
          <VAvatar v-else size="small" variant="tonal">
            <VIcon icon="mdi-calendar-check-outline" />
          </VAvatar>
        </template>

        <!-- Edit / delete — custom events only -->
        <template v-if="event.type === 'custom'" #append>
          <div class="d-flex ga-1">
            <VIconBtn icon="mdi-pencil-outline" size="small" variant="text" @click="openEditModal(event)" />
            <VIconBtn icon="mdi-trash-can-outline" size="small" variant="text" @click="deleteEvent(event)" />
          </div>
        </template>
      </VListItem>
    </VList>

    <!-- ─── Add / Edit Modal ──────────────────────────────────── -->
    <VDialog v-model="isModalOpen" max-width="400" persistent>
      <VCard rounded="lg">
        <VCardTitle>{{ editingEvent ? 'Edit Event' : 'Add Event' }}</VCardTitle>

        <VCardText class="pb-0">
          <!-- Title (only required field) -->
          <VTextField
            v-model="formTitle"
            label="Title"
            density="compact"
            autofocus
            :error-messages="titleError ? [titleError] : []"
            class="mb-3"
          />

          <!-- All day toggle — default ON -->
          <VSwitch v-model="formAllDay" label="All day" color="primary" density="compact" hide-details class="mb-3" />

          <!-- Date — trigger field opens a popover with single/range toggle + picker -->
          <VMenu v-model="isDatePickerOpen" :close-on-content-click="false">
            <template #activator="{ props }">
              <VTextField
                v-bind="props"
                :model-value="displayDate"
                label="Date"
                prepend-icon="mdi-calendar"
                readonly
                density="compact"
                class="mb-3"
              />
            </template>
            <VSheet rounded="lg" class="pa-2">
              <!-- Single / Range toggle -->
              <VBtnToggle v-model="dateMode" density="compact" rounded="lg" border class="mb-2 d-flex justify-center">
                <VBtn value="single" size="small">Single</VBtn>
                <VBtn value="range" size="small">Range</VBtn>
              </VBtnToggle>

              <!-- Date picker — range prop driven by toggle -->
              <VDatePicker
                :model-value="datePickerModel"
                :range="dateMode === 'range'"
                @update:model-value="datePickerModel = $event"
              />
            </VSheet>
          </VMenu>

          <!-- Time pickers — visible only when All Day is OFF -->
          <div v-if="!formAllDay" class="d-flex ga-2 mb-3">
            <VMenu v-model="isStartTimeOpen" :close-on-content-click="false">
              <template #activator="{ props }">
                <VTextField
                  v-bind="props"
                  :model-value="formStartTime"
                  label="Start"
                  prepend-icon="mdi-clock-start"
                  readonly
                  density="compact"
                  flex-1
                />
              </template>
              <VTimePicker v-model="formStartTime" format="24hr" @update:model-value="isStartTimeOpen = false" />
            </VMenu>

            <VMenu v-model="isEndTimeOpen" :close-on-content-click="false">
              <template #activator="{ props }">
                <VTextField
                  v-bind="props"
                  :model-value="formEndTime"
                  label="End"
                  prepend-icon="mdi-clock-end"
                  readonly
                  density="compact"
                  flex-1
                  :error-messages="timeError ? [timeError] : []"
                />
              </template>
              <VTimePicker v-model="formEndTime" format="24hr" @update:model-value="isEndTimeOpen = false" />
            </VMenu>
          </div>

          <!-- Description (optional) -->
          <VTextField v-model="formDescription" label="Description" multiline rows="2" density="compact" />
        </VCardText>

        <!-- Modal actions -->
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="isModalOpen = false">Cancel</VBtn>
          <VBtn color="primary" variant="tonal" :disabled="hasError" @click="saveEvent">
            {{ editingEvent ? 'Save' : 'Add' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>

<style scoped></style>
