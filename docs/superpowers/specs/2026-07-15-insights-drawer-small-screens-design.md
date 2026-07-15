# Insights Panel on Small Screens — Right Drawer (Design)

**Date:** 2026-07-15
**Status:** Approved — ready for implementation plan

## Goal

Give users a way to open the Home page's Insights panel on screens where it is
currently hidden. Today `InsightsPanel` only renders `lgAndUp`; below that it is
dropped entirely, with no way to reach it. Add an opt-in right-hand
`VNavigationDrawer` that surfaces the same panel on smaller screens, toggled by
a distinct icon in the app header dock.

Most users won't need it on small screens, so the panel stays hidden by
default and the toggle is contextual (Home only) — it must not clutter the
header elsewhere or read as a second navigation menu.

## Current State (baseline)

- `src/App.vue` — a centered glass "dock" in `VAppBar`: brand, `NotificationIsland`,
  a theme-toggle `VIconBtn`, desktop nav `VBtn`s (`d-none d-sm-flex`), and on
  `smAndDown` a hamburger `VMenu` (`mdi-menu`) that drops down the route list.
- `src/views/HomeView.vue` — three-column layout; `InsightsPanel` is rendered
  `v-if="lgAndUp"` with props `:time-logs="timeLogs"`, `:current-month="currentMonth"`,
  and `v-model:selected-project="selectedProject"`. `useDisplay()` provides
  `smAndDown` and `lgAndUp`.
- No `VNavigationDrawer` exists yet. `InsightsPanel` is only used on Home.

## The core problem this design solves

The toggle belongs in the app header (`App.vue`), but the panel's data
(`timeLogs`, `currentMonth`, `selectedProject`) lives in `HomeView`. The two
components must share the drawer's open/close state without moving Home's state
up. The "double hamburger" concern the user raised is avoided by (a) using a
semantically different icon (chart, not hamburger) and (b) scoping the toggle to
the Home route only.

## Design

### 1. Shared open state — `useInsightsDrawer` composable

Create `src/composables/useInsightsDrawer.ts` exporting a module-level singleton
`isOpen` ref (a plain composable, not Pinia — the state is ephemeral UI state and
this matches the existing `composables/` pattern):

```typescript
import { ref } from 'vue';

// Module-level singleton so App.vue (the toggle) and HomeView (the drawer)
// share one open/close state without lifting Home's data up.
const isOpen = ref(false);

export function useInsightsDrawer() {
  return { isOpen };
}
```

### 2. App.vue — dock toggle button

- Add a `VIconBtn` using `mdi-chart-box-outline` (clearly distinct from the
  `mdi-menu` hamburger, so it reads as "insights", not a second menu).
- Visible only when the user is on Home **and** the inline panel is hidden:
  `route.path === '/' && !lgAndUp`. `App.vue` already has `route`; add `lgAndUp`
  from `useDisplay()`.
- Click toggles `useInsightsDrawer().isOpen`.
- Placement: in the dock, adjacent to the existing theme-toggle icon (same
  `VIconBtn` styling).

### 3. HomeView.vue — right drawer

- Import `useInsightsDrawer` and bind its `isOpen`.
- Keep the inline `InsightsPanel` as `v-if="lgAndUp"` (unchanged).
- Add, rendered only when `!lgAndUp`:

  ```html
  <VNavigationDrawer v-model="isOpen" location="right" temporary width="320">
    <InsightsPanel
      :time-logs="timeLogs"
      :current-month="currentMonth"
      v-model:selected-project="selectedProject"
    />
  </VNavigationDrawer>
  ```

- Reset `isOpen = false` on mount so navigating away from Home and back does not
  auto-reopen the drawer.

### 4. Behavior & edge cases

- The two `InsightsPanel` usages are mutually exclusive by breakpoint
  (`lgAndUp` inline vs `!lgAndUp` drawer) — never both mounted, no double render.
- Resize `lg ↔ md`: the `v-if`/breakpoint swap unmounts the drawer on `lgAndUp`
  (inline takes over) and vice-versa. A drawer left open when resizing up simply
  unmounts; the inline panel shows.
- `temporary` drawer overlays content with a scrim and closes on scrim click /
  Esc (Vuetify default). `VApp` is its layout ancestor, so it positions
  correctly even though it is declared inside `HomeView`.
- The toggle never appears off the Home route, so it never competes with the nav
  hamburger elsewhere.

## Files

| File | Change |
|------|--------|
| `src/composables/useInsightsDrawer.ts` | Create — singleton `isOpen` ref. |
| `src/App.vue` | Add the contextual chart-icon toggle to the dock; add `lgAndUp`. |
| `src/views/HomeView.vue` | Add the right `VNavigationDrawer` with `InsightsPanel`; reset `isOpen` on mount. |
| `src/components/InsightsPanel.vue` | Untouched. |

## Decisions & Rationale

- **Distinct icon + Home-only scope** dissolves the double-hamburger worry: it's
  a menu plus an insights button, not two menus.
- **Singleton composable over Pinia**: ephemeral UI state, lighter than a store,
  consistent with `composables/`.
- **Drawer + data both in HomeView**: keeps Home's state where it is; only a
  boolean crosses the component boundary.
- **Keep the `lgAndUp` breakpoint**: smallest change; desktop behavior unchanged.

## Out of Scope

- Changes to `InsightsPanel` internals or its data.
- Persisting the drawer open state across reloads (it defaults closed).
- Adding insights access on non-Home routes (it only exists on Home).
