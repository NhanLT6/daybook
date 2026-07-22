# LogList Filters Feature

## Overview

The **Logs** panel (`LogList.vue`) has a filter bar: **Project**, **Task**, **Date range**, and **Search**. It lets you drill the current month's logs down to exact per-day hours — complementing the bar chart, which shows *where* time landed but not *how much on which day*.

The **Project** filter is shared two-way with the **Insights** panel and the **bar chart** via a single `selectedProject` ref in `HomeView`. Picking a project anywhere (Insights accordion, the LogList filter, or clearing it) updates all three at once. Task / Date range / Search are LogList-local.

When any filter is active, LogList auto-expands every surviving date panel so the detail is visible immediately.

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
| `src/views/HomeView.vue` | Owns `selectedProject`; wires it to Insights (`v-model`), LogList (`v-model`), chart (`:prop`); passes `:current-month` |
| `src/components/InsightsPanel.vue` | Writes `selectedProject` from its project accordion |
| `src/components/WorkTimeBarChart.vue` | Reads `selectedProject` to filter the chart dataset |
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

### Search — collapse/expand

Search is a magnify **button** (`variant="flat"`) that expands into a field:

- Click the button → `searchExpanded = true`, the button is `v-if`'d out, the field animates open (`.log-search__wrap` width 0 → 180px), and auto-focuses.
- Empty + focus leaves → collapses (button returns). Non-empty + focus leaves → stays open, so an active query stays visible.
- Clicking the magnify again (`toggleSearch`) collapses **and clears** the query.

**Gotchas (why the handlers look the way they do):**
- Collapse uses `@update:focused`, not `@blur` — native `blur` doesn't bubble on a Vuetify field, so `@blur` fires unreliably.
- The clear `×` uses an explicit `@click:clear="searchText = ''"` — Vuetify's built-in clearable emitted `click:clear` but did not reliably write our `v-model` ref for this plain/single-line field.

### Filter popup

- A funnel `VIconBtn` (`variant="flat"`) opens a `VMenu` (`:close-on-content-click="false"`) holding **Project**, **Task**, **Date range** selects (default *filled* variant, matching `BulkLogForm`) and a **Clear all** footer.
- A `VBadge` on the funnel shows `panelFilterCount` — **project + task + date range only** (search is excluded because it has its own always-visible field). Hidden at 0.
- **Clear all** resets all four filters *and* closes the popup (`isFilterMenuOpen = false`).

All toolbar buttons (search, filter, expand, collapse, import, export) use `variant="flat"` for a unified look.

## Panel Expansion

`openedPanels` has one ref but two disjoint drivers, coordinated by `hasActiveFilter` so they never compete (per the project's "single source of truth for state" rule):

- **Driver 1 — calendar selection** (`selectedDates`): expands the selected date(s) and scrolls to them. Yields (early-returns) whenever a filter is active.
- **Driver 2 — filters**: while active, expands *every* surviving date. On clearing the last filter, hands expansion back to the calendar selection.

`hasActiveFilter` = `panelFilterCount > 0 || searchText` — note this includes search (which the badge count does not).

## Testing

`e2e/logListFilters.spec.ts` seeds logs straight into localStorage (current month) for determinism and forces the lg+ viewport so Insights renders inline. Covered: search + clear, project filter + badge + Clear-all-closes-popup, task scoping, Insights→LogList sync.

Two Playwright notes for anyone extending it: scope combobox labels with `exact: true` (the clear icon's aria-label is e.g. "Clear Project"), and click the `.v-field` container rather than the `input` (the input is covered by `.v-field__input`, which intercepts pointer events).

## What Is NOT Implemented

- Cross-month date ranges (the list is one month at a time)
- A log/plan **type** filter (considered, dropped as YAGNI)
- Saved filter presets or URL persistence
- Date-range E2E coverage (VDatePicker cell-clicking is fragile; the range runs through the same `filteredItems` path the other filters test)
