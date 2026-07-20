# Project → Task Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a project with real sub-tasks is selected, show its per-task time split in the Insights panel (inline expand) and re-stack the month chart by task.

**Architecture:** A pure `useTaskBreakdown` composable owns the grouping math and is the single source both surfaces read. `InsightsPanel` renders task sub-rows under the selected project via Vuetify `<VExpandTransition>`; `WorkTimeBarChart` replaces the single project dataset with one stacked dataset per task. Task colors are lightness-stepped shades of the project's base color, produced by a pure `deriveTaskShades` function.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Pinia, Vuetify 3, Chart.js, lodash, vitest.

## Global Constraints

- Package manager: **yarn** (never npm).
- `TimeLog.duration` is **minutes**; a day's hours = `sumMinutesToHours(minutes[])` (sum raw minutes, divide by 60, round once). Never round per-log before summing.
- Full TypeScript coverage; fix all ESLint errors before finishing a task (`yarn lint`).
- Semantic/existing color helpers only; no new hardcoded palette.
- Test file location: `src/**/*.test.ts`. Run unit tests with `yarn vitest run <path>`.
- `hasBreakdown` rule: a project shows a breakdown only when it has **≥2 distinct task names**. Simple (Xero-legacy) projects where `task === project` have 1 distinct task → no breakdown.
- Hours display: Insights rows use `minutesToHourWithMinutes` (`4h 42m`); chart tooltip uses 1-decimal hours (`4.7h`).

---

### Task 1: `useTaskBreakdown` composable

**Files:**
- Create: `src/composables/useTaskBreakdown.ts`
- Test: `src/composables/__tests__/useTaskBreakdown.test.ts`

**Interfaces:**
- Consumes: `TimeLog` from `@/interfaces/TimeLog`; `sumBy` from lodash (for total only).
- Produces:
  - `interface TaskBreakdownItem { task: string; minutes: number; pct: number }`
  - `interface TaskBreakdown { tasks: TaskBreakdownItem[]; distinctTaskCount: number; hasBreakdown: boolean }`
  - `function useTaskBreakdown(timeLogs: MaybeRefOrGetter<TimeLog[]>, project: MaybeRefOrGetter<string | null>): ComputedRef<TaskBreakdown>`
  - `tasks` is sorted descending by `minutes`.

- [ ] **Step 1: Write the failing test**

Create `src/composables/__tests__/useTaskBreakdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ref } from 'vue';

import { useTaskBreakdown } from '@/composables/useTaskBreakdown';
import type { TimeLog } from '@/interfaces/TimeLog';

const log = (project: string, task: string, duration: number | undefined): TimeLog => ({
  id: `${project}-${task}-${duration}`,
  date: '07/02/2026',
  project,
  task,
  duration,
  type: duration ? 'log' : 'plan',
});

describe('useTaskBreakdown', () => {
  it('groups a project by task, sorted desc with pct', () => {
    const logs = ref<TimeLog[]>([
      log('Team work', 'Code review', 120),
      log('Team work', 'Meeting', 60),
      log('Team work', 'Code review', 60),
      log('Other', 'Other', 30), // different project, ignored
    ]);
    const result = useTaskBreakdown(logs, ref('Team work'));

    expect(result.value.tasks).toEqual([
      { task: 'Code review', minutes: 180, pct: 75 },
      { task: 'Meeting', minutes: 60, pct: 25 },
    ]);
    expect(result.value.distinctTaskCount).toBe(2);
    expect(result.value.hasBreakdown).toBe(true);
  });

  it('reports no breakdown for a single-task (task === project) project', () => {
    const logs = ref<TimeLog[]>([
      log('Xero Proj', 'Xero Proj', 60),
      log('Xero Proj', 'Xero Proj', 120),
    ]);
    const result = useTaskBreakdown(logs, ref('Xero Proj'));

    expect(result.value.distinctTaskCount).toBe(1);
    expect(result.value.hasBreakdown).toBe(false);
    expect(result.value.tasks).toHaveLength(1);
  });

  it('returns empty when no project selected', () => {
    const logs = ref<TimeLog[]>([log('Team work', 'Meeting', 60)]);
    const result = useTaskBreakdown(logs, ref(null));

    expect(result.value.tasks).toEqual([]);
    expect(result.value.hasBreakdown).toBe(false);
  });

  it('treats undefined duration (plan entries) as 0', () => {
    const logs = ref<TimeLog[]>([
      log('Team work', 'Code review', 60),
      log('Team work', 'Planning', undefined),
    ]);
    const result = useTaskBreakdown(logs, ref('Team work'));

    const planning = result.value.tasks.find((t) => t.task === 'Planning');
    expect(planning).toEqual({ task: 'Planning', minutes: 0, pct: 0 });
  });

  it('reacts to project changes', () => {
    const logs = ref<TimeLog[]>([
      log('A', 'a1', 60),
      log('A', 'a2', 60),
      log('B', 'B', 60),
    ]);
    const project = ref<string | null>('A');
    const result = useTaskBreakdown(logs, project);
    expect(result.value.hasBreakdown).toBe(true);

    project.value = 'B';
    expect(result.value.hasBreakdown).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/composables/__tests__/useTaskBreakdown.test.ts`
Expected: FAIL — `useTaskBreakdown is not a function` / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/composables/useTaskBreakdown.ts`:

```ts
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';

import { sumBy } from 'lodash';

import type { TimeLog } from '@/interfaces/TimeLog';

export interface TaskBreakdownItem {
  task: string;
  minutes: number;
  pct: number;
}

export interface TaskBreakdown {
  tasks: TaskBreakdownItem[];
  distinctTaskCount: number;
  hasBreakdown: boolean;
}

/**
 * Group a single project's logs by task. Single source of truth for the
 * Insights task sub-rows and the chart's per-task stacking, so both surfaces
 * show the same task set, order, and totals.
 */
export function useTaskBreakdown(
  timeLogs: MaybeRefOrGetter<TimeLog[]>,
  project: MaybeRefOrGetter<string | null>,
): ComputedRef<TaskBreakdown> {
  return computed(() => {
    const proj = toValue(project);
    if (!proj) return { tasks: [], distinctTaskCount: 0, hasBreakdown: false };

    const logs = toValue(timeLogs).filter((l) => l.project === proj);
    const projectMinutes = sumBy(logs, (l) => l.duration ?? 0);

    const grouped: Record<string, number> = {};
    for (const log of logs) {
      grouped[log.task] = (grouped[log.task] ?? 0) + (log.duration ?? 0);
    }

    const tasks: TaskBreakdownItem[] = Object.entries(grouped)
      .map(([task, minutes]) => ({
        task,
        minutes,
        pct: projectMinutes > 0 ? Math.round((minutes / projectMinutes) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return { tasks, distinctTaskCount: tasks.length, hasBreakdown: tasks.length >= 2 };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/composables/__tests__/useTaskBreakdown.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/composables/useTaskBreakdown.ts src/composables/__tests__/useTaskBreakdown.test.ts
git commit -m "feat(insights): add useTaskBreakdown composable"
```

---

### Task 2: Task color shades in `useProjectColors`

**Files:**
- Modify: `src/composables/useProjectColors.ts`
- Test: `src/composables/__tests__/useProjectColors.test.ts`

**Interfaces:**
- Produces:
  - `export const deriveTaskShades = (baseHex: string, count: number, isDark: boolean): string[]` — `count` hex colors, lightness-stepped from the base hue/saturation.
  - `getTaskColors(project: string, tasks: string[]): Record<string, string>` added to the object returned by `useProjectColors()` — maps each task name to a shade (order = `tasks` array order).

**Note:** This task also extracts two pure helpers (`hexToHsl`, `hslToHex`) from the existing `adjustColorForDarkTheme` and rewrites that function to use them (identical math, DRY). Only `deriveTaskShades` is unit-tested (the theme-dependent `getTaskColors` wraps it).

- [ ] **Step 1: Write the failing test**

Create `src/composables/__tests__/useProjectColors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { deriveTaskShades } from '@/composables/useProjectColors';

const HEX = /^#[0-9a-f]{6}$/i;

describe('deriveTaskShades', () => {
  it('returns one distinct hex per task', () => {
    const shades = deriveTaskShades('#A8D4F0', 3, false);
    expect(shades).toHaveLength(3);
    shades.forEach((s) => expect(s).toMatch(HEX));
    expect(new Set(shades).size).toBe(3); // all distinct
  });

  it('returns a single shade for count 1', () => {
    const shades = deriveTaskShades('#A8D4F0', 1, false);
    expect(shades).toHaveLength(1);
    expect(shades[0]).toMatch(HEX);
  });

  it('returns empty for count 0', () => {
    expect(deriveTaskShades('#A8D4F0', 0, false)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(deriveTaskShades('#A8E6CF', 4, true)).toEqual(deriveTaskShades('#A8E6CF', 4, true));
  });

  it('produces distinct shades in dark mode too', () => {
    const shades = deriveTaskShades('#C4B8E8', 3, true);
    expect(new Set(shades).size).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/composables/__tests__/useProjectColors.test.ts`
Expected: FAIL — `deriveTaskShades` is not exported.

- [ ] **Step 3: Add pure HSL helpers and `deriveTaskShades`, refactor `adjustColorForDarkTheme`**

In `src/composables/useProjectColors.ts`, replace the existing `adjustColorForDarkTheme` function (the whole block from its declaration through its closing brace) with the following. Leave the `chartPalette` array above it unchanged.

```ts
// Pure hex↔HSL helpers (h,s,l in 0..1)
const hexToHsl = (hexColor: string): [number, number, number] => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h, s, l];
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Adjust color for dark theme - moderate saturation with comfortable lightness
const adjustColorForDarkTheme = (hexColor: string): string => {
  const [h, s] = hexToHsl(hexColor);
  const newS = Math.min(Math.max(s * 0.9, 0.4), 0.6);
  const newL = 0.6; // Fixed comfortable lightness for dark backgrounds
  return hslToHex(h, newS, newL);
};

/**
 * Derive `count` shades of a base color by stepping lightness across the base
 * hue/saturation. Used to color a project's task segments so they read as tones
 * of the one project color. Theme-aware: darker, less-saturated ramp on dark.
 */
export const deriveTaskShades = (baseHex: string, count: number, isDark: boolean): string[] => {
  if (count <= 0) return [];

  const [h, s] = hexToHsl(baseHex);
  const lStart = isDark ? 0.68 : 0.86;
  const lEnd = isDark ? 0.44 : 0.6;
  const sat = isDark ? Math.min(Math.max(s * 0.9, 0.4), 0.6) : s;

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const l = lStart + (lEnd - lStart) * t;
    return hslToHex(h, sat, l);
  });
};
```

- [ ] **Step 4: Add `getTaskColors` to the composable's return**

In `useProjectColors()`, add this function just after `getProjectColor` (which already exists), and add `getTaskColors` to the returned object.

```ts
  // Map each task of a project to a distinct shade of the project's base color
  const getTaskColors = (project: string, tasks: string[]): Record<string, string> => {
    if (!projectColorMaps.value.has(project)) setProjectColor(project);
    const base = projectColorMaps.value.get(project) as string;
    const shades = deriveTaskShades(base, tasks.length, isDark());
    return Object.fromEntries(tasks.map((task, i) => [task, shades[i]]));
  };
```

Then extend the return object (add the `getTaskColors` line):

```ts
  return {
    chartPalette,
    remainingDataColor,
    invalidDataColor,
    getProjectColor,
    getTaskColors,
    setProjectColor,
  };
```

- [ ] **Step 5: Run tests + type-check**

Run: `yarn vitest run src/composables/__tests__/useProjectColors.test.ts`
Expected: PASS (5 tests).
Run: `yarn type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useProjectColors.ts src/composables/__tests__/useProjectColors.test.ts
git commit -m "feat(insights): add task color shades to useProjectColors"
```

---

### Task 3: Chart stacks by task for the selected project

**Files:**
- Modify: `src/components/WorkTimeBarChart.vue`

**Interfaces:**
- Consumes: `useTaskBreakdown` (Task 1); `getTaskColors` (Task 2); existing `sumMinutesToHours`, `chain`, `segmentBorder`, `daysInMonth`, `timeLogs`, `shortDateFormat`.
- Produces: no new exports; new chart branch + tooltip label callback.

- [ ] **Step 1: Import the composable and wire the breakdown**

In the `<script setup>` imports, add:

```ts
import { useTaskBreakdown } from '@/composables/useTaskBreakdown';
```

After the existing `const timeLogs = computed(...)` definition, add:

```ts
// Task-level breakdown of the selected project (drives task stacking below)
const taskBreakdown = useTaskBreakdown(timeLogs, () => props.selectedProject ?? null);
```

- [ ] **Step 2: Add the task-stacking branch**

In the `chartData` computed, immediately inside `try {` (before `const logsForDataset = ...`), insert:

```ts
    // Selected project WITH real sub-tasks → stack each day's bar by task
    if (props.selectedProject && taskBreakdown.value.hasBreakdown) {
      const projectLogs = timeLogs.value.filter((log) => log.project === props.selectedProject);
      const taskNames = taskBreakdown.value.tasks.map((t) => t.task);
      const taskColors = projectColors.getTaskColors(props.selectedProject, taskNames);

      const taskDataSets = taskBreakdown.value.tasks.map((t) => ({
        label: t.task,
        backgroundColor: taskColors[t.task],
        ...segmentBorder.value,
        data: daysInMonth.value.map((d) =>
          sumMinutesToHours(
            chain(projectLogs)
              .filter((item) => item.task === t.task && item.date === d.format(shortDateFormat))
              .map((item) => item.duration ?? 0)
              .value(),
          ),
        ),
      }));

      return {
        labels: daysInMonth.value.map((d) => d.format('DD')),
        datasets: taskDataSets,
      };
    }
```

(The existing `if (props.selectedProject) { ... }` single-series return remains below and now handles only simple/no-breakdown projects.)

- [ ] **Step 3: Add the decimal-hours tooltip label**

In `chartOptions`, extend `plugins.tooltip.callbacks` — keep the existing `title` callback and add a `label` callback:

```ts
    tooltip: {
      enabled: true,
      callbacks: {
        title: (tooltipItems: any[]) => {
          const dataset = tooltipItems[0]?.dataset;
          return dataset?.label || '';
        },
        label: (tooltipItem: any) => `${tooltipItem.parsed.y}h`,
      },
    },
```

- [ ] **Step 4: Type-check and lint**

Run: `yarn type-check`
Expected: no errors.
Run: `yarn eslint src/components/WorkTimeBarChart.vue`
Expected: no new errors (the pre-existing `any` warning on the tooltip title callback may remain).

- [ ] **Step 5: Verify in the browser**

Start the dev server and open the app (see `.claude/launch.json` → "Frontend (Vite)"). In the browser console, seed a multi-task Team work day, then reload:

```js
const logs = [
  { id: 't1', date: '07/07/2026', project: 'Team work', task: 'Code review', duration: 120, type: 'log' },
  { id: 't2', date: '07/07/2026', project: 'Team work', task: 'Meeting',     duration: 90,  type: 'log' },
  { id: 't3', date: '07/07/2026', project: 'Team work', task: 'Coding',      duration: 150, type: 'log' },
  { id: 't4', date: '07/08/2026', project: 'Team work', task: 'Code review', duration: 60,  type: 'log' },
  { id: 't5', date: '07/08/2026', project: 'Team work', task: 'Coding',      duration: 180, type: 'log' },
];
localStorage.setItem('timeLogs-2026-07', JSON.stringify(logs));
location.reload();
```

Confirm:
- With no project selected, 07/07 shows a single Team work bar (total 6h).
- Select "Team work" in Insights "Time by project". The 07/07 bar keeps ~the same height (6h) but splits into stacked segments (Code review / Meeting / Coding), each a shade of the Team work color; the legend lists the tasks.
- Hovering a segment shows a tooltip like `Code review: 2h`.
- Take a screenshot as proof. Then clear: `localStorage.removeItem('timeLogs-2026-07')`.

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkTimeBarChart.vue
git commit -m "feat(chart): stack the selected project's bars by task"
```

---

### Task 4: Insights inline task sub-rows

**Files:**
- Modify: `src/components/InsightsPanel.vue`

**Interfaces:**
- Consumes: `useTaskBreakdown` (Task 1); `getTaskColors` (Task 2); existing `truncate`, `minutesToHourWithMinutes`, `selectedProject` model, `getProjectColor`.
- Produces: no new exports; expandable task rows under the selected project.

- [ ] **Step 1: Import composable, add breakdown + task colors**

In `<script setup>` imports add:

```ts
import { useTaskBreakdown } from '@/composables/useTaskBreakdown';
```

Add `getTaskColors` to the existing destructure:

```ts
const { getProjectColor, getTaskColors } = useProjectColors();
```

After the `selectedProject` model definition, add:

```ts
// Task breakdown of the currently selected project (inline expand below its row)
const taskBreakdown = useTaskBreakdown(
  () => props.timeLogs,
  selectedProject,
);

const taskColors = computed(() =>
  selectedProject.value && taskBreakdown.value.hasBreakdown
    ? getTaskColors(selectedProject.value, taskBreakdown.value.tasks.map((t) => t.task))
    : ({} as Record<string, string>),
);
```

(`computed` is already imported at the top of the file.)

- [ ] **Step 2: Restructure the project row to host an expand block**

In the template's "Time by project" list, replace the current row element:

```html
              <div
                v-for="item in projectBreakdown"
                :key="item.project"
                :style="getProjectRowStyle(item.project)"
                @click="onProjectClick(item.project)"
              >
                <!-- Row 1: dot + name + hours (pct) -->
                <div class="d-flex align-center ga-2 mb-1">
```

with a wrapper that keeps the clickable header and adds a sibling expand block:

```html
              <div v-for="item in projectBreakdown" :key="item.project">
                <!-- Clickable project row -->
                <div :style="getProjectRowStyle(item.project)" @click="onProjectClick(item.project)">
                  <!-- Row 1: dot + name + hours (pct) -->
                  <div class="d-flex align-center ga-2 mb-1">
```

Then, after that row's closing tags (immediately after the project row's `<VProgressLinear ... height="5" />` and the `</div>` that closes the clickable row), add the expand block and close the wrapper:

```html
                <!-- Inline task breakdown for the selected project -->
                <VExpandTransition>
                  <div
                    v-if="selectedProject === item.project && taskBreakdown.hasBreakdown"
                    class="mt-2 ms-4 d-flex flex-column ga-2"
                    @click.stop
                  >
                    <div v-for="t in taskBreakdown.tasks" :key="t.task">
                      <!-- Task row: shade dot + name + hours (pct) -->
                      <div class="d-flex align-center ga-2 mb-1">
                        <span
                          class="flex-shrink-0"
                          :style="{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: taskColors[t.task],
                          }"
                        />
                        <span class="text-caption text-truncate flex-grow-1">{{ truncate(t.task) }}</span>
                        <span class="text-caption text-medium-emphasis flex-shrink-0">
                          {{ minutesToHourWithMinutes(t.minutes) }} ({{ t.pct }}%)
                        </span>
                      </div>
                      <!-- Task progress bar -->
                      <VProgressLinear
                        :model-value="t.pct"
                        :color="taskColors[t.task]"
                        bg-color="rgba(var(--v-theme-on-surface), 0.08)"
                        rounded
                        height="4"
                      />
                    </div>
                  </div>
                </VExpandTransition>
              </div>
```

Make sure the original per-item `<div>` now closes only after the expand block (one wrapper `</div>` at the end, replacing the old row's closing `</div>`). Verify the template still has balanced tags.

- [ ] **Step 3: Type-check and lint**

Run: `yarn type-check`
Expected: no errors.
Run: `yarn eslint src/components/InsightsPanel.vue`
Expected: no new errors.

- [ ] **Step 4: Verify in the browser**

With the dev server running, seed the same multi-task data as Task 3 Step 5 and reload. Then:
- Click "Team work" in "Time by project". Its row highlights and **expands** to indented task rows (Code review / Coding / Meeting), each with a shade dot, `Xh Ym (NN%)`, and a thin bar. Order matches the chart.
- Click a different simple project (e.g. seed one with `task === project`) → no expansion.
- Collapsing (click again) animates closed via `VExpandTransition`.
- Confirm the panel scrolls when many tasks are present (no cap).
- Screenshot as proof. Clear: `localStorage.removeItem('timeLogs-2026-07')`.

- [ ] **Step 5: Commit**

```bash
git add src/components/InsightsPanel.vue
git commit -m "feat(insights): inline task breakdown for the selected project"
```

---

## Notes for the implementer

- Insights and chart both read task set/order from `useTaskBreakdown`, and both color via `getTaskColors(project, sameTaskOrder)`, so dots and segments stay color-matched.
- Chart height is preserved because task datasets **replace** the single project dataset (partition, not addition). A ≤0.1h per-segment rounding shimmer is accepted by design.
- Do not add a task cap or "Other" bucket — long lists scroll (Insights) / grow the legend (chart), per the approved spec.
- The user commits per their own preference; the per-task commit steps above are the intended granularity — run them (this is planned work the user asked to be committed task-by-task during execution). If unsure, leave committing to the user.

## Self-Review

- **Spec coverage:** composable (Task 1) ✓; `hasBreakdown`/simple-project rule (Task 1) ✓; Insights inline expand via VExpandTransition + `4h 42m` (Task 4) ✓; chart stack-by-task + decimal tooltip + preserved height (Task 3) ✓; task shades (Task 2) ✓; no cap/scroll ✓ (no cap logic anywhere); read-only task rows ✓ (`@click.stop`, no handler).
- **Placeholder scan:** none — all steps contain full code/commands.
- **Type consistency:** `TaskBreakdown`/`TaskBreakdownItem`, `useTaskBreakdown(timeLogs, project)`, `deriveTaskShades(baseHex, count, isDark)`, `getTaskColors(project, tasks)` used identically across Tasks 1–4.
