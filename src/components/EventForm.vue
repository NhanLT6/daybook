<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AppEvent, RepeatFreq, RepeatRule } from '@/interfaces/Event';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

import dayjs from 'dayjs';

import { formatEventDate } from '@/common/DateHelpers';
import {
  describeRepeat,
  eventDays,
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

// The date picker emits Date objects, and older events may hold one too: keep every date a
// YYYY-MM-DD string so saved events (and the repeat math, which compares strings) never see a Date
const toDay = (d: unknown) => dayjs(d as Date | string).format('YYYY-MM-DD');

// ─── Form (vee-validate) ──────────────────────────────────────
const validationSchema = object({
  title: string().required('Required'),
});

const { resetForm, handleSubmit } = useForm({
  initialValues: {
    title: item?.title ?? '',
    description: item?.description ?? '',
    allDay: item ? !item.startTime : true,
    date: toDay(item?.date),
    endDate: item?.endDate ? toDay(item.endDate) : null,
    dates: item?.dates && item.dates.length > 1 ? item.dates.map(toDay) : null,
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
const datesField = useField<string[] | null>('dates');
const startTimeField = useField<string>('startTime');
const endTimeField = useField<string>('endTime');

// ─── Date mode (single / multiple / range) ───────────────────
// Multiple = separate days (Mon, Tue, Fri); range = one continuous span. One occurrence is either.
const dateMode = ref<'single' | 'multiple' | 'range'>(
  item?.dates && item.dates.length > 1 ? 'multiple' : item?.endDate && item.endDate !== item.date ? 'range' : 'single',
);

// Each mode keeps only its own shape: a range has an end date, multiple has a day list
watch(dateMode, (mode) => {
  if (mode !== 'range') endDateField.setValue(null);
  if (mode !== 'multiple') datesField.setValue(null);
});

// Current date selection in the shape the repeat helpers take
const shape = computed(() => ({
  date: dateField.value.value,
  endDate: endDateField.value.value ?? undefined,
  dates: datesField.value.value ?? undefined,
}));
const pickedDays = computed(() => eventDays(shape.value));
const isMultiple = computed(() => pickedDays.value.length > 1);

// ─── Repeat ───────────────────────────────────────────────────
// Kept outside vee-validate: it's a nested object edited through several controls, and the
// dialog remounts this form on every open, so plain refs seeded from `item` are enough.
const repeatRule = ref<RepeatRule | null>(item?.repeat ? { ...item.repeat } : null);
const isCustomRepeat = ref(false);
const skipDates = ref<string[]>([...(item?.repeat?.skip ?? [])].sort());

const presets = computed(() => repeatPresets(shape.value));

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
    // Start Custom from a rule that fits the dates (a 12-day sprint can't repeat weekly)
    else if (value === 'custom')
      repeatRule.value ??= { ...(presets.value.find((p) => p.value.freq === 'week')?.value ?? { freq: 'week', interval: 1 }) };
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
    // Several picked days repeat by day of month; "nth weekday" only describes a single start day
    ...(rule.freq === 'month' && rule.monthlyBy && rule.monthlyBy !== 'dayOfMonth' && !isMultiple.value
      ? { monthlyBy: rule.monthlyBy }
      : {}),
    ...(rule.end ? { end: rule.end } : {}),
    ...(skipDates.value.length ? { skip: skipDates.value } : {}),
  };
});

const repeatSummary = computed(() =>
  normalizedRule.value ? describeRepeat(pickedDays.value, normalizedRule.value) : '',
);

const repeatError = computed(() => {
  const rule = normalizedRule.value;
  if (!rule) return '';
  if (rule.end && 'until' in rule.end && rule.end.until < dateField.value.value) return 'End date is before the start';
  if (rule.end && 'count' in rule.end && !(rule.end.count >= 1)) return 'Must repeat at least once';
  return validateRepeat(shape.value, rule);
});

const unskipDate = (date: string) => {
  skipDates.value = skipDates.value.filter((d) => d !== date);
};

// ─── Computed ─────────────────────────────────────────────────

// VDatePicker model: a date in single mode, the picked days in multiple mode, [start, end] in range mode
const datePickerModel = computed({
  get: () => {
    if (dateMode.value === 'multiple') return pickedDays.value;
    if (dateMode.value === 'range') return [dateField.value.value, endDateField.value.value ?? dateField.value.value];
    return dateField.value.value;
  },
  set: (val) => {
    if (dateMode.value === 'multiple') {
      const days = [...new Set((val as unknown[]).map(toDay))].sort();
      if (!days.length) return; // keep at least one day picked

      dateField.setValue(days[0]);
      datesField.setValue(days.length > 1 ? days : null);
    } else if (dateMode.value === 'range') {
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

// Text shown in the date trigger field: "Oct 5", "Oct 5, 6, 9" or "Oct 5 – Oct 16"
const displayDate = computed(() => formatEventDate({ id: '', title: '', type: 'custom', ...shape.value }));

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
    ...(values.dates && values.dates.length > 1 ? { dates: values.dates } : {}),
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
          <!-- Single / Multiple / Range toggle -->
          <VBtnToggle v-model="dateMode" variant="tonal" density="compact" rounded="lg" class="d-flex justify-center">
            <VBtn value="single" size="small">Single</VBtn>
            <VBtn value="multiple" size="small">Multiple</VBtn>
            <VBtn value="range" size="small">Range</VBtn>
          </VBtnToggle>

          <!-- Date picker — range prop driven by toggle -->
          <VDatePicker
            :model-value="datePickerModel"
            :multiple="dateMode === 'range' ? 'range' : dateMode === 'multiple'"
            hide-title
            class="mx-auto"
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
          <VNumberInput
            :model-value="repeatRule.interval"
            :min="1"
            aria-label="Repeat interval"
            density="compact"
            hide-details
            class="repeat-interval"
            @update:model-value="updateRule({ interval: $event })"
          />
          <VSelect
            :model-value="repeatRule.freq"
            :items="freqItems"
            density="compact"
            hide-details
            @update:model-value="updateRule({ freq: $event })"
          />
        </div>

        <!-- Monthly: same day number vs same weekday position (a single start day only) -->
        <VSelect
          v-if="repeatRule.freq === 'month' && !isMultiple"
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
          <VNumberInput
            v-if="repeatRule.end && 'count' in repeatRule.end"
            :model-value="repeatRule.end.count"
            :min="1"
            label="Occurrences"
            density="compact"
            hide-details
            @update:model-value="updateRule({ end: { count: $event } })"
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
  max-width: 128px;
  flex: 0 0 auto;
}
</style>
