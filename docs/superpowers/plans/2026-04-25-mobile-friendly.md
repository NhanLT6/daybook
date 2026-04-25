# Mobile-Friendly UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three mobile layout breakages — app bar nav overflow, overly complex chart, and clipped card-header buttons — without touching any desktop behavior.

**Architecture:** All fixes are CSS/component-level and activate only at `≤ 959px` (Vuetify `smAndDown`). A new `MobileWeekChart.vue` replaces `WorkTimeBarChart` on mobile only. Existing desktop code paths are untouched.

**Tech Stack:** Vue 3 Composition API, Vuetify 3, dayjs, lodash, `useDisplay()` from Vuetify, `useProjectColors()` composable, `useSettingsStore()`.

---

## File Map

| File                                      | Action     | What changes                                                                       |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `src/App.vue`                             | Modify     | Add `useDisplay`, restructure nav for two-row mobile layout                        |
| `src/components/MobileWeekChart.vue`      | **Create** | Compact 7-day stacked strip chart                                                  |
| `src/views/HomeView.vue`                  | Modify     | Conditionally render `MobileWeekChart` vs `WorkTimeBarChart`; pass `selectedDates` |
| `src/components/app/SingleFilePicker.vue` | Modify     | Replace `text` prop with default slot so callers can hide text                     |
| `src/components/LogList.vue`              | Modify     | Wrap Import/Export button text in `<span class="d-none d-sm-inline">`              |
| `src/views/TaskView.vue`                  | Modify     | Wrap New Category/New Project button text in `<span class="d-none d-sm-inline">`   |

---

## Task 1 — App bar: scrollable mobile nav row

**Files:**

- Modify: `src/App.vue`

The current `VAppBar` puts title + theme-toggle + 4 nav buttons on one row. On narrow screens the last button clips. Fix: on mobile, nav moves to a scrollable second row via `VAppBar`'s `#extension` slot (only rendered when `:extended="smAndDown"`); on desktop, nav stays inline as today.

- [ ] **Step 1: Add `useDisplay` and `smAndDown`**

In `src/App.vue` `<script setup>`, add:

```ts
import { useDisplay } from 'vuetify';

// (after the existing useTheme import)

const { smAndDown } = useDisplay();
```

- [ ] **Step 2: Restructure the template**

Replace the entire `<VAppBar>` block:

```html
<VAppBar density="compact" class="elevation-0" color="transparent" :extended="smAndDown" extension-height="44">
  <VAppBarTitle>Daybook</VAppBarTitle>

  <VBtn :icon="themeIcon" variant="text" class="mr-2" size="36" @click="toggleTheme" />

  <!-- Desktop nav: inline (hidden on mobile) -->
  <VBtn
    v-for="(item, i) in navItems"
    :key="i"
    :active="item.to === route.path"
    class="me-2 text-none d-none d-sm-flex"
    v-bind="item"
    :to="item.to"
  />

  <template #extension>
    <!-- Mobile nav: scrollable row, only rendered when smAndDown -->
    <div v-if="smAndDown" class="mobile-nav-scroll">
      <VBtn
        v-for="(item, i) in navItems"
        :key="i"
        :active="item.to === route.path"
        class="me-1 text-none flex-shrink-0"
        v-bind="item"
        :to="item.to"
      />
    </div>
  </template>
</VAppBar>
```

- [ ] **Step 3: Add mobile nav CSS**

In the `<style>` block (global, not scoped) add after the existing rules:

```css
.mobile-nav-scroll {
  display: flex;
  width: 100%;
  overflow-x: auto;
  padding: 4px 12px 0;
  gap: 4px;
  scrollbar-width: none;
}
.mobile-nav-scroll::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 4: Verify visually**

Run `pnpm dev`. Resize browser to ≤ 600 px width. Confirm:

- Row 1: "Daybook" title + theme-toggle icon
- Row 2: "Home Tasks Events Settings" — scrollable, no clipping
- At ≥ 600 px: one row with nav inline, no extension row visible

- [ ] **Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat(mobile): scrollable nav row in app bar extension slot"
```

---

## Task 2 — MobileWeekChart component

**Files:**

- Create: `src/components/MobileWeekChart.vue`

A compact 56 px-tall strip of 7 stacked-color bars (Mon–Sun). Bar heights are proportional to logged hours relative to the week's max (min scale = 8 h). Project colors come from `useProjectColors()`. Today's column is subtly highlighted. No chart.js.

- [ ] **Step 1: Create the component**

Create `src/components/MobileWeekChart.vue` with the full content below:

```vue
<script setup lang="ts">
import { computed } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { TimeLog } from '@/interfaces/TimeLog';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { useSettingsStore } from '@/stores/settings';
import { chain, sumBy } from 'lodash';

const props = defineProps<{
  timeLogs: TimeLog[];
  selectedDates: Date[];
  currentMonth: number; // 1-based
}>();

const settingsStore = useSettingsStore();
const { getProjectColor } = useProjectColors();

// Determine the reference date for centering the displayed week.
// Priority: selectedDates[0] if it's within currentMonth, else today if
// today is in currentMonth, else first day of currentMonth.
const referenceDate = computed(() => {
  const first = props.selectedDates[0];
  if (first && dayjs(first).month() + 1 === props.currentMonth) {
    return dayjs(first);
  }
  const today = dayjs();
  if (today.month() + 1 === props.currentMonth) {
    return today;
  }
  return dayjs()
    .month(props.currentMonth - 1)
    .date(1);
});

// Build the 7-day window starting from the user-configured first day of week.
// settingsStore.firstDayOfWeek: 0 = Sunday, 1 = Monday (default), etc.
const weekDays = computed(() => {
  const ref = referenceDate.value;
  const startDay = settingsStore.firstDayOfWeek;
  const dayOffset = (ref.day() - startDay + 7) % 7;
  const weekStart = ref.subtract(dayOffset, 'day');
  return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
});

// Single-letter day labels in the same week order as weekDays.
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index = dayjs .day()
const dayLabels = computed(() => weekDays.value.map((d) => DAY_LETTERS[d.day()]));

// Per-day stacked segment data.
const todayStr = dayjs().format(shortDateFormat);

const dayData = computed(() =>
  weekDays.value.map((day) => {
    const dateStr = day.format(shortDateFormat);
    const logsForDay = props.timeLogs.filter((l) => l.date === dateStr);

    const segments = chain(logsForDay)
      .groupBy('project')
      .map((logs, project) => ({
        project,
        duration: sumBy(logs, 'duration'),
        color: getProjectColor(project),
      }))
      .value();

    return {
      dateStr,
      isToday: dateStr === todayStr,
      totalDuration: sumBy(segments, 'duration'),
      segments,
    };
  }),
);

// Scale: max minutes across the week, with a floor of 480 (8 h) so an
// all-light week doesn't render at 100% height and look misleading.
const maxDuration = computed(() => {
  const max = Math.max(...dayData.value.map((d) => d.totalDuration));
  return Math.max(max, 480);
});
</script>

<template>
  <div class="week-chart">
    <div v-for="(day, i) in dayData" :key="day.dateStr" class="day-col" :class="{ 'day-today': day.isToday }">
      <!-- Bar area: segments stack from bottom via column-reverse -->
      <div class="bar-wrap">
        <div
          v-for="seg in day.segments"
          :key="seg.project"
          class="bar-seg"
          :style="{
            height: (seg.duration / maxDuration) * 100 + '%',
            background: seg.color,
          }"
        />
      </div>

      <!-- Day letter label -->
      <div class="day-label">{{ dayLabels[i] }}</div>
    </div>
  </div>
</template>

<style scoped>
.week-chart {
  display: flex;
  gap: 4px;
  height: 56px;
  padding: 0 12px;
}

.day-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-radius: 4px;
  padding: 2px;
}

.day-today {
  background: rgba(var(--v-theme-primary), 0.08);
}

/* Segments stack from the bottom: column-reverse puts first child at bottom */
.bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column-reverse;
  overflow: hidden;
  border-radius: 3px;
  /* Subtle background visible when no logs */
  background: rgba(128, 128, 128, 0.07);
}

.bar-seg {
  width: 100%;
  flex-shrink: 0;
}

.day-label {
  font-size: 0.6rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-weight: 500;
  flex-shrink: 0;
  line-height: 1;
}

.day-today .day-label {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
</style>
```

- [ ] **Step 2: Verify the component compiles**

```bash
pnpm type-check
```

Expected: no errors related to `MobileWeekChart.vue`.

---

## Task 3 — HomeView: conditional chart rendering

**Files:**

- Modify: `src/views/HomeView.vue`

- [ ] **Step 1: Import `MobileWeekChart` and `useDisplay`**

In `src/views/HomeView.vue` `<script setup>`, add after the existing imports:

```ts
import MobileWeekChart from '@/components/MobileWeekChart.vue';

import { useDisplay } from 'vuetify';
```

And after the existing `useTheme()` line:

```ts
const { smAndDown } = useDisplay();
```

- [ ] **Step 2: Replace the chart in the template**

Find this line in the template:

```html
<WorkTimeBarChart :current-month="currentMonth" class="flex-shrink-0" />
```

Replace with:

```html
<!-- Mobile: compact week strip chart driven by calendar selection -->
<MobileWeekChart
  v-if="smAndDown"
  :time-logs="timeLogs"
  :selected-dates="selectedDates"
  :current-month="currentMonth"
  class="flex-shrink-0"
/>
<!-- Desktop: full month bar chart (unchanged) -->
<WorkTimeBarChart v-else :current-month="currentMonth" class="flex-shrink-0" />
```

- [ ] **Step 3: Verify visually**

Run `pnpm dev`. At ≤ 959 px:

- Compact 7-bar strip appears instead of the full chart
- Clicking a date in the calendar moves the strip to show that date's week
- Navigating to a different month in the calendar updates the strip (falls back to today or month start)

At > 959 px: full bar chart unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileWeekChart.vue src/views/HomeView.vue
git commit -m "feat(mobile): compact week chart replaces bar chart on small screens"
```

---

## Task 4 — SingleFilePicker: slot-based label

**Files:**

- Modify: `src/components/app/SingleFilePicker.vue`

The current component uses a `text` prop and renders two `VBtn` branches. Replacing with a default slot lets callers control label visibility with responsive classes.

- [ ] **Step 1: Rewrite `SingleFilePicker`**

Replace the entire file content:

```vue
<script setup lang="ts">
import { ref } from 'vue';

export interface SingleFilePickerProps {
  fileTypes?: string;
}

const { fileTypes } = defineProps<SingleFilePickerProps>();

const emit = defineEmits<{
  fileSelected: [file?: File];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  emit('fileSelected', file);
};
</script>

<template>
  <div>
    <VBtn v-bind="$attrs" @click="triggerFileInput">
      <slot />
    </VBtn>
    <input ref="fileInput" type="file" :accept="fileTypes" style="display: none" @change="handleFileChange" />
  </div>
</template>

<style scoped></style>
```

- [ ] **Step 2: Update the call site in `LogList.vue`**

Find the `SingleFilePicker` usage in `src/components/LogList.vue` (inside the Import `VTooltip`):

```html
<SingleFilePicker prepend-icon="mdi-import" file-types=".csv" @file-selected="readCsv" text="Import" v-bind="props" />
```

Replace with:

```html
<SingleFilePicker prepend-icon="mdi-import" file-types=".csv" @file-selected="readCsv" v-bind="props">
  <span class="d-none d-sm-inline">Import</span>
</SingleFilePicker>
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors. (`text` prop is removed so no "unknown prop" warning remains.)

- [ ] **Step 4: Verify**

Run `pnpm dev`, navigate to Home. At ≤ 600 px: Import button shows icon only. At ≥ 600 px: Import button shows icon + "Import" text.

---

## Task 5 — LogList: hide Export button text on mobile

**Files:**

- Modify: `src/components/LogList.vue`

- [ ] **Step 1: Wrap Export button text**

Find the Export `VBtn` in `src/components/LogList.vue`:

```html
<VBtn prepend-icon="mdi-export" variant="tonal" color="primary" @click="emit('export')" v-bind="props"> Export </VBtn>
```

Replace with:

```html
<VBtn prepend-icon="mdi-export" variant="tonal" color="primary" @click="emit('export')" v-bind="props">
  <span class="d-none d-sm-inline">Export</span>
</VBtn>
```

- [ ] **Step 2: Verify**

At ≤ 600 px: Export button shows icon only. At ≥ 600 px: icon + "Export".

- [ ] **Step 3: Commit**

```bash
git add src/components/app/SingleFilePicker.vue src/components/LogList.vue
git commit -m "feat(mobile): icon-only Import/Export buttons on small screens"
```

---

## Task 6 — TaskView: hide header button text on mobile

**Files:**

- Modify: `src/views/TaskView.vue`

- [ ] **Step 1: Wrap "New Category" button text**

Find the "New Category" `VBtn` in `src/views/TaskView.vue`:

```html
<VBtn variant="text" prepend-icon="mdi-shape-plus-outline" size="small" @click="openAddCategory" v-bind="props">
  New Category
</VBtn>
```

Replace with:

```html
<VBtn variant="text" prepend-icon="mdi-shape-plus-outline" size="small" @click="openAddCategory" v-bind="props">
  <span class="d-none d-sm-inline">New Category</span>
</VBtn>
```

- [ ] **Step 2: Wrap "New Project" button text**

Find the "New Project" `VBtn`:

```html
<VBtn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="createNewProject()" v-bind="props">
  New Project
</VBtn>
```

Replace with:

```html
<VBtn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="createNewProject()" v-bind="props">
  <span class="d-none d-sm-inline">New Project</span>
</VBtn>
```

- [ ] **Step 3: Verify**

At ≤ 600 px: both buttons show icon only. At ≥ 600 px: full text visible.

- [ ] **Step 4: Commit**

```bash
git add src/views/TaskView.vue
git commit -m "feat(mobile): icon-only task header buttons on small screens"
```

---

## Task 7 — Final lint + type-check pass

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Expected: 0 errors, 0 warnings. Fix any if found.

- [ ] **Step 2: Run type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 3: Manual mobile smoke test**

Open `pnpm dev` and resize to 375 px width. Check each view:

- **Home**: two-row app bar, 7-bar week strip, form fills full width, LogList visible below (icon-only Import/Export)
- **Tasks**: icon-only "New Category" + "New Project" header buttons
- **Events**: no regressions
- **Settings**: no regressions

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -p   # stage only lint fixes
git commit -m "chore: lint fixes after mobile UI changes"
```
