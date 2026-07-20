# Project → Task Breakdown — Design

**Date:** 2026-07-20
**Status:** Approved (pending spec review)

## Problem

Selecting a project in Insights "Time by project" (or filtering the month chart to it)
shows only an aggregate — *this project took X hours*. There is no visibility into
**where** that time went. For a project with real sub-tasks (e.g. "Team work" → Daily
meeting, Grooming, code review, demo), the user wants to see the per-task split: how
many hours on code review vs meetings vs everything else.

### Background constraint

The app was originally built to feed Xero, which requires a task per log. As a result
**most projects have `task === project`** (the task field was filled with the project
name). These "simple" projects have no meaningful sub-tasks. Only a minority (like "Team
work") carry distinct tasks. The feature must stay quiet for simple projects and only
surface a breakdown where one actually exists.

## Data model (existing, unchanged)

`TimeLog { id, date, project, task, duration?, type, description? }` — `duration` is in
**minutes**. Task breakdown is derived from the existing `task` field; no schema change.

## Approach

A single shared composable owns the breakdown math. Two surfaces render it: the Insights
panel (inline expand) and the month bar chart (stack by task). Both consume the same
numbers, so they can never disagree.

### 1. Shared composable — `useTaskBreakdown`

New file: `src/composables/useTaskBreakdown.ts`

```ts
interface TaskBreakdownItem {
  task: string;
  minutes: number; // summed raw minutes for this task within the project
  pct: number;     // whole-number percent of the project total
}

interface TaskBreakdown {
  tasks: TaskBreakdownItem[]; // sorted desc by minutes
  distinctTaskCount: number;
  hasBreakdown: boolean;      // distinctTaskCount >= 2
}

function useTaskBreakdown(
  timeLogs: MaybeRefOrGetter<TimeLog[]>,
  project: MaybeRefOrGetter<string | null>,
): ComputedRef<TaskBreakdown>;
```

Rules:
- Filter `timeLogs` to `log.project === project`.
- Group by `task`, sum raw `duration` minutes per task (never round mid-sum — reuse the
  `sumMinutesToHours` discipline for any hour display).
- `pct = Math.round(taskMinutes / projectMinutes * 100)`.
- Sort tasks descending by minutes.
- `hasBreakdown = distinctTaskCount >= 2`. This is exactly the "simple project" rule:
  a project whose every log has `task === project` has `distinctTaskCount === 1`, so no
  breakdown appears.
- **No cap** on task count. Long lists scroll (Insights panel is already
  `overflow-y-auto`; the chart legend wraps/grows). No "Other" bucket.

### 2. Surface A — Insights inline expand

In `InsightsPanel.vue` "Time by project", when a project row is selected **and**
`hasBreakdown`, its task sub-rows appear beneath it, animated via Vuetify's
`<VExpandTransition>` (no custom expand component).

Each task sub-row (indented under the project row):
- shade dot (task color, see §4)
- task name, truncated at 16 chars (same `truncate` helper as project rows)
- hours as `minutesToHourWithMinutes` → e.g. `4h 42m` (Insights has horizontal space;
  keep the full h/m format, consistent with project rows)
- `(NN%)`
- a thin `VProgressLinear` bar (height 5), same as project rows

Simple project selected → nothing expands (behaves as today). Task rows are read-only in
v1 (informational; no further click-to-filter).

### 3. Surface B — month chart stacks by task

In `WorkTimeBarChart.vue`, the chart already branches on `props.selectedProject`:

- **No selection:** all-projects stacked view (+ invalid + remaining). Unchanged.
- **Project selected, `hasBreakdown` false (simple project):** current single-series
  filtered view. Unchanged.
- **Project selected, `hasBreakdown` true:** build **one dataset per task** (filtered to
  the project), stacked per day. Legend shows task names. Y-axis keeps `max: undefined`
  (scales to project hours, as today).

**Height behavior (explicitly verified in design):** stacking *partitions* the existing
bar; it does not add a dataset on top. The single project dataset (e.g. 6h) is
*replaced* by N task datasets that sum to the same 6h, so the total bar height is
preserved. The only difference is a ≤0.1h per-segment rounding shimmer (each task rounded
independently vs the aggregate rounded once) — sub-pixel on a 140px chart. **Decision:
accept the drift** (Option A). No apportionment; the user prefers seeing the real per-task
values over exact-but-adjusted numbers.

**Tooltip:** add a `label` callback so each segment reads `<task>: X.Xh` — **1-decimal
hours** (the tooltip is a narrow place; decimal keeps it compact and accurate, never
rounded to a whole number). Applies to the whole chart tooltip.

### 4. Task colors — `getTaskColors`

Add to `useProjectColors`:

```ts
getTaskColors(project: string, tasks: string[]): Record<string, string>;
```

Derive N shades from the project's base color by stepping **lightness** across the task
list (reusing the existing HSL/RGB helpers in the file), theme-aware. Shades read as "one
project, split into tones" and tie the task segments visually to the parent project.
Deterministic order = the composable's sorted task order, so the Insights dots and the
chart segments use matching colors.

## Components touched

| File | Change |
|------|--------|
| `src/composables/useTaskBreakdown.ts` | **new** — breakdown math |
| `src/composables/useProjectColors.ts` | add `getTaskColors` |
| `src/components/InsightsPanel.vue` | inline task sub-rows under selected project (VExpandTransition) |
| `src/components/WorkTimeBarChart.vue` | per-task stacked datasets when project has breakdown; decimal-hours tooltip label |

## Edge cases

- **Long task names** — truncated (list); legend uses Chart.js default handling.
- **Many tasks** — no cap; Insights scrolls, legend grows. (User's explicit call.)
- **Scope** — breakdown covers the currently displayed month (same `timeLogs` the
  surfaces already receive).
- **Rounding drift** — accepted ≤0.1h in chart height (Option A).

## Out of scope (v1)

- Clicking a task row to further filter the chart to a single task.
- Grouping/bucketing tasks into higher-level categories ("all meetings").
- Making the optional-task change to the logging form (the broader "tasks optional" goal
  the user mentioned) — separate future work.

## Testing

- Unit-test `useTaskBreakdown`: multi-task project → correct sorted split, pct, and
  `hasBreakdown === true`; single-task/`task===project` project → `hasBreakdown === false`;
  empty/no-project → empty tasks.
- Unit-test `getTaskColors`: returns one distinct shade per task, stable order.
- Manual: select "Team work" → Insights expands task rows, chart re-stacks by task at the
  same bar height; select a simple project → no expand, chart single series as before.
