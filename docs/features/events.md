# Events Feature

## Overview

Events are **markers** on the calendar: holidays, and custom things like "Sprint 42" or "Standup hosted by Sam".
They never notify, pop up, or remind — by design. The motivating case: the user and a coworker alternate
hosting the Tuesday daily standup (a biweekly repeat, with a skipped date when they swap), and sprint
start/end markers are planned next (a Mon→Fri range repeating every 2 weeks).

## Data Model

```
AppEvent   { id, title, date, endDate?, dates?, startTime?, endTime?, type, description?, repeat? }   ← IndexedDB via useEvents ('events')
RepeatRule { freq, interval, monthlyOn?, onNonWorkday?, end?, skip? }                               ← optional field on AppEvent
WorkCalendar { weekendDays, holidays }                                                               ← derived live, never stored
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
- `monthlyOn` (monthly only) = "the `nth` `day` of each month": `nth` 1–4 or -1 (last); `day` = `'day'` (any
  day, so `{ -1, 'day' }` is the last day and follows month length), `'workday'` (see Work Days), or a weekday
  number (0 = Sunday). It doesn't depend on the start date. Undefined = the start date's day of month. Not for
  separately picked days (they repeat by their own days of month).
- `onNonWorkday` (single-day events only) = what happens when an occurrence lands on a weekend day or holiday:
  `'skip'`, `'before'` / `'after'` (move to the nearest work day, up to `MAX_SHIFT` = 31 days). Undefined = kept.
- **Legacy `monthlyBy`** (`nthWeekday` / `lastWeekday` / `lastWorkday`, saved before `monthlyOn`) is read only:
  `normalizeRule(rule, date)` converts it using the start date (a 5th weekday becomes the last). Every
  `eventRecurrence` entry point normalizes first, and the form normalizes on open, so a legacy event is
  rewritten in the new shape the next time it's saved. No migration needed.
- `end` is `{ until }` (inclusive) or `{ count }`;
  undefined = never. `skip` holds occurrence **start** dates left out of the series.
- **Storage**: `repeat` and `dates` are optional fields on existing records, so there is **no IndexedDB version bump and no
  migration**; old events simply lack it. Backups carry it as-is (`useBackup` snapshots whole records).

## Where Logic Lives

| File | Role |
|---|---|
| `src/common/eventRecurrence.ts` | All date logic. Components never touch `rrule` or do their own recurrence math. |
| `src/common/__tests__/eventRecurrence.test.ts` | Unit tests for every function below. |
| `src/composables/useEvents.ts` | Thin wrapper over `useCollection<AppEvent>('events')` (add/remove/replaceAll). |
| `src/composables/useWorkCalendar.ts` | `WorkCalendar` from Settings weekend days + every day covered by a holiday event. Also used by Insights for workday counts. |
| `src/views/EventView.vue` | Events page: calendar column + list; owns the day / event selection. |
| `src/components/EventForm.vue` | Add/edit form: Single/Multiple/Range date picker, Repeat field, skipped-date chips. |
| `src/components/EventList.vue` | Events list: one row per series, "Skip next date" action, highlights rows for the calendar selection. |
| `src/components/CalendarOverview.vue` | Calendar dots/markers; expands occurrences for the visible range only. Shared with Home's log form. |

`eventRecurrence.ts` exports:

- `getOccurrences(event, from, to, workCalendar?)` — start dates overlapping the window, skips removed.
  Window-based work (calendar) uses this.
- `getNextOccurrence(event, from = today, workCalendar?)` — first occurrence still running on/after `from`;
  `null` when over. Powers list rows and "Upcoming".
- Both take the `WorkCalendar` for work-day positions and `onNonWorkday`; callers in the UI pass
  `useWorkCalendar()`. Without it they assume a Sat–Sun weekend and no holidays (tests, validation).
  `getNextOccurrence` searches a year at a time, up to `MAX_YEARS` (50), stopping early past a series' end.
- `atOccurrence(event, date)` — copy of the event moved to an occurrence (shifts `endDate` / `dates` too), so
  existing date formatters/renderers work unchanged.
- `validateRepeat(event, rule)` — error string when an occurrence (range or picked days) would overlap the next
  one, else `''`.
- `describeRepeat(days, rule)` — the summary sentence ("Every 2 weeks on Monday and Friday, until Dec 31, 2026").
- `repeatPresets(event, weekendDays?)` — the dropdown quick picks, **filtered to rules the event's shape allows**
  (no "every week" for a 12-day sprint); `isSameRule(a, b)` matches a stored rule back to a preset (ignores `skip`).
- `backToBackRule(event, weekendDays?)` — the "When it ends" rule for a range (see below); null otherwise.
- `normalizeRule(rule, date)` — converts a legacy `monthlyBy` (see Data Model).
- `nthWorkdayOfMonth(date, nth, workCalendar?)` — the month's nth / last work day, or `null` if it has fewer.
- `describeNth`, `describeDayKind` — the words the form's position selects use.
- `eventDays`, `spanDays`, `nthWeekdayOfMonth`, `isLastWeekdayOfMonth` — small helpers shared with the form.

## Work Days

"The last work day" is for month-end chores: syncing logs to Xero, giving Bonusly points. A plain "last day of
the month" lands on weekends, so it was dropped as an option of its own (it's still `{ nth: -1, day: 'day' }`).

- **Work day** = not a Settings weekend day and not covered by a `holiday` event, so Reunification Day (Fri Apr
  30 2027) moves April's last work day to Thu Apr 29. rrule can't know holidays, so:
  - **Work-day positions** (`monthlyOn.day === 'workday'`) are walked month by month (`workdayStarts`)
    instead of going through `toRRule`. The start date only bounds the series: the first occurrence is the first
    match on or after `date`. `end.count` counts from the series start, like rrule.
  - **`onNonWorkday`** runs after rrule (`shiftOffDay`): each raw start is kept, dropped, or moved. The search
    window is padded by `MAX_SHIFT` so a date moved into the window from just outside is found. Moving keeps the
    order (dates collapsing onto one work day are deduped). `skip` matches the **moved** date, which is what the
    user sees and what "Skip next date" stores. `end.count` counts raw starts, so a skipped day-off still counts.
- **Read live, never stored.** The work calendar isn't saved on the rule: a series follows holidays fetched
  later and weekend changes. Dates far ahead may shift once that year's holidays are fetched.
- **The start date stays the first occurrence.** For any `monthlyOn` rule the form moves the start (and a
  range's end, keeping its length) to the first occurrence on or after the picked day (`seriesStart`), when
  the rule is picked and again on save. Other rules keep the picked date, since they take their day from it — so
  with `onNonWorkday` the stored `date` can be a day off whose occurrence was moved.

## Event Form

Two **independent** choices:

1. **When one occurrence happens** — the date picker's Single / Multiple / Range toggle (Vuetify `VDatePicker`
   `multiple`: `false` / `true` / `'range'`), all-day or timed. Picker output is Date objects; the form stores
   `YYYY-MM-DD` strings. In range mode the picker's model is **every day** from start to end (what Vuetify
   itself emits; it highlights only the days in its model), or `[date, date]` before an end is picked — a
   single entry would read as a half-picked range, and the next click would end it at the old date. The
   picker starts the week on the Settings first day of week, like the calendar.
2. **Repeat** — a pattern applied to that occurrence.

A range + repeat copies the range length to every occurrence: a sprint Mon→Fri of next week, every 2 weeks.

Repeat field:

- **Dropdown of presets** derived from the chosen date(s) (`repeatPresets`): every day, every week on <days>,
  every 2 weeks, monthly on the nth <weekday> (1st–4th), monthly on the last <weekday>, monthly on day(s) N,
  monthly on the last work day, yearly. The
  "last <weekday>" preset is offered **only when the date is the last such weekday** of its month
  (`isLastWeekdayOfMonth`); the last work day for any single day, not a range (the start moves to it). The first of a month
  needs no preset of its own: "day 1" reads "on the first day". Presets are recomputed when the dates change.
- **Grouped** under subheaders — Back to back, Daily & weekly, Monthly, Yearly — with Custom… after a divider.
  `VSelect` renders `{ type: 'subheader' | 'divider' }` items itself; the group comes from each preset's `freq`
  (`presetGroup` in the form), relying on `repeatPresets` listing them in that order.
- **Next dates preview**: the field's hint lists the next three occurrences from today (or the start, if later),
  so a rule — especially a work-day one that dodges weekends and holidays — can be checked before saving.
- **When it ends (…)** — ranges only, listed first: the next occurrence starts once this one ends (sprints).
  Stored as a **plain rule, no new field**: the same weekday N weeks later when only weekend days lie
  between (Mon→Fri 2-week sprint → every 2 weeks; weekend = the Settings weekend days, so a Mon→Thu sprint
  also restarts Monday under the default Fri–Sun weekend), else every `length` days (a Wed→Mon range restarts
  Tuesday). It replaces the plain preset for the same rule. While picked, `followsRangeEnd` makes the form
  recompute the rule as the range is edited (a mid-pick moment with no end date keeps the last rule); a saved
  event whose rule matches reopens with it on. Picking anything else, or Custom, turns it off.
- **Custom…** panel, the place for anything the presets don't cover:
  - every N day/week/month/year (`VNumberInput`);
  - monthly (not for separately picked days): **On day N** (the start date's) or **On the [first … fourth /
    last] [day / work day / Monday … Sunday]** — radios, with the two selects beside the second radio (inside its
    label they'd lose their clicks to it). Switching to the position starts from the picked day's own
    (e.g. the second Tuesday);
  - **On a weekend or holiday**: keep it / skip it / move to the work day before / after — single days only, and
    hidden for a work-day position, which never lands on a day off;
  - ends never / on date / after N times.

  It opens on a rule that fits the dates.
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

- **Events page** (`EventView`): a fixed 340px calendar column (`CalendarOverview`) left of the list; below
  `md` the calendar stacks on top and the page scrolls. It opens on the month view, remembered under its own key
  (`viewStorageKey` / `defaultView` props) so it doesn't change Home's week/month choice.
- **Calendar ↔ list selection**, one at a time (picking one clears the other, held in `EventView`):
  - Pick a day → every listed event with an occurrence on that day gets the green row tint, and the first is
    scrolled into view. A series row stays one row, still showing its next date.
  - Click a row → its occurrences in view get a light green highlight (`highlightEvent` prop; a range is one
    span) and the calendar moves to the next occurrence (or the first date once over) if it's off screen.
    Clicking the row again clears it. The row's action buttons stop the click.
  - Green is the selection colour on both sides, matching the calendar's selected day; dots keep their
    holiday/event colours.
- **Events list**: a series is one row showing its next occurrence (`getNextOccurrence` + `atOccurrence`) plus
  the `describeRepeat` summary. "Upcoming" also uses the next occurrence, so a running series appears once.
- **Calendar**: expands occurrences only for the visible range (`getOccurrences`) — never enumerate a series
  unbounded (`never` ends means infinite). Single and separately picked days get a dot each; **ranges only
  mark their first and last day** with dot-sized triangles pointing into the range, ▸ on the start and ◂ on the
  end ("Sprint starts" / "Sprint ends" popovers), so back-to-back sprints don't cover the calendar in dots.
  Half circles and brackets were tried and rejected: at 1× they blur into plain dots; a larger size or a
  bar looked out of place.
- **Adjacent months' days** are shown, dimmed to 0.5 and clickable, in both the calendar and every
  `VDatePicker` (global `showAdjacentMonths` default in `main.ts`). v-calendar has no prop for it — it hides
  them with `.vc-monthly .is-not-in-month * { opacity: 0 }`, which `CalendarOverview` overrides. Markers on
  those days already work: `visibleRange` spans the whole grid (`viewDays`). In e2e, scope day buttons to
  `.v-date-picker-month__day:not(.v-date-picker-month__day--adjacent)`: while the picker slides months, the
  outgoing grid holds the same date as an adjacent day.
- **Dot colours carry one meaning each**: `accent` (purple) = holiday, `info` (blue) = your own event; green
  (`primary`) is reserved for today/selected. Dots are styled with `rgb(var(--v-theme-…))` because v-calendar
  ignores hex values in `dot.color` (they all fell back to the theme green).
- **Hover popover**: v-calendar's default popover indicator is always a blue circle (it ignores the dot's style
  and class), so `CalendarOverview` supplies its own `#day-popover` slot and draws the marker from the
  attribute's `customData` (`color`, `shape`) — a triangle for range edges, a circle otherwise.

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
- **Notifications / reminders** — events stay passive markers.
