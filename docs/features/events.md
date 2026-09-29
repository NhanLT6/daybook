# Events Feature

## Overview

Events are **markers** on the calendar: holidays, and custom things like "Sprint 42" or "Standup hosted by Sam".
They never notify, pop up, or remind — by design. The motivating case: the user and a coworker alternate
hosting the Tuesday daily standup (a biweekly repeat, with a skipped date when they swap), and sprint
start/end markers are planned next (a Mon→Fri range repeating every 2 weeks).

## Data Model

```
AppEvent   { id, title, date, endDate?, dates?, startTime?, endTime?, type, description?, repeat? }   ← IndexedDB via useEvents ('events')
RepeatRule { freq, interval, monthlyBy?, end?, skip? }                                               ← optional field on AppEvent
```

Interfaces: `src/interfaces/Event.ts`

- `date` / `endDate` / `dates` describe the **first occurrence**, in one of three shapes: a single day, a
  range (`endDate`), or separate days (`dates`, sorted, `dates[0] === date`, never together with `endDate`).
  Every later occurrence copies that shape (`atOccurrence`) and its `startTime`/`endTime`. No `repeat` =
  one-off event.
- **Which weekdays a weekly series hits comes from the picked days**, not from the rule — pick Mon, Tue, Fri in
  Multiple mode and "every week" repeats that set. Weekly/daily series shift each day by whole days;
  monthly/yearly keep each day's day-of-month.
- `RepeatRule` is a typed, friendly layer. **Never store raw RRULE strings**; `rrule` (npm) only does the date
  math inside `src/common/eventRecurrence.ts`.
- `monthlyBy` is monthly only, and nth/last weekday only applies to a single start day; undefined = `dayOfMonth`. `end` is `{ until }` (inclusive) or `{ count }`;
  undefined = never. `skip` holds occurrence **start** dates left out of the series.
- **Storage**: `repeat` and `dates` are optional fields on existing records, so there is **no IndexedDB version bump and no
  migration**; old events simply lack it. Backups carry it as-is (`useBackup` snapshots whole records).

## Where Logic Lives

| File | Role |
|---|---|
| `src/common/eventRecurrence.ts` | All date logic. Components never touch `rrule` or do their own recurrence math. |
| `src/common/__tests__/eventRecurrence.test.ts` | Unit tests for every function below. |
| `src/composables/useEvents.ts` | Thin wrapper over `useCollection<AppEvent>('events')` (add/remove/replaceAll). |
| `src/components/EventForm.vue` | Add/edit form: Single/Multiple/Range date picker, Repeat field, skipped-date chips. |
| `src/components/EventList.vue` | Events list: one row per series, "Skip next date" action. |
| `src/components/CalendarOverview.vue` | Calendar dots/markers; expands occurrences for the visible range only. |

`eventRecurrence.ts` exports:

- `getOccurrences(event, from, to)` — start dates overlapping the window, skips removed. Window-based work
  (calendar) uses this.
- `getNextOccurrence(event, from = today)` — first occurrence still running on/after `from`; `null` when over.
  Powers list rows and "Upcoming".
- `atOccurrence(event, date)` — copy of the event moved to an occurrence (shifts `endDate` / `dates` too), so
  existing date formatters/renderers work unchanged.
- `validateRepeat(event, rule)` — error string when an occurrence (range or picked days) would overlap the next
  one, else `''`.
- `describeRepeat(days, rule)` — the summary sentence ("Every 2 weeks on Monday and Friday, until Dec 31, 2026").
- `repeatPresets(event)` — the dropdown quick picks, **filtered to rules the event's shape allows** (no "every
  week" for a 12-day sprint); `isSameRule(a, b)` matches a stored rule back to a preset (ignores `skip`).
- `eventDays`, `spanDays`, `nthWeekdayOfMonth`, `isLastWeekdayOfMonth` — small helpers shared with the form.

## Event Form

Two **independent** choices:

1. **When one occurrence happens** — the date picker's Single / Multiple / Range toggle (Vuetify `VDatePicker`
   `multiple`: `false` / `true` / `'range'`), all-day or timed. Picker output is Date objects; the form stores
   `YYYY-MM-DD` strings.
2. **Repeat** — a pattern applied to that occurrence.

A range + repeat copies the range length to every occurrence: a sprint Mon→Fri of next week, every 2 weeks.

Repeat field:

- **Dropdown of presets** derived from the chosen date(s) (`repeatPresets`): every day, every week on <days>,
  every 2 weeks, monthly on the nth <weekday>, monthly on the last <weekday>, monthly on day(s) N, yearly. The
  "last <weekday>" preset is offered **only when the date is the last such weekday** of its month
  (`isLastWeekdayOfMonth`). Presets are recomputed when the dates change.
- **Custom…** panel: every N day/week/month/year (`VNumberInput`); day-of-month vs nth/last weekday (monthly,
  single start day); ends never / on date / after N times. It opens on a rule that fits the dates.
- The selected rule's summary (`describeRepeat`) shows in the Repeat field.
- `validateRepeat` blocks saving an occurrence longer than the gap between repeats.

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
  unbounded (`never` ends means infinite). Single and separately picked days get a dot each; **ranges only
  mark their first and last day** with dot-sized triangles pointing into the range, ▸ on the start and ◂ on the
  end ("Sprint starts" / "Sprint ends" popovers), so back-to-back sprints don't cover the calendar in dots.
  Half circles and brackets were tried and rejected: at 1× they blur into plain dots; a larger size or a
  bar looked out of place.
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
