# LogList Filters Feature

## Overview

The **Logs** section (`LogList.vue`) has a filter bar: **Project**, **Task**, **Date range**, and **Search**. It lets you drill the current month's logs down to exact per-day hours — complementing the bar chart, which shows *where* time landed but not *how much on which day*.

The **Project** filter is shared two-way with the **Insights** panel and the **bar chart** via a single `selectedProject` ref in `HomeView`. Picking a project anywhere (Insights accordion, the LogList filter, or clearing it) updates all three at once. Task / Date range / Search are LogList-local.

When any filter is active, LogList auto-expands every surviving date panel so the detail is visible immediately.

The Insights **Overview** card also lists past workdays with nothing logged ("Not logged") as chips (first 8, then a "+N more" chip that expands). Clicking a chip toggles that date in `HomeView.selectedDates` exactly like a calendar click (replaces it while editing a log), switches to the Form tab and closes the Insights drawer on small screens. Chips are neutral grey (tonal) and turn green once picked: the gaps inform without asking for attention. `CalendarOverview` moves to a newly added date that is outside the visible range.

The rest of the Overview compares **at the same point**, never a partial period against a whole one: this week so far vs the same days last week (current month only), and the viewed month so far vs the previous month up to the same day (a past month is compared in full, by name), plus average per logged day. Each is one line — value and delta, with the compared dates in the delta's tooltip. Deltas stay neutral in colour — more hours isn't better by itself. Workdays exclude Settings weekend days and holiday events (`useWorkCalendar`); plan entries (no duration) don't count as logged. Rows are separated by space, not dividers.

## Data Flow

```
HomeView.selectedProject (ref)
  ├── v-model → InsightsPanel   (accordion writes it)
  ├── v-model → LogList         (Project select writes it; filters the list)
  └── :prop   → WorkTimeBarChart (reads it; swaps chart dataset)
```

`selectedProject` is the single source of truth (a `defineModel` in LogList). The other three filters are local refs in LogList: `selectedTask`, `searchText`, `dateRangeModel`.

## Key Files

| File | Role |
|------|------|
| `src/components/LogList.vue` | Filter bar UI, `filteredItems` pipeline, panel-expansion logic |
| `src/views/HomeView.vue` | Owns `selectedProject`; wires it to Insights (`v-model`), LogList (`v-model`), chart (`:prop`); passes `:current-month`; owns the shared chart + logs card, the remembered `chartCollapsed` state and the Insights column transition |
| `src/components/InsightsPanel.vue` | Writes `selectedProject` from its project accordion |
| `src/components/WorkTimeBarChart.vue` | Reads `selectedProject` to filter the chart dataset; renders the card header (month, today / this week, an `actions` slot for the Insights toggle) |
| `e2e/logListFilters.spec.ts` | Playwright coverage (search, project, task, Insights sync) |

## Filtering

`filteredItems` is a computed applied over the month's `items` in order:

1. **Project** — `log.project === selectedProject`
2. **Task** — `log.task === selectedTask`
3. **Date range** — `log.date` within `[from, to]` (see clamping below)
4. **Search** — case-insensitive substring across `project` / `task` / `description`

`loggedTimeByDates` groups `filteredItems` (not the raw props), so week-grouping, totals, and the empty state all follow the filter. Empty result → "No logs match filters" (vs "No data" when the month is genuinely empty).

### Options

- `projectOptions` — distinct projects present in the current month's logs.
- `taskOptions` — tasks within `selectedProject` (all tasks when no project chosen). `selectedTask` resets whenever `selectedProject` changes (a task belongs to a project).

### Date range

- A `VDatePicker` in `multiple="range"` mode, clamped with `:min`/`:max` to the current month (`monthMin`/`monthMax`). The list only holds one month's logs, so cross-month ranges are out of scope.
- `dateRangeModel` resets when the `currentMonth` prop changes (the range is month-scoped).

## UI

### Layout (desktop)

On desktop the chart and the logs are **one glass card** in `HomeView`: `WorkTimeBarChart` is the card's top section and `LogList` the rest. Neither component renders a card of its own; on mobile `HomeView` wraps `LogList` alone in the card (`MobileWeekChart` sits above it) and passes `has-chart=false`.

- **Header** (`WorkTimeBarChart`): month title + "Hours logged per day · stacked by project", today / this-week stats (current month only), then whatever the parent puts in the `actions` slot — Home puts the **Insights toggle** there (see below).
- **Chart**: no nested inner card. Its wrapper animates `height` to 0 when `collapsed`; the canvas keeps a fixed height inside, so Chart.js never redraws squashed bars mid-animation.
- **Toolbar** (`LogList`), framed by hairlines: **Logs** + the filtered count, the always-visible search, the project filter button, the chart toggle (only with `has-chart`; `v-model:chart-collapsed`, remembered in localStorage under `homeChartCollapsed`) and a **⋯** menu with Expand all days / Collapse all days / Import CSV / Export CSV. Import clicks a hidden `<input type="file">`, reset after each pick so the same file can be imported again.

### Insights toggle

The toggle sits at the right end of the card header and is always visible on Home desktop. One button for both modes (`useInsightsDrawer().toggle`): at ≥ `INSIGHTS_INLINE_MIN` (1440px) it shows/hides the inline column (remembered per device), below it opens the right drawer. The icon is `mdi-chevron-double-right` while Insights is shown (pointing where the panel goes) and rotates 180° when it is hidden. On small screens the hamburger menu keeps its own Insights item.

The inline column animates with `VExpandXTransition` on a `.insights-wrap` wrapper: only the wrapper's width changes (0.45s, `cubic-bezier(.32,.72,0,1)`, overriding Vuetify's 0.3s default with a two-class `!important` rule). `InsightsPanel` inside keeps a fixed 320px width and is pinned to the wrapper's right edge, so its content never reflows while the center card grows or shrinks; it also fades and slides 24px. The wrapper carries the 12px gap as the panel's margin (and cancels the layout's flex gap with `margin-left: -12px`), so no stray gap is left at width 0.

### Search

An always-visible compact field (`placeholder="Search logs"`, `.log-search__field`). Its clear `×` uses an explicit `@click:clear="searchText = ''"` — Vuetify's built-in clearable emitted `click:clear` but did not reliably write our `v-model` ref for this single-line field.

### Filter popup

- The project filter button (funnel icon, label = the focused project or "All projects"; label hidden on phones) opens a `VMenu` (`:close-on-content-click="false"`) holding **Project**, **Task**, **Date range** selects (default *filled* variant, matching `BulkLogForm`) and a **Clear all** footer.
- A `VBadge` on the button shows `panelFilterCount` — **project + task + date range only** (search is excluded because it has its own always-visible field). Hidden at 0.
- **Clear all** resets all four filters *and* closes the popup (`isFilterMenuOpen = false`).

## Panel Expansion

`openedPanels` has one ref but two disjoint drivers, coordinated by `hasActiveFilter` so they never compete (per the project's "single source of truth for state" rule):

- **Driver 1 — calendar selection** (`selectedDates`): expands the selected date(s) and scrolls to them. Yields (early-returns) whenever a filter is active.
- **Driver 2 — filters**: while active, expands *every* surviving date. On clearing the last filter, hands expansion back to the calendar selection.

`hasActiveFilter` = `panelFilterCount > 0 || searchText` — note this includes search (which the badge count does not).

## Testing

`e2e/logListFilters.spec.ts` seeds logs straight into localStorage (current month) for determinism and forces a 1440px viewport so Insights renders inline. Covered: search + clear, project filter + badge + Clear-all-closes-popup, task scoping, Insights→LogList sync.

Two Playwright notes for anyone extending it: scope combobox labels with `exact: true` (the clear icon's aria-label is e.g. "Clear Project"), and click the `.v-field` container rather than the `input` (the input is covered by `.v-field__input`, which intercepts pointer events).

## What Is NOT Implemented

- Cross-month date ranges (the list is one month at a time)
- A log/plan **type** filter (considered, dropped as YAGNI)
- Saved filter presets or URL persistence
- Date-range E2E coverage (VDatePicker cell-clicking is fragile; the range runs through the same `filteredItems` path the other filters test)
