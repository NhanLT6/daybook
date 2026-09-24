import { computed } from 'vue';

import { useCategories } from '@/composables/useCategories';
import { useCollection } from '@/composables/useCollection';
import { useJira } from '@/composables/useJira';
import { useTimeLogs } from '@/composables/useTimeLogs';

import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useSettingsStore } from '@/stores/settings';
import { uniq, uniqBy } from 'lodash';

export function useWorkspace() {
  const tasksCol = useCollection<Task & { id: string }>('tasks');
  const projectsCol = useCollection<Project & { id: string }>('projects');
  const pinsCol = useCollection<{ id: string }>('pinnedProjects');

  // Public refs keep prior shapes: Task[]/Project[]/string[]
  const allTasks = computed(() => tasksCol.items.value as Task[]);
  const allProjects = computed(() => projectsCol.items.value as Project[]);
  const pinnedProjects = computed(() => pinsCol.items.value.map((p) => p.id));

  const settingsStore = useSettingsStore();
  const { getCategoryName } = useCategories();
  const { myJiraProjects, teamJiraProjects } = useJira();
  const { logs } = useTimeLogs();

  const teamWorkTasks = [
    { title: 'Daily meeting', project: 'Team work' },
    { title: 'Code review', project: 'Team work' },
    { title: 'Retro', project: 'Team work' },
    { title: 'Grooming', project: 'Team work' },
    { title: 'Planning', project: 'Team work' },
    { title: 'Demo', project: 'Team work' },
    { title: 'Team meeting', project: 'Team work' },
  ];

  const teamWorkProjects = uniqBy(
    teamWorkTasks.map((task) => ({ title: task.project })),
    'title',
  );

  /**
   * Initialize workspace with team work preset data if enabled and user data is empty
   * This is called manually from components when needed.
   * Collections load asynchronously, so we must await both being ready before the
   * empty-check — otherwise this races the initial load and seeds the preset over
   * data that simply hasn't finished loading yet.
   */
  const initTeamWorkPreset = async () => {
    await Promise.all([projectsCol.ready, tasksCol.ready]);

    if (settingsStore.useDefaultTasks && allTasks.value.length === 0 && allProjects.value.length === 0) {
      // Initialize with team work preset tasks and projects
      void projectsCol.addMany(teamWorkProjects.map((p) => ({ ...p, id: p.title })));
      void tasksCol.addMany(teamWorkTasks.map((t) => ({ ...t, id: `${t.project}::${t.title}` })));
    }
  };

  /**
   * Get all my projects (merged from user inputted, team work preset, and Jira).
   * Jira projects are assigned the default category from settings if not already set.
   */
  const myProjects = computed(() => {
    const jiraCategoryId = settingsStore.jiraConfig.defaultCategoryId;

    const projects: Project[] = [
      ...allProjects.value,
      ...myJiraProjects.value.map((jp) => ({
        title: jp.title,
        categoryId: jiraCategoryId ?? undefined,
      })),
      ...(settingsStore.useDefaultTasks ? teamWorkProjects : []),
    ];

    return uniqBy(projects, (p) => p.title);
  });

  // Pinned first (in pin order), then the rest alphabetically.
  // Stale pins (titles no longer in myProjects) are silently excluded.
  const sortedProjectTitles = computed(() => {
    const titles = myProjects.value.map((p) => p.title);
    const pinned = pinnedProjects.value.filter((t) => titles.includes(t));
    const unpinned = titles.filter((t) => !pinned.includes(t)).sort();
    return [...pinned, ...unpinned];
  });

  // Most recently logged projects (by latest work date of a real log, not plans), excluding pinned ones —
  // pinned projects already sit at the top. ISO dates compare lexicographically.
  const RECENT_LIMIT = 5;
  const recentProjectTitles = computed(() => {
    const titles = new Set(myProjects.value.map((p) => p.title));
    const lastUsed = new Map<string, string>();
    for (const log of logs.value) {
      if (log.type !== 'log' || !titles.has(log.project) || pinnedProjects.value.includes(log.project)) continue;
      const prev = lastUsed.get(log.project);
      if (!prev || log.date > prev) lastUsed.set(log.project, log.date);
    }
    return [...lastUsed.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, RECENT_LIMIT)
      .map(([title]) => title);
  });

  // For grouped VCombobox — flat array with injected subheader objects.
  // Order: "Pinned", then "Recent" (each item carries its category as subtitle for context when categories
  // are on), then the rest — category groups when categories are enabled, otherwise one "All projects" group.
  // A project appears only once. With nothing pinned or recent and categories off, it's a plain flat list.
  const sortedProjectItems = computed((): Array<{ title: string; header?: true; categoryName?: string }> => {
    const categoryOf = (title: string) =>
      settingsStore.useCategories
        ? getCategoryName(myProjects.value.find((p) => p.title === title)?.categoryId)
        : undefined;

    const pinnedTitles = sortedProjectTitles.value.filter((t) => pinnedProjects.value.includes(t));
    const recentTitles = recentProjectTitles.value;
    const restTitles = sortedProjectTitles.value.filter(
      (t) => !pinnedProjects.value.includes(t) && !recentTitles.includes(t),
    );

    if (!settingsStore.useCategories && !pinnedTitles.length && !recentTitles.length) {
      return restTitles.map((title) => ({ title }));
    }

    const result: Array<{ title: string; header?: true; categoryName?: string }> = [];
    const pushSection = (header: string, titles: string[]) => {
      if (!titles.length) return;
      result.push({ title: header, header: true });
      for (const title of titles) result.push({ title, categoryName: categoryOf(title) });
    };

    pushSection('Pinned', pinnedTitles);
    pushSection('Recent', recentTitles);

    if (!settingsStore.useCategories) {
      if (restTitles.length) result.push({ title: 'All projects', header: true });
      for (const title of restTitles) result.push({ title });
      return result;
    }

    // Category groups (rest only; empty groups are naturally skipped)
    const groups = new Map<string, string[]>();
    for (const title of restTitles) {
      const categoryName = categoryOf(title)!;
      if (!groups.has(categoryName)) groups.set(categoryName, []);
      groups.get(categoryName)!.push(title);
    }

    for (const [categoryName, titles] of groups) {
      result.push({ title: categoryName, header: true });
      for (const title of titles) result.push({ title });
    }

    return result;
  });

  const pinProject = (title: string) => {
    if (!pinnedProjects.value.includes(title)) void pinsCol.add({ id: title });
  };

  const unpinProject = (title: string) => {
    void pinsCol.remove(title);
  };

  const isPinned = (title: string): boolean => pinnedProjects.value.includes(title);

  /**
   * Get all tasks for a specific project
   * @param projectTitle - The project to get tasks for
   */
  const getTasksByProject = (projectTitle: string) => {
    const tasks: Task[] = allTasks.value.filter((t) => t.project === projectTitle);

    const jiraTasks: Task[] = myJiraProjects.value
      .filter((jp) => jp.title === projectTitle)
      .map(() => ({ title: projectTitle, project: projectTitle }) satisfies Task);

    return uniqBy([...tasks, ...jiraTasks], (t) => t.title);
  };

  const codeReviewDescriptions = computed(() => {
    if (!settingsStore.useDefaultTasks) return [];
    if (!settingsStore.jiraConfig.enabled) return [];

    return uniq(teamJiraProjects.value.map((ticket) => `Review ticket ${ticket.title}`));
  });

  /**
   * Write-through helpers for bulk writers (import/AI flows) that add projects/tasks
   * directly to the underlying collections.
   */
  const addProjects = (list: Project[]) => projectsCol.addMany(list.map((p) => ({ ...p, id: p.title })));
  const addTasks = (list: Task[]) => tasksCol.addMany(list.map((t) => ({ ...t, id: `${t.project}::${t.title}` })));

  return {
    allTasks,
    allProjects,
    teamWorkTasks,
    teamWorkProjects,

    myProjects,
    sortedProjectTitles,
    sortedProjectItems,
    pinProject,
    unpinProject,
    isPinned,
    getTasksByProject,
    codeReviewDescriptions,

    initTeamWorkPreset,
    addProjects,
    addTasks,
  };
}
