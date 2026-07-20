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
export function computeTaskBreakdown(timeLogs: TimeLog[], project: string | null): TaskBreakdown {
  if (!project) return { tasks: [], distinctTaskCount: 0, hasBreakdown: false };

  const logs = timeLogs.filter((l) => l.project === project);
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
}

/** Reactive wrapper around {@link computeTaskBreakdown} for the selected project. */
export function useTaskBreakdown(
  timeLogs: MaybeRefOrGetter<TimeLog[]>,
  project: MaybeRefOrGetter<string | null>,
): ComputedRef<TaskBreakdown> {
  return computed(() => computeTaskBreakdown(toValue(timeLogs), toValue(project)));
}
