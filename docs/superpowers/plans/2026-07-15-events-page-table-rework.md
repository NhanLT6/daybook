# Events Page Table + Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Events page to a full-bleed layout matching the Tasks page, render events as a filterable table, and add type + time filters — all without touching the add/edit/delete flow.

**Architecture:** Extract the Tasks-page full-height shell into shared CSS classes and reuse them for Events. Replace the events `VList` with a `VDataTable` inside a rounded card and a width-capped inner container. Two `VBtnToggle` filters (type, time) in the header drive a single `filteredEvents` computed.

**Tech Stack:** Vue 3 + TypeScript + Composition API, Vuetify 3 (`VDataTable`, `VBtnToggle`, `VContainer`, `VIconBtn`), dayjs, `@vueuse/core` `useStorage`.

## Global Constraints

- **Package manager:** yarn (never npm).
- **Verification gates (this repo has no component unit-test runner):** every task ends with `yarn type-check` (must print `Done`), `yarn lint` (must print `0 errors`; pre-existing warnings in unrelated files are acceptable), and a **browser check** against the running dev server (already running on http://localhost:5173). There are no unit tests to write.
- **Semantic colors / existing patterns:** reuse existing components and classes (`glass-acrylic`, `bg-container`, `VIconBtn`, the rounded-`VCard`-wraps-`VDataTable` pattern from `LogList`/`TaskView`).
- **Do not modify** `src/components/EventForm.vue`, holiday fetching, or `CalendarOverview.vue`.
- Commit after each task with the exact message given.

---

## Task 1: Extract shared page-fill layout classes and retrofit TaskView

Move the Tasks-page full-height shell into reusable classes so Events can share them, and switch `TaskView` over to them. Behavior-neutral: the Tasks page must look identical afterward.

**Files:**
- Modify: `src/assets/main.css` — add three layout rules
- Modify: `src/views/TaskView.vue` — use shared classes, delete the local ones

**Interfaces:**
- Produces: CSS classes `.page-fill` (full-height 12px-padded page wrapper), `.page-fill > .v-card` (panel card fills height), `.page-inner` (max-width content cap). Task 2 consumes these.

- [ ] **Step 1: Add shared layout classes to `src/assets/main.css`**

Append after the existing `.bg-container` rule (near the top, after line 17):

```css
/* ── Full-height page shell (shared by Task/Event views) ─────────────────────
   .page-fill fills VMain and pads it; its panel VCard fills the height so the
   card reads as the content area. .page-inner caps the readable width of the
   scrollable content inside that card. */
.page-fill {
  height: 100%;
  padding: 12px;
}

.page-fill > .v-card {
  height: 100%;
}

/* !important out-specifies Vuetify's `.v-container` responsive max-width, which
   otherwise ties on specificity and wins on source order. */
.page-inner {
  max-width: 900px !important;
}
```

- [ ] **Step 2: Point TaskView at the shared classes**

In `src/views/TaskView.vue` `<template>`, make these class replacements:

- The root wrapper: `<div class="tasks-layout">` → `<div class="page-fill">`
- The main card: `<VCard class="glass-acrylic tasks-card d-flex flex-column overflow-hidden">` → `<VCard class="glass-acrylic d-flex flex-column overflow-hidden">`
- The header container: `<VContainer class="tasks-inner py-0">` → `<VContainer class="page-inner py-0">`
- The body container: `<VContainer class="tasks-inner">` → `<VContainer class="page-inner">`

- [ ] **Step 3: Delete the now-unused local style rules**

In `src/views/TaskView.vue` `<style scoped>`, remove the `.tasks-layout`, `.tasks-card`, and `.tasks-inner` rules (and their comments). Leave `.cursor-pointer`, `.project-title`, and the mobile `@media` block intact.

- [ ] **Step 4: Type-check and lint**

Run: `yarn type-check`
Expected: prints `Done`.

Run: `yarn lint`
Expected: `0 errors` (pre-existing warnings in other files are fine).

- [ ] **Step 5: Browser check — Tasks page unchanged**

Navigate the dev-server browser to `http://localhost:5173/task`. Confirm the page still renders as a full-bleed glass card filling the viewport, header with `Projects & Tasks` + `New Project`, project rows and task tables. It must look identical to before this task. Check the console has no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/assets/main.css src/views/TaskView.vue
git commit -m "refactor(layout): extract shared page-fill classes, adopt in TaskView"
```

---

## Task 2: Events page shell + table

Give the Events page the full-bleed shell and replace the `VList` with a `VDataTable`. No filters yet — the table shows all events sorted chronologically (current behavior).

**Files:**
- Modify: `src/views/EventView.vue` — full-bleed wrapper
- Modify: `src/components/EventList.vue` — full-height card, inner container, `VList` → `VDataTable`

**Interfaces:**
- Consumes: `.page-fill` / `.page-inner` from Task 1.
- Produces: `EventList` renders a `VDataTable` of `filteredEvents` (an `AppEvent[]` computed). Task 3 rewrites `filteredEvents` and the header filters.

**Note — actions are always-visible (intentional):** the old list used `VHover` to reveal edit/delete on hover. In a table this matches the app's existing table pattern (Tasks task rows, `LogList`) where row actions are always visible, which is the point of the rework (consistency). `VHover` and hover-reveal are dropped.

- [ ] **Step 1: Rewrite `src/views/EventView.vue`**

Replace the entire file with:

```vue
<script setup lang="ts">
import EventList from '@/components/EventList.vue';
</script>

<template>
  <div class="page-fill">
    <EventList />
  </div>
</template>
```

- [ ] **Step 2: Add table headers + row-props to the `EventList` script**

In `src/components/EventList.vue` `<script setup>`, add this after the `filteredEvents` computed (keep `filteredEvents` as-is for this task):

```typescript
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
```

- [ ] **Step 3: Replace the `EventList` `<template>` body (header, list → table)**

Replace the entire `<template>` in `src/components/EventList.vue` with:

```html
<template>
  <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
    <!-- Header -->
    <VCardTitle class="flex-shrink-0 pa-0">
      <VContainer class="page-inner py-0">
        <VToolbar class="bg-transparent" density="compact">
          <VToolbarTitle class="ms-0">Events</VToolbarTitle>

          <VSpacer />

          <VTooltip>
            <template #activator="{ props }">
              <VBtn prepend-icon="mdi-plus" color="primary" variant="tonal" @click="openAddModal" v-bind="props">
                New Event
              </VBtn>
            </template>
            Add event
          </VTooltip>
        </VToolbar>
      </VContainer>
    </VCardTitle>

    <!-- Scrollable body -->
    <div class="scroll-content">
      <VContainer class="page-inner">
        <!-- Empty state -->
        <div
          v-if="filteredEvents.length === 0"
          class="d-flex flex-column ga-2 py-8 align-center bg-container rounded-lg text-disabled"
        >
          <VIcon icon="mdi-calendar-blank-outline" />
          <div class="text-subtitle-1">No events</div>
        </div>

        <!-- Events table -->
        <VCard v-else class="elevation-0 rounded-lg overflow-hidden">
          <VDataTable
            :items="filteredEvents"
            :headers="headers"
            :items-per-page="-1"
            :row-props="rowProps"
            class="bg-container"
            hide-default-footer
          >
            <!-- Type avatar: holiday image vs custom icon -->
            <template #item.type="{ item }">
              <VAvatar size="small" variant="tonal">
                <VImg v-if="item.type === 'holiday'" :src="holidayImg" alt="Holiday" />
                <VIcon v-else icon="mdi-account-outline" />
              </VAvatar>
            </template>

            <!-- Title + optional muted description line -->
            <template #item.title="{ item }">
              <div class="py-1">
                <div>{{ item.title }}</div>
                <div v-if="item.description" class="text-caption text-medium-emphasis">{{ item.description }}</div>
              </div>
            </template>

            <!-- Formatted date/time -->
            <template #item.when="{ item }">{{ formatEventDate(item) }}</template>

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
```

- [ ] **Step 4: Confirm the `<style scoped>` keeps `.scroll-content`**

`src/components/EventList.vue` `<style scoped>` must still contain:

```css
.scroll-content {
  flex: 1;
  overflow-y: auto;
}
```

(No other rules needed. `VHover` and its imports are no longer used — ensure no leftover unused imports/variables; `computed`, `ref`, `useStorage`, `dayjs`, `holidayImg`, `formatEventDate`, `storageKeys`, `nanoid`, `useNotificationCenterStore`, `EventForm`, and the `AppEvent` type all remain in use.)

- [ ] **Step 5: Type-check and lint**

Run: `yarn type-check`
Expected: prints `Done`. (If the `:headers` binding errors, the array shape matches `LogList`'s working `headers`; do not add `align` to headers.)

Run: `yarn lint`
Expected: `0 errors`, no `no-unused-vars` in `EventList.vue`.

- [ ] **Step 6: Browser check — Events page shell + table**

Navigate to `http://localhost:5173/events`. Confirm:
- Full-bleed glass card fills the viewport (like Tasks), content width-capped (not stretched edge to edge).
- Header: `Events` title left, `New Event` button right.
- Events render as a **table** with an avatar, title (+ description line where present), and the formatted date.
- Custom events show edit/delete buttons; holidays do not.
- Clicking `New Event` opens the modal; edit/delete on a custom event work; past events are dimmed.
- Console has no new errors.

Take a screenshot as proof.

- [ ] **Step 7: Commit**

```bash
git add src/views/EventView.vue src/components/EventList.vue
git commit -m "refactor(events): full-bleed shell and table layout"
```

---

## Task 3: Type + time filters

Add two `VBtnToggle` filters in the header (left of `New Event`) and wire them into `filteredEvents`, with an adaptive empty-state message.

**Files:**
- Modify: `src/components/EventList.vue` — filter state, rewritten `filteredEvents`, header toggles, empty-state message

**Interfaces:**
- Consumes: `events` (`AppEvent[]`), `isPastEvent(date)` from Task 2.
- Produces: none (terminal task).

- [ ] **Step 1: Add filter state and rewrite `filteredEvents`**

In `src/components/EventList.vue` `<script setup>`, replace the existing `filteredEvents` computed:

```typescript
// All events sorted chronologically
const filteredEvents = computed<AppEvent[]>(() => [...events.value].sort((a, b) => dayjs(a.date).diff(dayjs(b.date))));
```

with:

```typescript
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
```

Ensure `ref` is imported (it already is: `import { computed, ref } from 'vue';`).

- [ ] **Step 2: Add the toggles to the header, left of New Event**

In `src/components/EventList.vue` `<template>`, inside the header `<VToolbar>`, replace the block from `<VSpacer />` through the end of the `New Event` `<VTooltip>` with:

```html
          <VSpacer />

          <!-- Type filter -->
          <VBtnToggle v-model="typeFilter" density="compact" variant="outlined" divided mandatory class="me-2">
            <VBtn value="all" size="small">All</VBtn>
            <VBtn value="custom" size="small">Mine</VBtn>
            <VBtn value="holiday" size="small">Holidays</VBtn>
          </VBtnToggle>

          <!-- Time filter -->
          <VBtnToggle v-model="timeFilter" density="compact" variant="outlined" divided mandatory class="me-2">
            <VBtn value="upcoming" size="small">Upcoming</VBtn>
            <VBtn value="all" size="small">All</VBtn>
          </VBtnToggle>

          <VTooltip>
            <template #activator="{ props }">
              <VBtn prepend-icon="mdi-plus" color="primary" variant="tonal" @click="openAddModal" v-bind="props">
                New Event
              </VBtn>
            </template>
            Add event
          </VTooltip>
```

- [ ] **Step 3: Use the adaptive empty-state message**

In `src/components/EventList.vue` `<template>`, in the empty-state block, replace:

```html
          <div class="text-subtitle-1">No events</div>
```

with:

```html
          <div class="text-subtitle-1">{{ emptyMessage }}</div>
```

- [ ] **Step 4: Type-check and lint**

Run: `yarn type-check`
Expected: prints `Done`.

Run: `yarn lint`
Expected: `0 errors`.

- [ ] **Step 5: Browser check — filters**

Navigate to `http://localhost:5173/events`. Confirm:
- Header shows two toggle groups (`All / Mine / Holidays`, `Upcoming / All`) to the left of `New Event`. Defaults: `All` and `Upcoming` selected.
- `Mine` shows only custom events; `Holidays` shows only holidays; `All` shows both.
- `Upcoming` hides past events; switching the time toggle to `All` reveals past (dimmed) events.
- When a filter combination yields nothing, the empty state shows `No upcoming events` (time = Upcoming) or `No events` (time = All).
- Toggles are `mandatory` (one option always stays selected).
- Console has no new errors.

Take a screenshot showing the filters (e.g. `Mine` + `All`).

- [ ] **Step 6: Commit**

```bash
git add src/components/EventList.vue
git commit -m "feat(events): add type and time filters to the events table"
```

---

## Verification checklist (after all tasks)

- [ ] `yarn type-check` passes
- [ ] `yarn lint` passes (0 errors)
- [ ] `yarn build` passes
- [ ] Tasks page looks identical to before (shared-class retrofit was behavior-neutral)
- [ ] Events page is a full-bleed glass card with width-capped content, matching Tasks
- [ ] Events render as a table: avatar, title (+ description), formatted date
- [ ] Custom events have edit/delete; holidays are read-only
- [ ] Add / edit / delete still work via the `EventForm` modal
- [ ] Type filter (All / Mine / Holidays) and time filter (Upcoming / All) work
- [ ] Empty state adapts to the time filter
- [ ] Past events are dimmed
```
