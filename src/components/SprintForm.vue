<script setup lang="ts">
import { computed, ref } from 'vue';

import DateField from '@/components/DateField.vue';
import SprintNameInput from '@/components/SprintNameInput.vue';

import type { AppEvent, RepeatRule } from '@/interfaces/Event';

import dayjs from 'dayjs';

import { atOccurrence, backToBackRule, getOccurrences, spanDays } from '@/common/eventRecurrence';
import {
  DEFAULT_SPRINT_FORMAT,
  formatSprintName,
  parseSprintFormat,
  SPRINT_STYLES,
  SPRINT_TOKENS,
  type SprintStyleId,
} from '@/common/sprintNaming';
import { useSettingsStore } from '@/stores/settings';

// Back-to-back sprints with auto names. Saved as a plain repeating range event plus `sprint` naming, so the
// calendar, list and skips treat it like any other series. Split a series (a short Christmas sprint) by
// ending it on a date and adding another one.
const { item } = defineProps<{
  item?: AppEvent | null;
}>();

const emit = defineEmits<{
  saveEvent: [event: AppEvent];
  cancelModifyEvent: [];
}>();

const settingsStore = useSettingsStore();
const today = dayjs().format('YYYY-MM-DD');
const toDay = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');

// ─── Dates ────────────────────────────────────────────────────
// A new series starts next Monday; the dialog remounts on every open, so plain refs seeded from `item` are enough
const nextMonday = () => {
  const d = dayjs();
  return toDay(d.add(((8 - d.day()) % 7) || 7, 'day'));
};
const startDate = ref(item?.date ?? nextMonday());
const weeks = ref(item ? Math.max(1, Math.ceil((spanDays(item) + 1) / 7)) : 2);
const weekOptions = [1, 2, 3, 4];

const endMode = ref<'never' | 'until' | 'count'>(
  !item ? 'never' : !item.repeat ? 'count' : item.repeat.end ? ('until' in item.repeat.end ? 'until' : 'count') : 'never',
);
const until = ref(item?.repeat?.end && 'until' in item.repeat.end ? item.repeat.end.until : '');
const count = ref(item?.repeat?.end && 'count' in item.repeat.end ? item.repeat.end.count : item ? 1 : 6);
const skip = item?.repeat?.skip ?? [];

// A sprint ends on the last work day before the next one starts (Mon → Thu under a Fri–Sun weekend)
const endDate = computed(() => {
  const start = dayjs(startDate.value);
  let end = start.add(weeks.value * 7 - 1, 'day');
  while (end.isAfter(start) && settingsStore.weekendDays.includes(end.day())) end = end.subtract(1, 'day');
  return toDay(end);
});

const lengthHint = computed(() => {
  const start = dayjs(startDate.value);
  const end = dayjs(endDate.value);
  const span = end.diff(start, 'day') >= 7 ? `${start.format('ddd')} → ${end.format('ddd')} of the next week` : `${start.format('ddd')} → ${end.format('ddd')}`;
  return `${span}. The next sprint starts when this one ends.`;
});

// ─── Name ─────────────────────────────────────────────────────
const format = ref(item?.sprint?.format ?? DEFAULT_SPRINT_FORMAT);
const first = ref(item?.sprint?.first ?? 1);

// A ready-made style while the format matches one; Custom opens the chip editor on the current format
const styleId = ref<SprintStyleId | 'custom'>(SPRINT_STYLES.find((s) => s.format === format.value)?.id ?? 'custom');
const onPickStyle = (id: SprintStyleId | 'custom') => {
  styleId.value = id;
  const style = SPRINT_STYLES.find((s) => s.id === id);
  if (style) format.value = style.format;
};

const nameInput = ref<InstanceType<typeof SprintNameInput> | null>(null);

// What the first sprint would be called in a given format, for the style cards and chip examples
const firstSprint = computed(() => ({
  start: startDate.value,
  end: endDate.value,
  numbers: { number: first.value, inQuarter: first.value, inYear: first.value },
}));
const styleExample = (styleFormat: string) => formatSprintName(styleFormat, firstSprint.value);
const tokenExample = (key: string) => formatSprintName(`{${key}}`, firstSprint.value);

// Which period numbers restart in, for the hint and the preview's period change
const restartsBy = computed<'quarter' | 'year' | null>(() => {
  const tokens = parseSprintFormat(format.value).flatMap((p) => ('token' in p ? [p.token] : []));
  if (tokens.includes('inQuarter')) return 'quarter';
  if (tokens.includes('inYear')) return 'year';
  return null;
});

const firstHint = computed(() => {
  if (restartsBy.value === 'quarter') return 'Starting mid-quarter? Type the number the team is on, e.g. 3 for Q4.3.';
  if (restartsBy.value === 'year') return 'Restarts at 1 each year. Type the number of the first sprint.';
  return 'The number of the first sprint.';
});

// ─── The series being edited ──────────────────────────────────
const rule = computed<RepeatRule | undefined>(() => {
  if (endMode.value === 'count' && count.value <= 1) return undefined; // one sprint: no repeat
  const base = backToBackRule({ date: startDate.value, endDate: endDate.value }, settingsStore.weekendDays) ?? {
    freq: 'week',
    interval: weeks.value,
  };
  const end =
    endMode.value === 'until' && until.value
      ? { until: until.value }
      : endMode.value === 'count'
        ? { count: count.value }
        : undefined;
  return { ...base, ...(end ? { end } : {}), ...(skip.length ? { skip } : {}) };
});

const series = computed<AppEvent>(() => ({
  id: item?.id ?? '',
  title: '',
  type: 'custom',
  date: startDate.value,
  endDate: endDate.value,
  ...(rule.value ? { repeat: rule.value } : {}),
  sprint: { format: format.value, first: first.value },
  ...(item?.description ? { description: item.description } : {}),
}));

// ─── Preview ──────────────────────────────────────────────────
const shortDate = (d: string) => dayjs(d).format('D MMM');
const previewRow = (occurrence: string) => {
  const shown = atOccurrence(series.value, occurrence);
  return {
    date: occurrence,
    name: shown.title,
    dates: `${shortDate(shown.date)} → ${shortDate(shown.endDate ?? shown.date)}`,
    now: shown.date <= today && today <= (shown.endDate ?? shown.date),
  };
};

// The next three sprints from today (or the first one, if later), and the two around the next period change
const preview = computed(() => {
  if (!isValid.value) return { upcoming: [], change: [] };
  const from = startDate.value > today ? startDate.value : today;
  const ahead = getOccurrences(series.value, from, toDay(dayjs(from).add(15, 'month')));
  const upcoming = ahead.slice(0, 3).map(previewRow);

  const period = (d: string) =>
    restartsBy.value === 'quarter' ? `${d.slice(0, 4)}-${Math.ceil(Number(d.slice(5, 7)) / 3)}` : d.slice(0, 4);
  const at = restartsBy.value ? ahead.findIndex((d, i) => i > 0 && period(d) !== period(ahead[i - 1])) : -1;
  // Only worth showing when the change isn't already in the rows above
  const change = at > 2 ? [ahead[at - 1], ahead[at]].map(previewRow) : [];
  return { upcoming, change };
});

// ─── Validation ───────────────────────────────────────────────
const errors = computed(() => ({
  start: dayjs(startDate.value).isValid() ? '' : 'Pick a date',
  until: endMode.value === 'until' && (!until.value || until.value < startDate.value) ? 'After the first sprint' : '',
  format: format.value.trim() ? '' : 'Give the sprints a name',
  first: Number.isInteger(first.value) && first.value >= 1 ? '' : 'A whole number from 1',
}));
const isValid = computed(() => Object.values(errors.value).every((e) => !e));

// ─── Actions ──────────────────────────────────────────────────
const onSave = () => {
  if (!isValid.value) return;
  const event = { ...series.value, sprint: { format: format.value.trim(), first: first.value } };
  // `title` is the first sprint's name, for anything that reads events without the sprint naming
  emit('saveEvent', { ...event, title: atOccurrence(event, event.date).title });
};
</script>

<template>
  <VCard rounded="lg">
    <VCardTitle>{{ item ? 'Edit Sprints' : 'New Sprints' }}</VCardTitle>

    <VCardText class="d-flex flex-column ga-4">
      <!-- Dates: first sprint, length, when the series ends -->
      <section class="d-flex flex-column ga-3">
        <div class="sprint-section-title">Dates</div>
        <div class="d-flex ga-2">
          <DateField
            v-model="startDate"
            label="First sprint starts"
            :error-messages="errors.start"
            hide-details="auto"
          />
          <VSelect
            v-model="endMode"
            :items="[
              { title: 'Never ends', value: 'never' },
              { title: 'Ends on a date', value: 'until' },
              { title: 'Ends after', value: 'count' },
            ]"
            label="Series"
            hide-details
          />
        </div>
        <DateField
          v-if="endMode === 'until'"
          v-model="until"
          :min="startDate"
          label="Last sprint starts by"
          :error-messages="errors.until"
          hide-details="auto"
        />
        <VNumberInput
          v-if="endMode === 'count'"
          v-model="count"
          :min="1"
          label="Sprints"
          hint="1 for a one-off sprint, e.g. a short one over the holidays"
          persistent-hint
        />

        <div>
          <div class="text-caption text-medium-emphasis mb-1">Length</div>
          <VBtnToggle v-model="weeks" mandatory color="primary" variant="outlined" divided density="compact" rounded="lg" class="w-100">
            <VBtn v-for="w in weekOptions" :key="w" :value="w" class="flex-1-1 text-none">{{ w }} {{ w === 1 ? 'week' : 'weeks' }}</VBtn>
          </VBtnToggle>
          <div class="text-caption text-medium-emphasis mt-1">{{ lengthHint }}</div>
        </div>
      </section>

      <!-- Name: a ready-made style, or Custom to build one from text and chips -->
      <section class="d-flex flex-column ga-2">
        <div class="sprint-section-title">Name</div>
        <VRadioGroup :model-value="styleId" hide-details @update:model-value="onPickStyle($event as SprintStyleId | 'custom')">
          <VRadio
            v-for="style in SPRINT_STYLES"
            :key="style.id"
            :value="style.id"
            color="primary"
            class="sprint-style"
            :class="{ 'sprint-style--on': styleId === style.id }"
          >
            <template #label>
              <div class="d-flex flex-column">
                <span class="text-body-1 text-high-emphasis">{{ styleExample(style.format) }}</span>
                <span class="text-caption text-medium-emphasis">{{ style.hint }}</span>
              </div>
            </template>
          </VRadio>
          <VRadio value="custom" color="primary" class="sprint-style" :class="{ 'sprint-style--on': styleId === 'custom' }">
            <template #label>
              <div class="d-flex flex-column">
                <span class="text-body-1 text-high-emphasis">Custom…</span>
                <span class="text-caption text-medium-emphasis">Build your own name from text and chips</span>
              </div>
            </template>
          </VRadio>
        </VRadioGroup>

        <!-- Custom: the chip editor opens right under the styles -->
        <VExpandTransition>
          <VSheet v-if="styleId === 'custom'" border rounded="lg" class="pa-3 d-flex flex-column ga-2">
            <SprintNameInput ref="nameInput" v-model="format" :error-messages="errors.format ? [errors.format] : []" />
            <div class="text-caption text-medium-emphasis">
              Reads as <span class="text-high-emphasis font-weight-medium">{{ styleExample(format) }}</span>. Type
              text, click a chip to insert it.
            </div>
            <div class="sprint-tokens">
              <!-- mousedown.prevent keeps the caret in the name box -->
              <VBtn
                v-for="token in SPRINT_TOKENS"
                :key="token.key"
                variant="outlined"
                rounded="lg"
                size="small"
                class="sprint-token"
                @mousedown.prevent
                @click="nameInput?.insert(token.key)"
              >
                <span>{{ token.label }}</span>
                <span class="text-medium-emphasis">{{ tokenExample(token.key) }}</span>
              </VBtn>
            </div>
          </VSheet>
        </VExpandTransition>

        <VNumberInput
          v-model="first"
          :min="1"
          label="First number"
          :hint="firstHint"
          persistent-hint
          :error-messages="errors.first"
          class="mt-2"
        />
      </section>

      <!-- Preview: the names coming up, and around the next quarter / year change -->
      <VSheet v-if="preview.upcoming.length" color="container" rounded="lg" class="pa-3 d-flex flex-column ga-1">
        <div class="text-caption text-medium-emphasis">Coming up</div>
        <div v-for="row in preview.upcoming" :key="row.date" class="sprint-preview-row">
          <span class="d-flex align-center ga-2">
            <span class="font-weight-medium">{{ row.name }}</span>
            <VChip v-if="row.now" size="x-small" variant="outlined" label>now</VChip>
          </span>
          <span class="text-medium-emphasis">{{ row.dates }}</span>
        </div>

        <template v-if="preview.change.length">
          <VDivider class="my-1" />
          <div class="text-caption text-medium-emphasis">Around the new {{ restartsBy }}</div>
          <div v-for="row in preview.change" :key="row.date" class="sprint-preview-row">
            <span class="font-weight-medium">{{ row.name }}</span>
            <span class="text-medium-emphasis">{{ row.dates }}</span>
          </div>
          <div class="text-caption text-medium-emphasis">A sprint counts in the {{ restartsBy }} it starts in.</div>
        </template>
      </VSheet>

      <!-- Skipped sprints stay skipped; un-skip them from the Events form if needed -->
      <div v-if="skip.length" class="text-caption text-medium-emphasis">
        Skipped: {{ skip.map((d) => dayjs(d).format('MMM D')).join(', ') }}
      </div>
    </VCardText>

    <VCardActions>
      <VSpacer />
      <VBtn variant="text" @click="emit('cancelModifyEvent')">Cancel</VBtn>
      <VBtn color="primary" variant="tonal" :disabled="!isValid" @click="onSave">{{ item ? 'Save' : 'Add' }}</VBtn>
    </VCardActions>
  </VCard>
</template>

<style scoped>
.sprint-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Each style is a bordered card; the picked one takes the primary border */
.sprint-style {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 4px 8px 4px 0;
  margin-bottom: 6px;
}

.sprint-style--on {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.sprint-tokens {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.sprint-token {
  text-transform: none;
  letter-spacing: normal;
}

.sprint-token :deep(.v-btn__content) {
  justify-self: stretch;
  flex: 1 1 auto;
  justify-content: space-between;
  gap: 8px;
}

.sprint-preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.875rem;
  min-height: 24px;
}
</style>
