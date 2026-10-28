# Daily target & log-form shortcuts

## Daily target (Settings → Date & Calendar)

How many hours a workday should add up to. Stored in localStorage as two values so turning it off keeps the hours:

- `dailyTargetEnabled` (default `true`): off means **no limit**.
- `dailyTargetHours` (default `8`, step 0.5).

**Single source:** `useDailyTarget()` (`src/composables/useDailyTarget.ts`). Never hardcode 8h / 480 again.

- `targetMinutes`: the workday target in minutes, or `null` for no limit.
- `isOffDay(date)`: weekend day (Settings) or day-off holiday (`useWorkCalendar`).

**Off days have no Remaining, and logging on one warns in amber, never red.** People log side work on weekends
(studying on a Saturday), so those bars keep their project colours and get a soft amber outline (`warning`). Holidays from Calendarific carry `dayOff`: observances (Women's Day, Teachers' Day) are `false`, so they
aren't off days at all.
- `dailyTargetMinutes(enabled, hours)`: the pure version, for code outside components.

| Consumer | With a target | No limit |
|---|---|---|
| Remaining chip (BulkLogForm) | target − logged | hidden |
| WorkTimeBarChart | grey Remaining bars up to the target on workdays (none on off days); amber outline around an off-day column that has logs (`offDayOutline` plugin; bars keep their project colours); dashed target line once any day goes past it; y-axis not capped | no Remaining bars, no line |
| MobileWeekChart | scale floor = target | scale to the largest day (1h floor) |
| LogList day total colour | error above target, else warning on an off day, else primary within 30 min of it | no colour |
| Catch-up effort label | "Xd Yh" with a day = target (caller passes it to `fetchCatchUpItems`) | plain hours |
| AI chat (`api/chat.ts`, `src/common/extractedLogs.ts`) | the model only flags "the rest" (`restOfDay`); the client fills target − that day's saved logs − the batch's other entries (≤ 0: "Nothing left", Save disabled) | prompt tells the model to ask for the day length |

Older clients that don't send `workdayMinutes` get 480.

The chart's target line uses `chartjs-plugin-annotation`, registered in `WorkTimeBarChart.vue`.

## Remaining chip

Fills Duration with what's left of the target on the selected day. It **replaces** the duration (the `+` chips add to it).

Shown only when all of these hold. Otherwise it's hidden, not disabled.

- Exactly one date is selected. Bulk-logging full days is deliberately not encouraged.
- That date is a workday (not a weekend or holiday).
- The day already has logged time (plans don't count).
- Logged time is below the target, and a target is set.

In edit mode the log being edited is left out of the logged total, since saving replaces it.

## Quick picks

One row above Project with the 5 most recently logged Project + Task pairs (`recentProjectTasks` in `useWorkspace`). Clicking a chip fills Project and Task only. Duration varies too much per task to preset.

- Only real logs with a task, whose project still exists. Project-only logs are covered by the Project dropdown's "Recent" group.
- Shown in create mode while Project is empty, so it disappears once the form is being filled. Hidden in edit mode and after a clone.
- The row never wraps. It's a `VSlideGroup`: prev/next arrows on desktop when it overflows, swipe on touch. Long task names truncate (the tooltip shows `Project › Task`). It adds at most one line to the form.
- Quick picks and the time chips share the `quick-chip` style: white pill, lighter shadow than `elevation-1`.
