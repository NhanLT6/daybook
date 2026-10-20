<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AppEvent, MonthlyDayKind, MonthlyNth, RepeatFreq, RepeatRule } from '@/interfaces/Event';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

import dayjs from 'dayjs';

import { formatEventDate } from '@/common/DateHelpers';
import {
  atOccurrence,
  backToBackRule,
  describeDayKind,
  describeNth,
  describeRepeat,
  eventDays,
  getNextOccurrence,
  getOccurrences,
  isSameRule,
  normalizeRule,
  nthWeekdayOfMonth,
  repeatPresets,
  validateRepeat,
  type RepeatPreset,
} from '@/common/eventRecurrence';
import { useWorkCalendar } from '@/composables/useWorkCalendar';
import { useSettingsStore } from '@/stores/settings';

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
// Legacy rules are converted on open, so the form (and what it saves) only deals with the current shape
const repeatRule = ref<RepeatRule | null>(item?.repeat ? normalizeRule(item.repeat, toDay(item.date)) : null);
const isCustomRepeat = ref(false);
const skipDates = ref<string[]>([...(item?.repeat?.skip ?? [])].sort());

// Settings: weekend days decide whether a back-to-back range restarts on the same weekday (see
// backToBackRule); the first day of week lines the date picker up with the calendar
const settingsStore = useSettingsStore();
const presets = computed(() => repeatPresets(shape.value, settingsStore.weekendDays));
const backToBack = computed(() => backToBackRule(shape.value, settingsStore.weekendDays));

// Weekend days + holidays, for work-day positions and "on a weekend or holiday"
const workCalendar = useWorkCalendar();

// A monthly position ("the last work day", "the second Tuesday") doesn't depend on the picked day: start the
// series at its first occurrence on or after that day, so the saved date stays the first occurrence like
// every other rule's. Other rules keep the date — they take their day from it.
const seriesStart = (date: string, endDate: string | null, rule: RepeatRule | null) => {
  if (rule?.freq !== 'month' || !rule.monthlyOn) return date;
  const series: AppEvent = {
    id: '',
    title: '',
    type: 'custom',
    date,
    ...(endDate ? { endDate } : {}),
    repeat: { ...rule, skip: undefined },
  };
  return getNextOccurrence(series, date, workCalendar.value) ?? date;
};

// Same start move for an end date, so a range keeps its length
const shiftDay = (day: string | null, from: string, to: string) =>
  day ? dayjs(day).add(dayjs(to).diff(dayjs(from), 'day'), 'day').format('YYYY-MM-DD') : null;

const applyRule = (rule: RepeatRule | null) => {
  repeatRule.value = rule;
  const date = dateField.value.value;
  const start = seriesStart(date, endDateField.value.value, rule);
  if (start === date) return;
  endDateField.setValue(shiftDay(endDateField.value.value, date, start));
  dateField.setValue(start);
};

// "When it ends" is stored as a plain rule (every 2 weeks, every N days); this flag only makes the form
// keep it in step with the range while the dates are edited. A saved event matching it reopens with it on.
// Not-a-range moments (the first click of a new range) keep the last rule and the flag, so the next
// complete range is followed again.
const followsRangeEnd = ref(!!item?.repeat && !!backToBack.value && isSameRule(item.repeat, backToBack.value));
watch(backToBack, (rule) => {
  if (followsRangeEnd.value && rule) repeatRule.value = { ...rule };
});

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
    followsRangeEnd.value = false;
    if (value === 'none') repeatRule.value = null;
    // Start Custom from a rule that fits the dates (a 12-day sprint can't repeat weekly)
    else if (value === 'custom')
      repeatRule.value ??= { ...(presets.value.find((p) => p.value.freq === 'week')?.value ?? { freq: 'week', interval: 1 }) };
    else {
      const preset = presets.value[Number(value.replace('preset-', ''))];
      followsRangeEnd.value = !!preset.backToBack;
      applyRule({ ...preset.value });
    }
  },
});

// Presets grouped under subheaders (VSelect renders `type: 'subheader' | 'divider'` items as such).
// repeatPresets already lists them in this group order.
const presetGroup = (preset: RepeatPreset) => {
  if (preset.backToBack) return 'Back to back';
  if (preset.value.freq === 'month') return 'Monthly';
  if (preset.value.freq === 'year') return 'Yearly';
  return 'Daily & weekly';
};

interface RepeatItem {
  title?: string;
  value?: string;
  type?: 'subheader' | 'divider';
}

const repeatItems = computed(() => {
  const items: RepeatItem[] = [{ title: 'Does not repeat', value: 'none' }];
  let group = '';
  presets.value.forEach((preset, i) => {
    if (presetGroup(preset) !== group) {
      group = presetGroup(preset);
      items.push({ type: 'subheader', title: group });
    }
    items.push({ title: preset.title, value: `preset-${i}` });
  });
  items.push({ type: 'divider' }, { title: 'Custom…', value: 'custom' });
  return items;
});

// Custom panel is shown for custom picks and for saved rules no preset describes
const showCustomPanel = computed(() => repeatSelect.value === 'custom');

const freqItems = computed(() => {
  const plural = (repeatRule.value?.interval ?? 1) > 1;
  return (['day', 'week', 'month', 'year'] as RepeatFreq[]).map((f) => ({ title: plural ? `${f}s` : f, value: f }));
});

// Monthly: on the start date's day number, or on "the <nth> <day>" of each month whatever the start date is
const monthlyMode = computed({
  get: () => (repeatRule.value?.monthlyOn ? 'position' : 'dayOfMonth'),
  set: (mode: 'dayOfMonth' | 'position') => {
    const date = dateField.value.value;
    const nth = nthWeekdayOfMonth(date);
    // Start from the position the picked day already has (a 5th weekday is the last one)
    const fromDate = { nth: (nth > 4 ? -1 : nth) as MonthlyNth, day: dayjs(date).day() as MonthlyDayKind };
    updateRule({ monthlyOn: mode === 'position' ? (repeatRule.value?.monthlyOn ?? fromDate) : undefined });
  },
});

const nthItems = ([1, 2, 3, 4, -1] as MonthlyNth[]).map((nth) => ({ title: describeNth(nth), value: nth }));

// Monday-first weekdays after the two generic kinds
const dayKindItems = (['day', 'workday', 1, 2, 3, 4, 5, 6, 0] as MonthlyDayKind[]).map((day) => ({
  title: describeDayKind(day),
  value: day,
}));

const updatePosition = (patch: Partial<NonNullable<RepeatRule['monthlyOn']>>) => {
  const on = repeatRule.value?.monthlyOn;
  if (on) updateRule({ monthlyOn: { ...on, ...patch } });
};

// "On a weekend or holiday" fits a single day whose rule can land on one — a work-day position never does
const canAdjustNonWorkday = computed(
  () =>
    !isMultiple.value &&
    !endDateField.value.value &&
    !(repeatRule.value?.freq === 'month' && repeatRule.value.monthlyOn?.day === 'workday'),
);

const nonWorkdayItems = [
  { title: 'Keep it', value: 'keep' },
  { title: 'Skip it', value: 'skip' },
  { title: 'Move to the work day before', value: 'before' },
  { title: 'Move to the work day after', value: 'after' },
];

const nonWorkdayMode = computed({
  get: () => repeatRule.value?.onNonWorkday ?? 'keep',
  set: (mode: string) =>
    updateRule({ onNonWorkday: mode === 'keep' ? undefined : (mode as RepeatRule['onNonWorkday']) }),
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
  if (repeatRule.value) applyRule({ ...repeatRule.value, ...patch });
};

// Rule as it will be saved: drops fields that don't apply to the chosen frequency / date mode
const normalizedRule = computed<RepeatRule | null>(() => {
  const rule = repeatRule.value;
  if (!rule) return null;
  return {
    freq: rule.freq,
    interval: Math.max(1, Math.floor(Number(rule.interval) || 1)),
    // Several picked days repeat by day of month; a position only describes a single start day
    ...(rule.freq === 'month' && rule.monthlyOn && !isMultiple.value ? { monthlyOn: rule.monthlyOn } : {}),
    ...(rule.onNonWorkday && canAdjustNonWorkday.value ? { onNonWorkday: rule.onNonWorkday } : {}),
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

// The next few dates, shown in a preview under the Repeat field so a rule can be checked at a glance —
// work-day rules move around weekends and holidays, which the summary sentence can't show
const upcomingDates = computed<string[]>(() => {
  const rule = normalizedRule.value;
  if (!rule || repeatError.value) return [];
  const series: AppEvent = { id: '', title: '', type: 'custom', ...shape.value, repeat: rule };
  const today = dayjs().format('YYYY-MM-DD');
  const from = dateField.value.value > today ? dateField.value.value : today;
  const to = dayjs(from).add(2, 'year').format('YYYY-MM-DD');
  return getOccurrences(series, from, to, workCalendar.value)
    .slice(0, 3)
    .map((d) =>
      shape.value.endDate || isMultiple.value
        ? formatEventDate({ ...atOccurrence(series, d), startTime: undefined, endTime: undefined })
        : dayjs(d).format('ddd, MMM D'),
    );
});

const unskipDate = (date: string) => {
  skipDates.value = skipDates.value.filter((d) => d !== date);
};

// ─── Computed ─────────────────────────────────────────────────

// VDatePicker model: a date in single mode, the picked days in multiple mode, every day from start to end in
// range mode — the shape Vuetify itself emits for a range, which it needs to highlight the days in between
const datePickerModel = computed({
  get: () => {
    if (dateMode.value === 'multiple') return pickedDays.value;
    if (dateMode.value === 'range') {
      // No end yet: [date, date], a complete one-day range, so the next click starts a new range. A single
      // entry would read as half-picked and the next click would end a range at the old date.
      if (!endDateField.value.value) return [dateField.value.value, dateField.value.value];
      const start = dayjs(dateField.value.value);
      const length = dayjs(endDateField.value.value).diff(start, 'day') + 1;
      return Array.from({ length }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'));
    }
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

// Text shown in the date trigger field: "Tue, Oct 20, 2026", "Oct 5, 6, 9" or "Mon, Nov 2 → Wed, Nov 4, 2026 · 3 days"
const displayDate = computed(() => {
  const { date, endDate } = shape.value;
  if (isMultiple.value) return formatEventDate({ id: '', title: '', type: 'custom', ...shape.value });
  if (!endDate || endDate === date) return dayjs(date).format('ddd, MMM D, YYYY');
  const days = dayjs(endDate).diff(dayjs(date), 'day') + 1;
  return `${dayjs(date).format('ddd, MMM D')} → ${dayjs(endDate).format('ddd, MMM D, YYYY')} · ${days} days`;
});

const dateLabel = computed(() => ({ single: 'Date', multiple: 'Days', range: 'Dates' })[dateMode.value]);

// Title shown in the date picker: the short form, which fits its header
const datePickerTitle = computed(() => formatEventDate({ id: '', title: '', type: 'custom', ...shape.value }));

// Validation — end time must be after start time on same-day, non-all-day events
const timeError = computed(() => {
  if (allDayField.value.value || endDateField.value.value) return '';
  return startTimeField.value.value >= endTimeField.value.value ? 'End time must be after start time' : '';
});

const hasError = computed(() => !!titleField.errors.value.length || !!timeError.value || !!repeatError.value);

// ─── Actions ──────────────────────────────────────────────────

const onSaveEvent = handleSubmit((values) => {
  if (hasError.value) return;

  // The dates may have changed after a monthly position was picked: start at its first occurrence again
  const start = seriesStart(values.date, values.endDate, normalizedRule.value);

  const event: AppEvent = {
    id: item?.id ?? '', // parent assigns ID for new events
    title: values.title.trim(),
    date: start,
    ...(values.endDate ? { endDate: shiftDay(values.endDate, values.date, start) ?? values.endDate } : {}),
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
  <VCard rounded="lg" class="event-form">
    <VCardTitle>{{ item ? 'Edit Event' : 'Add Event' }}</VCardTitle>

    <VCardText class="d-flex flex-column ga-4">
      <!-- Title (only required field) -->
      <VTextField
        v-model="titleField.value.value"
        label="Title"
        autofocus
        :error-messages="titleField.errors.value"
        hide-details="auto"
      />

      <!-- When: the kind of date, the date(s), then all day or a time on one row -->
      <section class="d-flex flex-column ga-3">
        <div class="form-section-title">When</div>
        <VBtnToggle v-model="dateMode" mandatory color="primary" variant="outlined" divided density="compact" rounded="lg" class="w-100">
          <VBtn value="single" class="flex-1-1 text-none">One day</VBtn>
          <VBtn value="multiple" class="flex-1-1 text-none">Several days</VBtn>
          <VBtn value="range" class="flex-1-1 text-none">Date range</VBtn>
        </VBtnToggle>

        <VMenu v-model="isDatePickerOpen" :close-on-content-click="false">
          <template #activator="{ props }">
            <VTextField
              v-bind="props"
              :model-value="displayDate"
              :label="dateLabel"
              append-inner-icon="mdi-calendar"
              readonly
              hide-details
            />
          </template>

          <VDatePicker
            :model-value="datePickerModel"
            :multiple="dateMode === 'range' ? 'range' : dateMode === 'multiple'"
            :first-day-of-week="settingsStore.firstDayOfWeek"
            hide-title
            @update:model-value="datePickerModel = $event"
          >
            <!-- Replace "2 selected" with the picked dates, using Vuetify's transition -->
            <template #header>
              <VFadeTransition hide-on-leave>
                <div :key="datePickerTitle" class="text-center pa-4">
                  <div class="text-h5">{{ datePickerTitle }}</div>
                </div>
              </VFadeTransition>
            </template>
            <template #actions>
              <VBtn variant="text" @click="isDatePickerOpen = false">Done</VBtn>
            </template>
          </VDatePicker>
        </VMenu>

        <!-- All day, or a start and end time beside it -->
        <div class="d-flex align-center ga-2 flex-wrap">
          <VSwitch v-model="allDayField.value.value" label="All day" color="primary" density="compact" hide-details class="flex-grow-0" />
          <VSpacer v-if="!allDayField.value.value" />
          <template v-if="!allDayField.value.value">
            <VMenu v-model="isStartTimeOpen" :close-on-content-click="false">
              <template #activator="{ props }">
                <VTextField
                  v-bind="props"
                  :model-value="startTimeField.value.value"
                  label="Start"
                  readonly
                  density="compact"
                  hide-details
                  class="time-field"
                />
              </template>
              <VTimePicker
                v-model="startTimeField.value.value"
                format="24hr"
                @update:model-value="isStartTimeOpen = false"
              />
            </VMenu>
            <span class="text-medium-emphasis">→</span>
            <VMenu v-model="isEndTimeOpen" :close-on-content-click="false">
              <template #activator="{ props }">
                <VTextField
                  v-bind="props"
                  :model-value="endTimeField.value.value"
                  label="End"
                  readonly
                  density="compact"
                  hide-details
                  :error="!!timeError"
                  class="time-field"
                />
              </template>
              <VTimePicker v-model="endTimeField.value.value" format="24hr" @update:model-value="isEndTimeOpen = false" />
            </VMenu>
          </template>
          <span v-else class="text-caption text-medium-emphasis">Turn off to pick a start and end time</span>
        </div>
        <div v-if="timeError" class="text-caption text-error">{{ timeError }}</div>
      </section>

      <!-- Repeat: presets from the picked date(s); Custom opens flat rows right under the field -->
      <section class="d-flex flex-column ga-3">
        <div class="form-section-title">Repeat</div>
        <VSelect
          v-model="repeatSelect"
          :items="repeatItems"
          :label="showCustomPanel ? 'Custom' : undefined"
          aria-label="Repeat"
          class="repeat-select"
          :error-messages="!showCustomPanel && repeatError ? [repeatError] : []"
          hide-details="auto"
        >
          <!-- Show the saved rule's own wording when it came from the custom panel -->
          <template v-if="showCustomPanel" #selection>{{ repeatSummary }}</template>
        </VSelect>

        <div v-if="showCustomPanel && repeatRule" class="repeat-rows">
          <!-- Every N units -->
          <span class="repeat-row-label">Every</span>
          <div class="d-flex align-center ga-2">
            <VNumberInput
              :model-value="repeatRule.interval"
              :min="1"
              aria-label="Repeat interval"
              control-variant="hidden"
              variant="outlined"
              density="compact"
              hide-details
              class="repeat-interval"
              @update:model-value="updateRule({ interval: $event })"
            />
            <VBtnToggle
              :model-value="repeatRule.freq"
              mandatory
              color="primary"
              variant="outlined"
              divided
              density="compact"
              rounded="lg"
              class="flex-grow-1"
              @update:model-value="updateRule({ freq: $event })"
            >
              <VBtn v-for="f in freqItems" :key="f.value" :value="f.value" class="flex-1-1 text-none">{{ f.title }}</VBtn>
            </VBtnToggle>
          </div>

          <!-- Monthly: the start date's day number, or "the <nth> <day>" (a single start day or range only) -->
          <template v-if="repeatRule.freq === 'month' && !isMultiple">
            <span class="repeat-row-label">On</span>
            <div class="d-flex align-center ga-2">
              <VBtnToggle v-model="monthlyMode" class="flex-shrink-0" mandatory color="primary" variant="outlined" divided density="compact" rounded="lg">
                <VBtn value="dayOfMonth" class="text-none">Day {{ dayjs(dateField.value.value).date() }}</VBtn>
                <VBtn value="position" class="text-none">The…</VBtn>
              </VBtnToggle>
              <template v-if="repeatRule.monthlyOn">
                <VSelect
                  :model-value="repeatRule.monthlyOn.nth"
                  :items="nthItems"
                  aria-label="Which one"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="position-select position-nth"
                  @update:model-value="updatePosition({ nth: $event })"
                />
                <VSelect
                  :model-value="repeatRule.monthlyOn.day"
                  :items="dayKindItems"
                  aria-label="Day"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="position-select"
                  @update:model-value="updatePosition({ day: $event })"
                />
              </template>
            </div>
          </template>

          <!-- Weekend days and holidays: keep, skip, or move to the nearest work day (single days only) -->
          <template v-if="canAdjustNonWorkday">
            <span class="repeat-row-label">Days off</span>
            <VSelect
              v-model="nonWorkdayMode"
              :items="nonWorkdayItems"
              aria-label="On a weekend or holiday"
              variant="outlined"
              density="compact"
              hide-details
            />
          </template>

          <!-- Ends: never / on a date / after N occurrences -->
          <span class="repeat-row-label">Ends</span>
          <div class="d-flex align-center ga-2">
            <VBtnToggle v-model="endMode" mandatory color="primary" variant="outlined" divided density="compact" rounded="lg" class="flex-shrink-0">
              <VBtn value="never" class="text-none">Never</VBtn>
              <VBtn value="until" class="text-none">On date</VBtn>
              <VBtn value="count" class="text-none">After</VBtn>
            </VBtnToggle>
            <VTextField
              v-if="repeatRule.end && 'until' in repeatRule.end"
              :model-value="repeatRule.end.until"
              type="date"
              aria-label="Last date"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="updateRule({ end: { until: $event } })"
            />
            <VNumberInput
              v-if="repeatRule.end && 'count' in repeatRule.end"
              :model-value="repeatRule.end.count"
              :min="1"
              aria-label="Occurrences"
              suffix="times"
              control-variant="hidden"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="updateRule({ end: { count: $event } })"
            />
          </div>
        </div>

        <!-- Validation — the summary itself already shows in the Repeat field -->
        <div v-if="showCustomPanel && repeatError" class="text-caption text-error">{{ repeatError }}</div>

        <!-- Preview: the next dates, and skipped ones (remove a chip to bring that date back) -->
        <VSheet
          v-if="repeatRule && (upcomingDates.length || skipDates.length)"
          color="container"
          rounded="lg"
          class="pa-3 d-flex flex-column ga-2"
        >
          <template v-if="upcomingDates.length">
            <div class="text-caption text-medium-emphasis">Next dates</div>
            <div class="d-flex flex-wrap ga-2">
              <VChip v-for="d in upcomingDates" :key="d" size="small" variant="outlined" label>{{ d }}</VChip>
            </div>
          </template>
          <template v-if="skipDates.length">
            <div class="text-caption text-medium-emphasis">Skipped</div>
            <div class="d-flex flex-wrap ga-2">
              <VChip v-for="d in skipDates" :key="d" size="small" variant="tonal" label closable @click:close="unskipDate(d)">
                {{ dayjs(d).format('MMM D, YYYY') }}
              </VChip>
            </div>
          </template>
        </VSheet>
      </section>

      <!-- Description (optional) -->
      <VTextarea v-model="descriptionField.value.value" label="Description (optional)" rows="2" auto-grow hide-details />
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
/* Segmented choices read as plain words, like the mock */
.event-form :deep(.v-btn-group .v-btn) {
  letter-spacing: normal;
}

.form-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.time-field {
  max-width: 96px;
}

/* Custom repeat: label column + control, flat under the Repeat field */
.repeat-rows {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.repeat-row-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.repeat-interval {
  max-width: 64px;
  flex: 0 0 auto;
}

.repeat-interval :deep(input) {
  text-align: center;
}

.position-select {
  min-width: 0;
  flex: 1 1 0;
}

/* "first"/"last" is short: leave the room to the day name */
.position-nth {
  flex: 0 0 104px;
}

.position-select :deep(.v-field) {
  padding-inline: 10px 6px;
}
</style>
