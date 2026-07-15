# Events Page — Table + Filters Rework (Design)

**Date:** 2026-07-15
**Status:** Approved — ready for implementation plan

## Goal

Rework the Events page for visual consistency with the Tasks page and to
present events as a **table** instead of a list. Add two lightweight filters
so the single table can serve both categories of event without splitting them
into tabs.

The Events page is intentionally a single combined view: most events are
predefined **holidays** (read-only reference data fetched from Calendarific);
the only events a user actively manages are their own **custom** events. A
single filtered table keeps the combined upcoming timeline visible while still
letting the user focus on one category when they want to.

## Current State (baseline)

- `EventView.vue` — thin wrapper: `<VContainer><EventList /></VContainer>`.
- `EventList.vue` — a `glass-acrylic` `VCard` with a sticky header, an empty
  state, and a `VList` of events. Add/edit/delete of custom events goes through
  the `EventForm.vue` modal (`VDialog`). Holidays are read-only (no actions).
- Data: unified `AppEvent[]` in the `events` localStorage key. Each event has
  `type: 'holiday' | 'custom'`, `date`, optional `endDate`/`startTime`/`endTime`,
  `title`, `description`. Chronological `formatEventDate()` helper already exists.
- The 2026-02-04 event-feature rework (Calendarific + unified `AppEvent`) is
  already implemented; this design builds on top of it.

## Design

### 1. Page shell — mirror the Tasks page

Apply the same full-bleed layout the Tasks page now uses (commit `3b6048c`):

- `EventView.vue`: replace the `VContainer` wrapper with a full-height layout
  div (full height, 12px padding) so the card fills the content area like
  Home/Tasks.
- `EventList.vue`: the root `glass-acrylic` card fills the height
  (`d-flex flex-column overflow-hidden`, `height: 100%`), with a full-width
  header and a scrollable body. Inside the body, a **width-capped inner
  container** (`max-width` ~900px) holds the table so content does not stretch
  across the wide card.

**Shared layout class:** Tasks and Events now share the same shell (full-height
page + width-capped inner). Extract the shared rules into reusable classes in
`src/assets/main.css` (e.g. `.page-fill` for the full-height 12px-padded
wrapper and `.page-inner` for the width cap) and use them in both `TaskView`
and `EventView`/`EventList`. This removes the duplication flagged during the
Tasks refactor. Home and Setting can adopt the same classes later (out of scope
here).

### 2. List → table

- Replace `VList` with `VDataTable` (consistent with the Tasks task lists and
  `LogList`), wrapped in a rounded `VCard` (`elevation-0 rounded-lg
  overflow-hidden`) so the corners clip cleanly — the established pattern.
- **Columns:**
  - **Type** — small avatar: holiday image for `holiday`, a custom icon for
    `custom` (reuse the current avatar rendering).
  - **Title** — event title, with the optional **description** as a muted
    second line beneath it (keeps the row compact, no separate column).
  - **When** — `formatEventDate(event)`.
  - **Actions** — edit / delete, **custom events only**, hover-revealed
    (current behavior). Holiday rows have no actions.
- **Past events:** dimmed row (`text-disabled`), current behavior kept.

### 3. Filters — in the header, left of "New Event"

The header is a single toolbar row: title on the left; on the right, the two
filters immediately to the **left of the New Event button** (no separate filter
bar — there are only two small controls).

- **Type filter** (`VBtnToggle`): `All` (default) · `My Events` · `Holidays`.
- **Time filter** (`VBtnToggle`): `Upcoming` (default — `date >= today`) ·
  `All` (include past events).

Header layout: `[ Events title ] … spacer … [ Type toggle ] [ Time toggle ] [ + New Event ]`.

### 4. Behavior

- A single `filteredEvents` computed applies both filters, sorted
  chronologically ascending (soonest first).
  - Type: `All` → both; `My Events` → `type === 'custom'`; `Holidays` →
    `type === 'holiday'`.
  - Time: `Upcoming` → `dayjs(date).isSameOrAfter(today, 'day')`; `All` → no
    date filter.
- Empty state adapts to the active filter (e.g. "No upcoming events" vs
  "No events").
- Add/edit/delete flow is **unchanged** — `EventForm.vue` modal stays as-is.

## Files

| File | Change |
|------|--------|
| `src/views/EventView.vue` | Replace `VContainer` with the full-bleed layout wrapper (shared class). |
| `src/components/EventList.vue` | Full-height card + inner container; `VList` → `VDataTable` in a rounded card; header with two filters + New Event; `filteredEvents` applies type + time filters. |
| `src/assets/main.css` | Add shared `.page-fill` / `.page-inner` layout classes. |
| `src/views/TaskView.vue` | Adopt the shared layout classes (replace the local `.tasks-layout` / `.tasks-inner` rules) to remove duplication. |
| `src/components/EventForm.vue` | Untouched. |

## Decisions & Rationale

- **Single table + filters over tabs:** keeps the combined upcoming timeline
  visible; filters give focus on demand without a new tab paradigm. Mirrors the
  app's preference for one scrollable card.
- **Filters in the header:** only two small controls, so a dedicated filter bar
  would be heavier than warranted.
- **Description as a muted second line:** avoids a wide, mostly-empty column
  (holidays rarely have descriptions).
- **Reuse LogList/Tasks table + card patterns:** consistency and corner
  clipping for free.

## Out of Scope

- Changes to holiday fetching / Calendarific integration.
- Changes to the `EventForm` modal.
- Retrofitting Home/Setting pages to the shared layout classes.
- Calendar (`CalendarOverview`) changes.
