# Optional Task Field — Design

## Context

daybook was born as an alternative front-end to Xero time logging, so `TimeLog.task` has always been a required string. The app has since grown beyond that original purpose — Xero logging is now one feature among several. In practice, the user's Task value is usually identical to the Project value, so requiring both is redundant friction. This change makes `Project` the only required grouping dimension, matching a Linear-style model, while keeping Task available for when it adds real distinction.

Xero itself has no "task-less" time entry concept (its UI requires selecting a Task under a Project), so the Xero automation layer needs an explicit fallback rather than being able to omit the field.

## Data model

`TimeLog.task` becomes optional:

```ts
export interface TimeLog {
  id: string;
  date: string;
  project: string;
  task?: string;   // was: task: string
  duration?: number;
  type: 'log' | 'plan';
  description?: string;
}
```

**Normalization rule**: blank task is always stored as `undefined`, never `''`. Every write path (manual form, CSV import, AI extraction) normalizes `''`/whitespace-only input to `undefined` before persisting. This gives every downstream consumer one falsy shape to check instead of two.

No storage/migration change needed — `src/db/*` is untyped generic collection storage; existing rows with string `task` values remain valid under the widened type.

## Component changes

### `src/interfaces/TimeLog.ts`
`task?: string`.

### `src/components/BulkLogForm.vue`
- yup schema: drop `.required('Required')` on `task` — becomes `string().optional()`.
- On submit, normalize: `const task = values.task?.trim() || undefined;` — use this everywhere `values.task!` is currently used (lines ~155, 168), replacing the non-null assertions.
- **Catalog-pollution guard**: the existing "auto-add new task to catalog" logic (`isTaskExisting` / `addTasks`, ~line 193-194) must skip entirely when `task` is falsy — otherwise it upserts a `Task` catalog entry with `title: undefined`, which then pollutes the Task combobox's autocomplete suggestions for that project. New logic: only run the existing-check-and-add when `task` is truthy.
- VCombobox loses its required indicator; no other UX change (confirmed: no placeholder hint, no auto-fill-from-project convenience — plain optional field).

### `src/composables/useTaskBreakdown.ts`
Export a sentinel constant `export const NO_TASK = 'No task';` and group blank/undefined task under `grouped[NO_TASK]`. Making the sentinel *be* the display string (not a separate code needing a label lookup) means every consumer that renders the grouped key — `InsightsPanel.vue`, `WorkTimeBarChart.vue` — needs no extra label-mapping step; it already reads "No task". (Edge case: a real task literally titled "No task" would collide with the bucket — acceptable, documented here.) `grouped[log.task]` at line 32 becomes `grouped[log.task ?? NO_TASK]`, which also resolves the TS index-type error the widened `task?: string` would otherwise cause. Existing `hasBreakdown` (≥2 distinct buckets) logic is unchanged.

### `src/composables/useProjectColors.ts`
Reservation happens **only** in `getTaskColors` (`:138-143`), not `deriveTaskShades` (`:98`) — `deriveTaskShades` takes a count, not task names, and has no way to know which slot is the sentinel; changing its signature would break its 5 existing tests (`useProjectColors.test.ts:7-32`) for no reason. In `getTaskColors`, derive shades only for `tasks.filter(t => t !== NO_TASK).length`, then map `NO_TASK` to a fixed grey — reuse the existing `remainingDataColor()` precedent at `:147`.

### `src/components/LogList.vue`
- `taskOptions` computed (`:142`): filter out falsy tasks from the real list, then append the `NO_TASK` option when any scoped log has a blank task. (Today this computed infers `(string | undefined)[]` once the type widens — the filter fixes that as a side effect, not a separate concern.)
- Filter logic (`:168`): when `selectedTask === NO_TASK`, filter `!log.task`; otherwise match `log.task === selectedTask` as today.
- Delete-confirmation message (`:272`): `log.task ? `${log.project} · ${log.task}` : log.project` — no dangling separator.
- VDataTable task column: there is currently no `#item.task` slot (`headers` at `:122-128` just declares `{ title: 'Task', key: 'task' }` with default rendering) — add one (alongside the existing `#item.duration` at `:492` and `#item.actions` at `:498`) that renders `—` when task is absent, so it reads as intentional rather than a missing-data glitch.

### `src/components/WorkTimeBarChart.vue`
`:126-132` builds per-task chart segments and currently filters logs into each segment with `l.task === t.task` — once a "No task" bucket exists via the `NO_TASK` sentinel, this predicate matches zero real logs (`l.task` is `undefined`/falsy, never equal to the string `NO_TASK`), so that bucket's hours would silently render as an empty/zero bar while still counting in Insights. Fix: `logs: projectLogs.filter((l) => (t.task === NO_TASK ? !l.task : l.task === t.task))`. The `label: t.task` and `colors[t.task]` lookups at `:129-130` need no change — they already read "No task" correctly since the sentinel is the display string itself.

### `src/components/InsightsPanel.vue`
`:281` (`:key="t.task"`), `:290`/`:301` (color lookup via `taskColorsByProject[item.project]?.[t.task]`), and `:293` (`{{ truncate(t.task) }}`) all consume the grouped key directly — no code change needed here since the sentinel already *is* "No task" as plain text. Listed explicitly so it isn't mistaken for an oversight.

### `src/components/AiLogCard.vue`
Wrap the `·` separator + task span (`:19-20`) in `v-if="log.task"` so a blank task doesn't leave a dangling `Project ·`.

### `src/interfaces/aiTools.ts`
Change the zod field from `task: z.string().describe('Task name; use project name if no task is mentioned')` to `task: z.string().optional().describe('Task name, only if explicitly mentioned; leave unset otherwise')`. AI-extracted logs now behave identically to manual entry — blank when not mentioned, no auto-fill to project name.

### `api/chat.ts`
`:42-43` — the server system prompt independently instructs the model: *"If no task is mentioned or cannot be determined, set task equal to the project name... Mention this briefly in your text reply."* This is a **stronger, separate instruction** from the zod schema `.describe()` text and would keep producing `task = project` (plus a misleading reply sentence) even after the `aiTools.ts` change above. Remove this rule from the prompt so the server and schema agree: blank task stays blank.

### `src/views/HomeView.vue`
- `CloneSeed` interface (`:83-89`, used by the clone-log flow): `task: string` → `task?: string`.
- **Same catalog-pollution guard as BulkLogForm**, in two places: CSV-import catalog upsert (`:203`) and AI-import catalog upsert (`:233-238`). Both currently build `{ project, title: l.task }` unconditionally via `uniqBy`/`map` — must filter out entries with a falsy task *before* building the upsert list, so `addTasks` never receives a `title: undefined` entry.

### `src/components/BulkLogForm.vue` (cloneSeed prop)
`:44-50` — the `cloneSeed` prop type has its own `task: string` (paired with the `CloneSeed` interface above via `HomeView.vue:166`'s `onCloneLog`). Must become `task?: string` or `yarn type-check` fails.

### `src/composables/useCatchUpSummary.ts`
Two local interfaces pin `task` as required and must widen: `CatchUpItem['logs'][number].task` (`:60`) and `RequestPlan['tasks'][number].task` (`:69`) both become `task?: string` — otherwise `task: l.task` at `:106` and `:243` (assigning `string | undefined` into a `string` slot) fails `yarn type-check`. `:268` reads from the now-widened `CatchUpItem` and needs no further change. Separately, line `:205`'s signature/hash builder: `${l.task}` → `${l.task ?? ''}`, so a blank task contributes an empty segment instead of the literal string `"undefined"`.

### `api/standup.ts`
`:9-13` (`RequestLog`) and `:21-24` (`RequestPlanTask`) both pin `task: string` — widen both to `task?: string`, otherwise `JSON.stringify` silently drops the key when `undefined` reaches the server and `l.task`/`t.task` reads back as `undefined` inside the template literals at `:47` and `:58` (`` `  - ${l.task}${l.description ? ...} (${l.duration})` ``), rendering the literal text `- undefined: ...` into the AI prompt. Fix: guard both template literals, e.g. `` l.task ? `${l.task}` : '' `` with the description separator adjusted so the line reads cleanly with or without a task.

### `src/xero/xeroCsv.ts`
`:45` — import currently reads `task: row.task as string`. Papaparse yields `''` (not `undefined`) for a blank CSV cell, and the `transform` callback (`:31-36`) only special-cases `date`/`duration`/`type` — `task` falls through unchanged. This violates the spec's own normalization rule. Fix: `task: (row.task as string) || undefined`.

### `e2e/xeroWorkLogger.spec.ts` + `e2e/logHelpers/fileHelper.ts`
- `TaskEntry.task` interface **stays required** — this is Xero's own contract, not daybook's.
- `fileHelper.ts` stays an honest raw CSV reader — no change.
- In `xeroWorkLogger.spec.ts`, immediately after `getTaskEntries(...)` and before the existing `groupBy`, add a normalization pass: `entry.task = entry.task || entry.project` for each entry. This is the one place the "Xero requires a task" business rule lives, matching the fact that Xero's UI has no task-less time entry.

## Error handling

No new failure modes introduced. The one system that cannot tolerate a blank task (Xero) gets an explicit, localized fallback at its own boundary. Everywhere else, blank is a valid, first-class state with a defined display treatment ("No task").

## Testing

- `useTaskBreakdown.test.ts`: add a case for a project with mixed blank/non-blank tasks — verify "No task" bucket appears with correct summed duration and doesn't collide with a real task also named "No task"-like text.
- `BulkLogForm` test/e2e: save an entry with blank task, verify (a) it persists as `undefined` not `''`, (b) no catalog entry is created for it.
- `LogList` test: verify "No task" filter option appears only when scoped logs have a blank task, and filters correctly.
- `xeroWorkLogger.spec.ts` (or a focused unit test around the normalization step): blank-task CSV row → Xero task defaults to the row's project name.
- AI extraction: verify a message with no task mentioned produces `task: undefined`, not the project name (covers both `aiTools.ts` schema and the `api/chat.ts` prompt rule).
- `WorkTimeBarChart`: a project with a mix of blank and real-task logs renders a non-zero "No task" stacked segment.
- `yarn type-check`: run after all interface widenings (`useCatchUpSummary.ts`, `api/standup.ts`, `BulkLogForm.vue` cloneSeed prop, `HomeView.vue` `CloneSeed`) to confirm no `string | undefined`-into-`string` errors remain.

## Out of scope

- `src/interfaces/XeroLog.ts`, `XeroTask.ts`, `XeroProject.ts` — dead code, not referenced elsewhere; left untouched.
- `src/views/TaskView.vue` — manages the Task *catalog* (distinct entity from `TimeLog.task`), unaffected by this change.
- No change to how the Task catalog itself is populated/edited — only to when `TimeLog` entries opt into referencing it.
