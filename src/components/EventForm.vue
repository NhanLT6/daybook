<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AppEvent, RepeatFreq, RepeatRule } from '@/interfaces/Event';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

import dayjs from 'dayjs';

import {
  describeRepeat,
  isLastWeekdayOfMonth,
  isSameRule,
  nthWeekdayOfMonth,
  repeatPresets,
  validateRepeat,
} from '@/common/eventRecurrence';

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
    // Older events may hold a Date here (see datePickerModel) — normalize to YYYY-MM-DD on open
    date: dayjs(item?.date).format('YYYY-MM-DD'),
    endDate: item?.endDate ? dayjs(item.endDate).format('YYYY-MM-DD') : null,
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

// ─── Repeat ───────────────────────────────────────────────────
// Kept outside vee-validate: it's a nested object edited through several controls, and the
// dialog remounts this form on every open, so plain refs seeded from `item` are enough.
const repeatRule = ref<RepeatRule | null>(item?.repeat ? { ...item.repeat } : null);
const isCustomRepeat = ref(false);
const skipDates = ref<string[]>([...(item?.repeat?.skip ?? [])].sort());

const presets = computed(() => repeatPresets(dateField.value.value));

// Dropdown value: 'none' | 'preset-N' | 'custom'. A saved rule that matches no preset opens as custom.
const repeatSelect = computed({
  get: () => {
    if (!repeatRule.value) return 'none';
    if (isCustomRepeat.value) return 'custom';
    const index = presets.value.findIndex((p) => isSameRule(p.value, repeatRule.value!));
    return index >= 0 ? `preset-${index}` : 'custom';
  },
  set: (value: string) => {
    isCustomRepeat.value = value === 'custom';
    if (value === 'none') repeatRule.value = null;
    else if (value === 'custom') repeatRule.value ??= { freq: 'week', interval: 1 };
    else repeatRule.value = { ...presets.value[Number(value.replace('preset-', ''))].value };
  },
});

const repeatItems = computed(() => [
  { title: 'Does not repeat', value: 'none' },
  ...presets.value.map((p, i) => ({ title: p.title, value: `preset-${i}` })),
  { title: 'Custom…', value: 'custom' },
]);

// Custom panel is shown for custom picks and for saved rules no preset describes
const showCustomPanel = computed(() => repeatSelect.value === 'custom');

const freqItems = computed(() => {
  const plural = (repeatRule.value?.interval ?? 1) > 1;
  return (['day', 'week', 'month', 'year'] as RepeatFreq[]).map((f) => ({ title: plural ? `${f}s` : f, value: f }));
});

// Monday-first weekday chips; values follow dayjs().day() (0 = Sunday)
const weekdayChips = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: dayjs().day(d).format('dd') }));

const isRange = computed(() => !!endDateField.value.value);

// Weekly: an empty selection means "the start date's weekday", so show that chip as selected
const selectedWeekdays = computed({
  get: () => (repeatRule.value?.weekdays?.length ? repeatRule.value.weekdays : [dayjs(dateField.value.value).day()]),
  set: (days: number[]) => {
    if (repeatRule.value) repeatRule.value = { ...repeatRule.value, weekdays: days.length ? days : undefined };
  },
});

const monthlyItems = computed(() => {
  const date = dateField.value.value;
  const weekday = dayjs(date).format('dddd');
  const ordinal = ['first', 'second', 'third', 'fourth', 'fifth'][nthWeekdayOfMonth(date) - 1];
  return [
    { title: `Day ${dayjs(date).date()}`, value: 'dayOfMonth' },
    { title: `The ${ordinal} ${weekday}`, value: 'nthWeekday' },
    ...(isLastWeekdayOfMonth(date) ? [{ title: `The last ${weekday}`, value: 'lastWeekday' }] : []),
  ];
});

const endMode = computed({
  get: () => (!repeatRule.value?.end ? 'never' : 'until' in repeatRule.value.end ? 'until' : 'count'),
  set: (mode: 'never' | 'until' | 'count') => {
    if (!repeatRule.value) return;
    const end =
      mode === 'until'
        ? { until: dayjs(dateField.value.value).add(3, 'month').format('YYYY-MM-DD') }
        : mode === 'count'
          ? { count: 10 }
          : undefined;
    repeatRule.value = { ...repeatRule.value, end };
  },
});

const updateRule = (patch: Partial<RepeatRule>) => {
  if (repeatRule.value) repeatRule.value = { ...repeatRule.value, ...patch };
};

// Rule as it will be saved: drops fields that don't apply to the chosen frequency / date mode
const normalizedRule = computed<RepeatRule | null>(() => {
  const rule = repeatRule.value;
  if (!rule) return null;
  return {
    freq: rule.freq,
    interval: Math.max(1, Math.floor(Number(rule.interval) || 1)),
    // Ranges repeat on their start weekday; a multi-weekday range would overlap itself
    ...(rule.freq === 'week' && rule.weekdays?.length && !isRange.value ? { weekdays: [...rule.weekdays].sort((a, b) => a - b) } : {}),
    ...(rule.freq === 'month' && rule.monthlyBy && rule.monthlyBy !== 'dayOfMonth' ? { monthlyBy: rule.monthlyBy } : {}),
    ...(rule.end ? { end: rule.end } : {}),
    ...(skipDates.value.length ? { skip: skipDates.value } : {}),
  };
});

const repeatSummary = computed(() =>
  normalizedRule.value ? describeRepeat(dateField.value.value, normalizedRule.value) : '',
);

const repeatError = computed(() => {
  const rule = normalizedRule.value;
  if (!rule) return '';
  if (rule.end && 'until' in rule.end && rule.end.until < dateField.value.value) return 'End date is before the start';
  if (rule.end && 'count' in rule.end && !(rule.end.count >= 1)) return 'Must repeat at least once';
  return validateRepeat({ date: dateField.value.value, endDate: endDateField.value.value ?? undefined }, rule);
});

const unskipDate = (date: string) => {
  skipDates.value = skipDates.value.filter((d) => d !== date);
};

// ─── Computed ─────────────────────────────────────────────────

// VDatePicker model: string in single mode, [start, end] in range mode.
// The picker emits Date objects; store them as YYYY-MM-DD so saved events (and the repeat math,
// which compares date strings) never see a Date.
const toDay = (d: unknown) => dayjs(d as Date | string).format('YYYY-MM-DD');

const datePickerModel = computed({
  get: () =>
    dateMode.value === 'range'
      ? [dateField.value.value, endDateField.value.value ?? dateField.value.value]
      : dateField.value.value,
  set: (val) => {
    if (dateMode.value === 'range') {
      const arr = (val as unknown[]).map(toDay);
      const from = arr[0];
      const to = arr.length > 1 ? (arr.at(-1) ?? null) : arr[0];

      dateField.setValue(from);
      endDateField.setValue(arr.length > 1 && to !== from ? to : null);
    } else {
      dateField.setValue(toDay(val));
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

const hasError = computed(() => !!titleField.errors.value.length || !!timeError.value || !!repeatError.value);

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
    ...(normalizedRule.value ? { repeat: normalizedRule.value } : {}),
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

      <!-- Repeat — presets derived from the start date, or a custom rule -->
      <VSelect
        v-model="repeatSelect"
        :items="repeatItems"
        label="Repeat"
        :error-messages="!showCustomPanel && repeatError ? [repeatError] : []"
        class="mb-3"
      >
        <!-- Show the saved rule's own wording when it came from the custom panel -->
        <template v-if="showCustomPanel" #selection>{{ repeatSummary }}</template>
      </VSelect>

      <!-- Custom repeat panel -->
      <VSheet v-if="showCustomPanel && repeatRule" rounded="lg" border class="pa-3 mb-3 d-flex flex-column ga-3">
        <!-- Every N units -->
        <div class="d-flex align-center ga-2">
          <span class="text-body-2">Every</span>
          <VTextField
            :model-value="repeatRule.interval"
            type="number"
            min="1"
            density="compact"
            hide-details
            class="repeat-interval"
            @update:model-value="updateRule({ interval: Number($event) })"
          />
          <VSelect
            :model-value="repeatRule.freq"
            :items="freqItems"
            density="compact"
            hide-details
            @update:model-value="updateRule({ freq: $event })"
          />
        </div>

        <!-- Weekly: which weekdays (ranges always repeat on their start weekday) -->
        <VChipGroup
          v-if="repeatRule.freq === 'week' && !isRange"
          v-model="selectedWeekdays"
          multiple
          column
          color="primary"
        >
          <VChip v-for="d in weekdayChips" :key="d.value" :value="d.value" size="small" variant="tonal">
            {{ d.label }}
          </VChip>
        </VChipGroup>

        <!-- Monthly: same day number vs same weekday position -->
        <VSelect
          v-if="repeatRule.freq === 'month'"
          :model-value="repeatRule.monthlyBy ?? 'dayOfMonth'"
          :items="monthlyItems"
          label="On"
          density="compact"
          hide-details
          @update:model-value="updateRule({ monthlyBy: $event })"
        />

        <!-- Ends: never / on a date / after N occurrences -->
        <div class="d-flex flex-column ga-2">
          <div class="d-flex align-center ga-2">
            <span class="text-body-2">Ends</span>
            <VBtnToggle
              v-model="endMode"
              mandatory
              variant="tonal"
              density="compact"
              rounded="lg"
                          >
              <VBtn value="never" size="small">Never</VBtn>
              <VBtn value="until" size="small">On date</VBtn>
              <VBtn value="count" size="small">After</VBtn>
            </VBtnToggle>
          </div>

          <VTextField
            v-if="repeatRule.end && 'until' in repeatRule.end"
            :model-value="repeatRule.end.until"
            type="date"
            label="Last date"
            density="compact"
            hide-details
            @update:model-value="updateRule({ end: { until: $event } })"
          />
          <VTextField
            v-if="repeatRule.end && 'count' in repeatRule.end"
            :model-value="repeatRule.end.count"
            type="number"
            min="1"
            label="Occurrences"
            density="compact"
            hide-details
            @update:model-value="updateRule({ end: { count: Number($event) } })"
          />
        </div>

        <!-- Validation — the summary itself already shows in the Repeat field -->
        <div v-if="repeatError" class="text-caption text-error">{{ repeatError }}</div>
      </VSheet>

      <!-- Skipped dates — remove a chip to bring that date back -->
      <div v-if="repeatRule && skipDates.length" class="mb-3">
        <div class="text-caption text-medium-emphasis mb-1">Skipped dates</div>
        <div class="d-flex flex-wrap ga-1">
          <VChip v-for="d in skipDates" :key="d" size="small" variant="tonal" closable @click:close="unskipDate(d)">
            {{ dayjs(d).format('MMM D, YYYY') }}
          </VChip>
        </div>
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

<style scoped>
.repeat-interval {
  max-width: 72px;
  flex: 0 0 auto;
}
</style>
