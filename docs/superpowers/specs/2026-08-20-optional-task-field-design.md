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
Group blank/undefined task under a fixed sentinel key (e.g. `NO_TASK` constant), displayed as label `"No task"`. Existing `hasBreakdown` (≥2 distinct buckets) logic is unchanged — a "No task" bucket counts as a distinct bucket like any real task.

### `src/composables/useProjectColors.ts`
`getTaskColors`/`deriveTaskShades` reserve a fixed muted/grey color for the `NO_TASK` sentinel instead of cycling it into the normal per-task palette, so it reads visually as "no task" rather than an arbitrary task color.

### `src/components/LogList.vue`
- `taskOptions` computed: filter out falsy tasks from the real list, then prepend a `NO_TASK` sentinel option (rendered as "No task") when any scoped log has a blank task.
- Filter logic: when `selectedTask === NO_TASK`, filter `!log.task`; otherwise match `log.task === selectedTask` as today.
- Delete-confirmation message (~line 272): `log.task ? `${log.project} · ${log.task}` : log.project` — no dangling separator.
- VDataTable task column: render `—` instead of a blank cell when task is absent, so it reads as intentional rather than a missing-data glitch.

### `src/components/AiLogCard.vue`
Wrap the `·` separator + task span in `v-if="log.task"` so a blank task doesn't leave a dangling `Project ·`.

### `src/interfaces/aiTools.ts`
Change the zod field from `task: z.string().describe('Task name; use project name if no task is mentioned')` to `task: z.string().optional().describe('Task name, only if explicitly mentioned; leave unset otherwise')`. AI-extracted logs now behave identically to manual entry — blank when not mentioned, no auto-fill to project name.

### `src/views/HomeView.vue`
- Local import-flow interface (~line 85): `task: string` → `task?: string`.
- **Same catalog-pollution guard as BulkLogForm**, in two places: CSV-import catalog upsert (~line 203) and AI-import catalog upsert (~line 233). Both currently build `{ project, title: l.task }` unconditionally via `uniqBy`/`map` — must filter out entries with a falsy task *before* building the upsert list, so `addTasks` never receives a `title: undefined` entry.

### `src/composables/useCatchUpSummary.ts`
Line ~205 signature/hash builder: `${l.task}` → `${l.task ?? ''}`, so a blank task contributes an empty segment instead of the literal string `"undefined"`. Lines ~106, ~243, ~268 (AI prompt payload construction) need no change — `task: l.task` naturally omits/nullifies correctly and the AI seeing no task field for an entry is the correct new behavior.

### `src/xero/xeroCsv.ts`
No code change. Export already writes whatever `log.task` is (blank now valid); import already produces `undefined` for an empty cell, which now matches the widened type instead of being a latent type-lie.

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
- AI extraction: verify a message with no task mentioned produces `task: undefined`, not the project name.

## Out of scope

- `src/interfaces/XeroLog.ts`, `XeroTask.ts`, `XeroProject.ts` — dead code, not referenced elsewhere; left untouched.
- `src/views/TaskView.vue` — manages the Task *catalog* (distinct entity from `TimeLog.task`), unaffected by this change.
- No change to how the Task catalog itself is populated/edited — only to when `TimeLog` entries opt into referencing it.
