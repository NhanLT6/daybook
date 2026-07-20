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
