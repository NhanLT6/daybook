# Insights Panel — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Overview

Add a fixed-width `InsightsPanel` component to the right column of the three-column home layout. The panel surfaces monthly time patterns that are not immediately visible from the chart or log list: total hours with month-over-month delta, logging habit, project distribution, and a synthesised focus signal.

All values are computed deterministically — no AI, no network calls.

---

## Layout Context

The panel occupies the existing `insights-panel` slot in `HomeView.vue` (320px fixed, `lgAndUp` only). `HomeView` already renders a placeholder `VCard` there; this spec replaces that placeholder with `InsightsPanel`.

`HomeView` passes two props already available in scope:
- `timeLogs: TimeLog[]` — current month's logs (reactive)
- `currentMonth: number` — 1-based month number

---

## Data & Computations

All logic lives inside `InsightsPanel.vue`. No new store.

| Signal | Computation |
|---|---|
| `totalMinutes` | `sumBy(timeLogs, 'duration')` |
| `lastMonthTotal` | Load `timeLogs-YYYY-MM` (prior month) via `useStorage`. Sum durations. |
| `delta` | `totalMinutes - lastMonthTotal`. Display as `+Xh Ym` / `-Xh Ym`. Omit when last month has no data. |
| `daysLogged` | `uniqBy(timeLogs, 'date').length` |
| `workdaysInMonth` | Count calendar days in `currentMonth` where `dayOfWeek` is not in `settingsStore.weekendDays` |
| `projectBreakdown` | Group by `project`, sum duration, sort descending, take top 6. Each entry: `{ project, minutes, pct }` |
| `uniqueProjectCount` | `projectBreakdown` total length (before top-6 slice) |
| `top2Pct` | `(top2Minutes / totalMinutes) * 100`, rounded to nearest integer |

Reuse existing utilities:
- `minutesToHourWithMinutes()` from `src/common/DateHelpers.ts`
- `useStorage` from `@vueuse/core`
- `settingsStore.weekendDays` from `src/stores/settings.ts`
- `useProjectColors()` composable for project color dots

---

## Visual Layout

```
┌─────────────────────────────────┐
│ Insights    May 2026            │
├─────────────────────────────────┤
│                                 │
│  84h 35m                        │
│  ↑ +8h vs last month            │
│                                 │
│  Days logged                    │
│  18 / 22 workdays               │
│  ████████████████░░░░           │  ← VProgressLinear
│                                 │
│  TIME BY PROJECT                │
│  ● DS-4151  ████████  18h  30%  │
│  ● DS-4270  ██████    11h  20%  │
│  ● DS-4149  █████      9h  16%  │
│  ● DS-4227  ████       6h  10%  │
│  ● DS-4237  ███        5h   9%  │
│  ● Team work██         3h   5%  │
│                                 │
│  ─────────────────────────────  │
│  8 tickets · top 2 took 50%     │
│  of your time                   │
└─────────────────────────────────┘
```

**Total hours block:**
- Large text for `totalMinutes` formatted as hours + minutes
- Small secondary line for delta (`↑ +8h vs last month`). Hidden when no prior month data.

**Days logged block:**
- Label + fraction (`18 / 22 workdays`)
- `VProgressLinear` showing `daysLogged / workdaysInMonth` as percentage
- Color: `primary` when ≥ 80%, `warning` when 50–79%, `error` below 50%

**Time by project block:**
- Section label `TIME BY PROJECT` in `text-overline` style
- Up to 6 rows. Each row:
  - Colored dot (from `useProjectColors`)
  - Project name truncated to ~16 chars with ellipsis
  - Proportional bar (`VProgressLinear`, width driven by `pct`)
  - Hours (`minutesToHourWithMinutes`)
  - Percentage (`XX%`)
- If more than 6 projects, show `+N more` label after the list

**Focus line:**
- Thin divider then one line: `{uniqueProjectCount} tickets · top 2 took {top2Pct}% of your time`
- Hidden when `uniqueProjectCount < 2`

---

## Component Structure

Single new file: `src/components/InsightsPanel.vue`

```
InsightsPanel.vue
  props: timeLogs, currentMonth
  internal: all computed (no emits needed)
  uses: useStorage, useSettingsStore, useProjectColors, minutesToHourWithMinutes, dayjs
```

`HomeView.vue` change: replace the placeholder `VCard` with `<InsightsPanel>` and pass props.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No logs this month | Total shows `0m`. Days logged `0 / N`. Project list empty. Focus line hidden. |
| No prior month data | Delta line hidden entirely. |
| Single project all month | Focus line hidden (`uniqueProjectCount < 2`). |
| Project name very long | Truncate at 16 chars with `…` |
| All workdays logged | Progress bar full, `primary` color |

---

## Out of Scope

- AI-generated analysis
- Billing target / pacing (no target data in app)
- Task-level breakdown (`task` field is redundant with `project` in current usage)
- Chart library migration (Chart.js stays; ApexCharts migration is a separate future task)
- Chart header stats (TODAY / THIS WEEK / DAILY AVG) — separate future task
- LogList project breakdown bar — deferred, decision pending
