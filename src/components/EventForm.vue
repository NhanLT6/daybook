<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AppEvent } from '@/interfaces/Event';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

import dayjs from 'dayjs';

const { item } = defineProps<{
  item?: AppEvent | null;
}>();

const emit = defineEmits<{
  saveEvent: [event: AppEvent];
  cancelModifyEvent: [];
}>();

// ─── Popover open states ──────────────────────────────────────
const isDatePickerOpen = ref(false);
const isStartTimeOpen = ref(false);
const isEndTimeOpen = ref(false);

// ─── Form (vee-validate) ──────────────────────────────────────
const validationSchema = object({
  title: string().required('Required'),
});

const { resetForm, handleSubmit } = useForm({
  initialValues: {
    title: item?.title ?? '',
    description: item?.description ?? '',
    allDay: item ? !item.startTime : true,
    date: item?.date ?? dayjs().format('YYYY-MM-DD'),
    endDate: item?.endDate ?? null,
    startTime: item?.startTime ?? '09:00',
    endTime: item?.endTime ?? '10:00',
  },
  validationSchema,
  validateOnMount: false,
});

const titleField = useField<string>('title');
const descriptionField = useField<string>('description');
const allDayField = useField<boolean>('allDay');
const dateField = useField<string>('date');
const endDateField = useField<string | null>('endDate');
const startTimeField = useField<string>('startTime');
const endTimeField = useField<string>('endTime');

// ─── Date mode (single / range) ──────────────────────────────
const dateMode = ref<'single' | 'range'>(item?.endDate && item.endDate !== item.date ? 'range' : 'single');

// Switching back to single clears end date
watch(dateMode, (mode) => {
  if (mode === 'single') endDateField.setValue(null);
});

// ─── Computed ─────────────────────────────────────────────────

// VDatePicker model: string in single mode, [start, end] in range mode
const datePickerModel = computed({
  get: () =>
    dateMode.value === 'range'
      ? [dateField.value.value, endDateField.value.value ?? dateField.value.value]
      : dateField.value.value,
  set: (val) => {
    if (dateMode.value === 'range') {
      const arr = val as string[];
      const from = arr[0];
      const to = arr.length > 1 ? (arr.at(-1) ?? null) : arr[0];

      dateField.setValue(from);
      endDateField.setValue(arr.length > 1 && to !== from ? to : null);
    } else {
      dateField.setValue(val as string);
      endDateField.setValue(null);
    }
  },
});

// Text shown in the date trigger field
const displayDate = computed(() => {
  if (endDateField.value.value) {
    return `${dayjs(dateField.value.value).format('MMM D')} – ${dayjs(endDateField.value.value).format('MMM D')}`;
  }
  return dayjs(dateField.value.value).format('MMM D');
});

// Title shown in the date picker
const datePickerTitle = computed(() => displayDate.value);

// Validation — end time must be after start time on same-day, non-all-day events
const timeError = computed(() => {
  if (allDayField.value.value || endDateField.value.value) return '';
  return startTimeField.value.value >= endTimeField.value.value ? 'End time must be after start time' : '';
});

const hasError = computed(() => !!titleField.errors.value.length || !!timeError.value);

// ─── Actions ──────────────────────────────────────────────────

const onSaveEvent = handleSubmit((values) => {
  if (hasError.value) return;

  const event: AppEvent = {
    id: item?.id ?? '', // parent assigns ID for new events
    title: values.title.trim(),
    date: values.date,
    ...(values.endDate ? { endDate: values.endDate } : {}),
    type: 'custom',
    // VTimePicker may emit "HH:mm:ss" — slice to "HH:mm"
    ...(values.allDay
      ? {}
      : {
          startTime: values.startTime.slice(0, 5),
          endTime: values.endTime.slice(0, 5),
        }),
    ...(values.description?.trim() ? { description: values.description.trim() } : {}),
  };

  emit('saveEvent', event);
  resetForm();
});

const onCancelModifyEvent = () => {
  resetForm();
  emit('cancelModifyEvent');
};
</script>

<template>
  <VCard rounded="lg">
    <VCardTitle>{{ item ? 'Edit Event' : 'Add Event' }}</VCardTitle>

    <VCardText>
      <!-- Title (only required field) -->
      <VTextField v-model="titleField.value.value" label="Title" autofocus :error-messages="titleField.errors.value" />

      <!-- All day toggle — default ON -->
      <VSwitch
        v-model="allDayField.value.value"
        label="All day"
        color="primary"
        density="compact"
        hide-details
        class="mb-3"
      />

      <!-- Date — trigger field opens a popover with single/range toggle + picker -->
      <VMenu v-model="isDatePickerOpen" :close-on-content-click="false">
        <template #activator="{ props }">
          <VTextField
            v-bind="props"
            :model-value="displayDate"
            label="Date"
            append-inner-icon="mdi-calendar"
            readonly
            class="mb-3"
          />
        </template>

        <VSheet rounded="lg" class="pa-2">
          <!-- Single / Range toggle -->
          <VBtnToggle v-model="dateMode" variant="tonal" density="compact" rounded="lg" class="d-flex justify-center">
            <VBtn value="single" size="small">Single</VBtn>
            <VBtn value="range" size="small">Range</VBtn>
          </VBtnToggle>

          <!-- Date picker — range prop driven by toggle -->
          <VDatePicker
            :model-value="datePickerModel"
            :multiple="dateMode === 'range' ? 'range' : false"
            hide-title
            @update:model-value="datePickerModel = $event"
          >
            <!-- Replace "2 selected" with actual date range, using Vuetify's transition -->
            <template #header>
              <VFadeTransition hide-on-leave>
                <div :key="datePickerTitle" class="text-center pa-4">
                  <div class="text-h5">{{ datePickerTitle }}</div>
                </div>
              </VFadeTransition>
            </template>
          </VDatePicker>
        </VSheet>
      </VMenu>

      <!-- Time pickers — visible only when All Day is OFF -->
      <div v-if="!allDayField.value.value" class="d-flex ga-2 mb-3">
        <VMenu v-model="isStartTimeOpen" :close-on-content-click="false">
          <template #activator="{ props }">
            <VTextField
              v-bind="props"
              :model-value="startTimeField.value.value"
              label="Start"
              prepend-icon="mdi-clock-start"
              readonly
              density="compact"
              flex-1
            />
          </template>
          <VTimePicker
            v-model="startTimeField.value.value"
            format="24hr"
            @update:model-value="isStartTimeOpen = false"
          />
        </VMenu>

        <VMenu v-model="isEndTimeOpen" :close-on-content-click="false">
          <template #activator="{ props }">
            <VTextField
              v-bind="props"
              :model-value="endTimeField.value.value"
              label="End"
              prepend-icon="mdi-clock-end"
              readonly
              density="compact"
              flex-1
              :error-messages="timeError ? [timeError] : []"
            />
          </template>
          <VTimePicker v-model="endTimeField.value.value" format="24hr" @update:model-value="isEndTimeOpen = false" />
        </VMenu>
      </div>

      <!-- Description (optional) -->
      <VTextField v-model="descriptionField.value.value" label="Description" multiline rows="2" />
    </VCardText>

    <!-- Modal actions -->
    <VCardActions>
      <VSpacer />

      <VBtn variant="text" @click="onCancelModifyEvent">Cancel</VBtn>

      <VBtn color="primary" variant="tonal" :disabled="hasError" @click="onSaveEvent">
        {{ item ? 'Save' : 'Add' }}
      </VBtn>
    </VCardActions>
  </VCard>
</template>

<style scoped></style>
