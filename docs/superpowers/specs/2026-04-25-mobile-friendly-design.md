# Mobile-Friendly UI — Design Spec

**Date:** 2026-04-25
**Scope:** All four views (Home, Tasks, Events, Settings)
**Constraint:** Desktop layout and behavior must remain 100% unchanged.

---

## Problem

On narrow screens (≤ ~600px):

1. **App bar nav overflow** — `VAppBar` renders the title, theme-toggle icon, and four nav buttons inline. The rightmost button ("Settings") is clipped.
2. **WorkTimeBarChart** — Full month bar chart with stacked patterns is too dense and tall for mobile. Not readable.
3. **Card header clips** — Action buttons in `LogList` and `TaskView` card headers overflow their containers on narrow screens.

---

## Decision: Desktop unchanged, mobile-only fixes

All three fixes activate only at `≤ 959px` (Vuetify's `smAndDown` breakpoint, matching the existing `HomeView` mobile media query). Desktop code paths are untouched.

---

## Fix 1 — App Bar: Scrollable Nav Row

**File:** `src/App.vue`

**Approach:** Scrollable top tabs (Option C).

- Wrap the four `VBtn` nav items in a horizontally scrollable container on mobile.
- Use `overflow-x: auto` with `white-space: nowrap` and hidden scrollbar.
- The `VAppBarTitle` ("Daybook") and theme-toggle icon stay in the top bar as-is.
- No routing, state, or component logic changes.

**Result:**

```
[ 📖 Daybook ]  [🌙]
[ Home | Tasks | Events | Settings → ]   ← scrollable row below title
```

On desktop: the nav buttons stay inline in the `VAppBar` as today.

---

## Fix 2 — Chart: MobileWeekChart Component

**New file:** `src/components/MobileWeekChart.vue`

**Approach:** Compact "one-line strip" stacked bar chart for the current week.

### Appearance

- Height: ~56px total (chart strip + day labels).
- Seven columns (Mon–Sun), each a stacked block of project-color segments proportional to hours logged that day.
- Empty days show a faint placeholder bar.
- Day labels (M T W T F S S) below each column. Today's column is subtly highlighted.
- Project color matches the existing `useProjectColors()` composable — same palette as everywhere else.
- No chart.js — pure CSS flexbox, no canvas needed at this scale.

### Data & Navigation

- **Props:** `timeLogs: TimeLog[]`, `selectedDates: Date[]`, `currentMonth: number`
- **Derived week:** Use `selectedDates[0]` only when it falls within `currentMonth`; otherwise fall back to the week containing today (or the first week of `currentMonth` if today is a different month). This avoids showing a stale/empty week when the user navigates months without clearing their selection.
- **No new navigation buttons.** The user navigates via the calendar in the form:
  - Clicking a date in the current month → `selectedDates` updates → chart moves to that week.
  - Navigating months in the calendar → `currentMonth` updates → chart recalculates the active week per the rule above.

### Integration in HomeView

```html
<!-- mobile only -->
<MobileWeekChart
  v-if="isMobile"
  :time-logs="timeLogs"
  :selected-dates="selectedDates"
  :current-month="currentMonth"
  class="flex-shrink-0"
/>

<!-- desktop only (unchanged) -->
<WorkTimeBarChart v-else :current-month="currentMonth" class="flex-shrink-0" />
```

`isMobile` is derived from Vuetify's `useDisplay().smAndDown`.

---

## Fix 3 — Card Header Clips: Icon-Only Buttons on Mobile

**Files:** `src/components/LogList.vue`, `src/views/TaskView.vue`

**Approach:** Button text is hidden on mobile via a responsive CSS class; icons remain visible.

### LogList header buttons

Affected buttons: Expand all / Collapse all (icon-only already), Import, Export.

- `Import` and `Export` buttons: add `d-none d-sm-inline` to the button text `<span>` so text hides below `sm` breakpoint, icon stays.

### TaskView header buttons

Affected buttons: "New Category" (categories mode), "New Project".

- Same pattern: hide button text `<span>` on mobile, keep the `prepend-icon`.

**Result:** Buttons become compact icon-only on mobile, full text+icon on desktop. No logic changes.

---

## Files Changed

| File                                 | Change                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| `src/App.vue`                        | Mobile scrollable nav row                                |
| `src/components/MobileWeekChart.vue` | New component                                            |
| `src/views/HomeView.vue`             | Conditional chart render, pass `selectedDates` to charts |
| `src/components/LogList.vue`         | Hide button text on mobile                               |
| `src/views/TaskView.vue`             | Hide button text on mobile                               |

---

## Out of Scope

- Bottom navigation bar (decided against — too much change, sticky form interaction).
- Replacing the chart on desktop.
- Changes to Events or Settings page layouts (no reported issues; apply button-text fix if same pattern exists).
- Virtual/windowed rendering for the log list on mobile.
