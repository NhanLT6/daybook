# Insights Drawer (Small Screens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open the Home page's Insights panel on screens where it is hidden (`!lgAndUp`), via a contextual chart-icon toggle in the header dock that opens a right `VNavigationDrawer`.

**Architecture:** A singleton `useInsightsDrawer` composable holds one `isOpen` ref shared between `App.vue` (the toggle, in the header dock) and `HomeView` (the drawer, which has the panel's data). The toggle shows only on Home + `!lgAndUp`; the drawer renders only `!lgAndUp` so it never double-mounts with the inline panel.

**Tech Stack:** Vue 3 + TypeScript + Composition API, Vuetify 3 (`VNavigationDrawer`, `VIconBtn`, `useDisplay`), vue-router `useRoute`.

## Global Constraints

- **Package manager:** yarn (never npm).
- **Verification gates (no component unit-test runner in this repo):** every task ends with `yarn type-check` (prints `Done`), `yarn lint` (`0 errors`; pre-existing warnings in unrelated files are fine), and a **browser check** on the running dev server (http://localhost:5173). No unit tests to write.
- **Distinct icon:** the toggle uses `mdi-chart-box-outline` — it must NOT be a hamburger (`mdi-menu`), to stay visually distinct from the nav menu.
- **Scope:** toggle is Home-only (`route.path === '/'`) and small-screen-only (`!lgAndUp`). Inline `InsightsPanel` behavior (`lgAndUp`) is unchanged. `InsightsPanel.vue` is not modified.
- Commit after each task with the exact message given.

---

## Task 1: Shared composable + header dock toggle

Create the shared open-state composable and add the contextual toggle button to the dock. The drawer itself comes in Task 2, so at the end of this task the button appears/hides correctly and flips the shared state, but opens nothing visible yet.

**Files:**
- Create: `src/composables/useInsightsDrawer.ts`
- Modify: `src/App.vue` — add `lgAndUp`, import the composable, add the toggle button

**Interfaces:**
- Produces: `useInsightsDrawer()` returning `{ isOpen: Ref<boolean> }` (module-level singleton). Task 2 consumes it in `HomeView`.

- [ ] **Step 1: Create the composable**

Create `src/composables/useInsightsDrawer.ts` with exactly:

```typescript
import { ref } from 'vue';

// Module-level singleton so App.vue (the toggle) and HomeView (the drawer)
// share one open/close state without lifting Home's data up.
const isOpen = ref(false);

export function useInsightsDrawer() {
  return { isOpen };
}
```

- [ ] **Step 2: Wire the composable + `lgAndUp` in `App.vue`**

In `src/App.vue` `<script setup>`:

- Add an import (group it with the other `@/composables/*` imports near the top):

```typescript
import { useInsightsDrawer } from '@/composables/useInsightsDrawer';
```

- Change the `useDisplay()` destructure (currently `const { smAndDown } = useDisplay();`) to:

```typescript
const { smAndDown, lgAndUp } = useDisplay();
```

- Add, near the other composable/state setup (e.g. just after `const route = useRoute();`):

```typescript
const { isOpen: insightsDrawerOpen } = useInsightsDrawer();
```

- [ ] **Step 3: Add the toggle button to the dock**

In `src/App.vue` `<template>`, immediately AFTER the existing theme-toggle line:

```html
<VIconBtn :icon="themeIcon" size="small" variant="text" @click="toggleTheme" />
```

add:

```html
          <!-- Insights drawer toggle — Home only, small screens (inline panel hidden) -->
          <VIconBtn
            v-if="route.path === '/' && !lgAndUp"
            icon="mdi-chart-box-outline"
            size="small"
            variant="text"
            @click="insightsDrawerOpen = !insightsDrawerOpen"
          />
```

- [ ] **Step 4: Type-check and lint**

Run: `yarn type-check`
Expected: prints `Done`.

Run: `yarn lint`
Expected: `0 errors` (pre-existing warnings in other files are fine), no unused-var for `lgAndUp`/`insightsDrawerOpen`.

- [ ] **Step 5: Browser check — toggle visibility**

On the dev server:
- Home route `http://localhost:5173/` at a **narrow** viewport (resize to ~800px wide, i.e. `!lgAndUp`): the chart icon (`mdi-chart-box-outline`) appears in the dock, distinct from the hamburger.
- Home route at a **wide** viewport (≥1280px, `lgAndUp`): the chart icon is **absent** (inline panel shows instead).
- A non-Home route (e.g. `/task`) at narrow width: the chart icon is **absent**.
- Clicking the icon does not error (it flips `insightsDrawerOpen`; nothing visible yet — the drawer is Task 2). Confirm the console is clean.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useInsightsDrawer.ts src/App.vue
git commit -m "feat(insights): add shared drawer state and header toggle"
```

---

## Task 2: Right drawer in HomeView

Render the right `VNavigationDrawer` with `InsightsPanel` for small screens, bound to the shared state, and reset it closed on mount.

**Files:**
- Modify: `src/views/HomeView.vue` — import the composable, add the drawer, reset on mount

**Interfaces:**
- Consumes: `useInsightsDrawer()` `{ isOpen }` from Task 1; `InsightsPanel` (already imported), `timeLogs`, `currentMonth`, `selectedProject`, and `lgAndUp` (already present in HomeView).

- [ ] **Step 1: Import the composable and bind state in `HomeView.vue`**

In `src/views/HomeView.vue` `<script setup>`:

- Add an import (group with other `@/composables/*` imports):

```typescript
import { useInsightsDrawer } from '@/composables/useInsightsDrawer';
```

- Add near the other display/state setup (e.g. just after the `useDisplay()` line):

```typescript
const { isOpen: insightsDrawerOpen } = useInsightsDrawer();
```

- [ ] **Step 2: Reset the drawer closed on mount**

In `src/views/HomeView.vue`, the existing `onMounted` is:

```typescript
onMounted(() => {
  const off = onCatchUpView(() => {
    tab.value = 'ai';
  });
  onUnmounted(off);
});
```

Add a reset line as the first statement inside it:

```typescript
onMounted(() => {
  insightsDrawerOpen.value = false; // never auto-reopen when returning to Home
  const off = onCatchUpView(() => {
    tab.value = 'ai';
  });
  onUnmounted(off);
});
```

- [ ] **Step 3: Add the drawer to the template**

In `src/views/HomeView.vue` `<template>`, the inline panel is currently:

```html
    <!-- Right panel: Insights — visible on large screens only -->
    <InsightsPanel
      v-if="lgAndUp"
      class="insights-panel"
      :time-logs="timeLogs"
      :current-month="currentMonth"
      v-model:selected-project="selectedProject"
    />
  </div>
</template>
```

Replace that block with (adds the drawer for `!lgAndUp`, inside the `home-layout` div so it stays within the `VApp` layout):

```html
    <!-- Right panel: Insights — inline on large screens -->
    <InsightsPanel
      v-if="lgAndUp"
      class="insights-panel"
      :time-logs="timeLogs"
      :current-month="currentMonth"
      v-model:selected-project="selectedProject"
    />

    <!-- Small screens: same panel in an opt-in right drawer (toggled from the header) -->
    <VNavigationDrawer v-if="!lgAndUp" v-model="insightsDrawerOpen" location="right" temporary width="320">
      <InsightsPanel
        :time-logs="timeLogs"
        :current-month="currentMonth"
        v-model:selected-project="selectedProject"
      />
    </VNavigationDrawer>
  </div>
</template>
```

- [ ] **Step 4: Type-check and lint**

Run: `yarn type-check`
Expected: prints `Done`.

Run: `yarn lint`
Expected: `0 errors`, no unused-var in `HomeView.vue`.

- [ ] **Step 5: Browser check — full drawer flow**

On the dev server, Home route at a narrow viewport (~800px, `!lgAndUp`):
- Click the dock chart icon → a drawer slides in from the **right** with the Insights content, over a scrim.
- Interacting with the panel works (e.g. selecting a project updates `selectedProject`, reflected in the chart if visible).
- Clicking the scrim (or pressing Esc) closes the drawer.
- Resize to wide (`lgAndUp`): the drawer is gone and the inline Insights panel shows in the layout; resize back to narrow: inline gone, toggle available again.
- Navigate away (`/task`) and back to Home: the drawer is closed (not auto-reopened).
- Console is clean. If the drawer content is misaligned or not full height, adjust the drawer/panel height in `HomeView` (e.g. ensure the panel fills the drawer) — note any such tweak.

Take a screenshot of the open drawer as proof.

- [ ] **Step 6: Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(insights): right drawer for the insights panel on small screens"
```

---

## Verification checklist (after all tasks)

- [ ] `yarn type-check` passes
- [ ] `yarn lint` passes (0 errors)
- [ ] `yarn build` passes
- [ ] Toggle appears only on Home + `!lgAndUp`, with a distinct chart icon (not a hamburger)
- [ ] Toggle opens a right drawer containing the Insights panel
- [ ] Drawer closes on scrim click / Esc
- [ ] `lgAndUp` still shows the inline panel; no drawer, no toggle
- [ ] Returning to Home leaves the drawer closed
- [ ] Panel interactions (project selection) work inside the drawer
```
