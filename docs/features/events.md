# Events Feature

## Overview

Events are **markers** on the calendar: holidays, and custom things like "Sprint 42" or "Standup hosted by Sam".
They never notify, pop up, or remind — by design. The motivating case: the user and a coworker alternate
hosting the Tuesday daily standup (a biweekly repeat, with a skipped date when they swap), and sprint
start/end markers are planned next (a Mon→Fri range repeating every 2 weeks).

## Data Model

```
AppEvent   { id, title, date, endDate?, startTime?, endTime?, type, description?, repeat? }   ← IndexedDB via useEvents ('events')
RepeatRule { freq, interval, weekdays?, monthlyBy?, end?, skip? }                             ← optional field on AppEvent
```

Interfaces: `src/interfaces/Event.ts`

- `date` / `endDate` describe the **first occurrence**. Every later occurrence copies its length
  (`spanDays`) and its `startTime`/`endTime`. One-off events are unchanged: no `repeat` = single event.
- `RepeatRule` is a typed, friendly layer. **Never store raw RRULE strings**; `rrule` (npm) only does the date
  math inside `src/common/eventRecurrence.ts`.
- `weekdays` uses `dayjs().day()` numbering (0 = Sun … 6 = Sat), weekly only; undefined = start date's weekday.
  `monthlyBy` is monthly only; undefined = `dayOfMonth`. `end` is `{ until }` (inclusive) or `{ count }`;
  undefined = never. `skip` holds occurrence **start** dates left out of the series.
- **Storage**: `repeat` is an optional field on existing records, so there is **no IndexedDB version bump and no
  migration**; old events simply lack it. Backups carry it as-is (`useBackup` snapshots whole records).

## Where Logic Lives

| File | Role |
|---|---|
| `src/common/eventRecurrence.ts` | All date logic. Components never touch `rrule` or do their own recurrence math. |
| `src/common/__tests__/eventRecurrence.test.ts` | Unit tests for every function below. |
| `src/composables/useEvents.ts` | Thin wrapper over `useCollection<AppEvent>('events')` (add/remove/replaceAll). |
| `src/components/EventForm.vue` | Add/edit form: date choice, Repeat field, skipped-date chips. |
| `src/components/EventList.vue` | Events list: one row per series, "Skip next date" action. |
| `src/components/CalendarOverview.vue` | Calendar dots/markers; expands occurrences for the visible range only. |

`eventRecurrence.ts` exports:

- `getOccurrences(event, from, to)` — start dates overlapping the window, skips removed. Window-based work
  (calendar) uses this.
- `getNextOccurrence(event, from = today)` — first occurrence still running on/after `from`; `null` when over.
  Powers list rows and "Upcoming".
- `atOccurrence(event, date)` — copy of the event moved to an occurrence (shifts `endDate` too), so existing
  date formatters/renderers work unchanged.
- `validateRepeat(event, rule)` — error string when a range would overlap its next occurrence, else `''`.
- `describeRepeat(date, rule)` — the summary sentence ("Every 2 weeks on Tuesday, until Dec 31, 2026").
- `repeatPresets(date)` — the dropdown quick picks; `isSameRule(a, b)` matches a stored rule back to a preset
  (ignores `skip`, weekday order).
- `spanDays`, `nthWeekdayOfMonth`, `isLastWeekdayOfMonth` — small helpers shared with the form.

## Event Form

Two **independent** choices:

1. **When one occurrence happens** — single day or range (the existing Single/Range toggle), all-day or timed.
2. **Repeat** — a pattern applied to that occurrence.

A range + repeat copies the range length to every occurrence: a sprint Mon→Fri of next week, every 2 weeks.

Repeat field:

- **Dropdown of presets** derived from the chosen date (`repeatPresets`): every day, every week on <day>, every
  2 weeks, every weekday (Mon–Fri), monthly on the nth <weekday>, monthly on the last <weekday>, monthly on
  day N, yearly. The "last <weekday>" preset is offered **only when the date is the last such weekday** of its
  month (`isLastWeekdayOfMonth`). Presets are recomputed when the date changes.
- **Custom…** panel: every N day/week/month/year; weekday chips (weekly); day-of-month vs nth/last weekday
  (monthly); ends never / on date / after N times.
- A live summary (`describeRepeat`) shows under the field.
- For **ranges the weekday picker is hidden** and the start date's weekday is used (a multi-weekday range
  series makes no sense).
- `validateRepeat` blocks saving a range longer than the gap between repeats.

## Skipping

`repeat.skip` lists occurrence dates left out — swapping a Tuesday, holidays. Skipping only edits that array;
the rule is untouched.

- Events list: **Skip next date** action appends the next occurrence to `skip`.
- Edit form: skipped dates show as removable chips; removing one un-skips it.
- Skip dates match the occurrence's **start** date. Editing the rule so a skipped date is no longer an
  occurrence leaves a harmless dead entry.
- A skipped occurrence doesn't count toward `end.count` (rrule counts first, `skip` filters after) — a
  "10 times" series with one skip shows 9.

## Display

- **Events list**: a series is one row showing its next occurrence (`getNextOccurrence` + `atOccurrence`) plus
  the `describeRepeat` summary. "Upcoming" also uses the next occurrence, so a running series appears once.
- **Calendar**: expands occurrences only for the visible range (`getOccurrences`) — never enumerate a series
  unbounded (`never` ends means infinite).
- **Dot colours carry one meaning each**: `accent` (purple) = holiday, `info` (blue) = your own event; green
  (`primary`) is reserved for today/selected. Dots are styled with `rgb(var(--v-theme-…))` because v-calendar
  ignores hex values in `dot.color` (they all fell back to the theme green).

## Rules and Gotchas

- **Dates are `YYYY-MM-DD` strings.** For rrule each is mapped to **UTC midnight** (`toUtcDate`) and read back
  with `toISOString()` (`fromUtcDate`), so results don't depend on the viewer's timezone (rrule works on
  "floating" UTC dates). Don't pass local `Date`s in or use `dayjs().toDate()` on results.
- **Times never enter rrule.** Occurrences reuse the event's `startTime`/`endTime`.
- **Day-of-month rules skip months without that day** (RFC 5545): a rule on the 31st only fires in 31-day
  months; a Feb 29 yearly rule only in leap years. Not a bug; the summary says "on day 31".
- **Ranges reach into windows.** An occurrence that started before `from` but hasn't ended still counts in both
  `getOccurrences` and `getNextOccurrence` (they search from `from - span`).
- `getNextOccurrence` walks past skipped dates, capped at `MAX_SCAN` (500) consecutive skips, then returns
  `null`.
- `validateRepeat` only inspects the first 50 occurrences (`end` is replaced by `count: 50`).
- `interval` is clamped to an integer >= 1 and `count` to >= 1 in `toRRule`/`describeRepeat`; form validation
  should still keep the UI from producing them.

## What Is NOT Implemented

Deliberately out of scope; each can be added later **without changing stored data**:

- **Editing a single occurrence differently** ("this event only" overrides — a different time or title for one
  date).
- **Auto-skip on holidays.**
- **Notifications / reminders** — events stay passive markers.
