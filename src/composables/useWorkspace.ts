import { computed } from 'vue';

import { useJira } from '@/composables/useJira';

import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useStorage } from '@vueuse/core';

import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';
import { uniq, uniqBy } from 'lodash';

export function useWorkspace() {
  const allTasks = useStorage<Task[]>(storageKeys.tasks, []);
  const allProjects = useStorage<Project[]>(storageKeys.projects, []);
  const pinnedProjects = useStorage<string[]>(storageKeys.pinnedProjects, []);

  const settingsStore = useSettingsStore();
  const { myJiraProjects, teamJiraProjects } = useJira();

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
   * This is called manually from components when needed
   */
  const initTeamWorkPreset = () => {
    if (settingsStore.useDefaultTasks && allTasks.value.length === 0 && allProjects.value.length === 0) {
      // Initialize with team work preset tasks and projects
      allProjects.value = [...teamWorkProjects];
      allTasks.value = [...teamWorkTasks];
    }
  };

  /**
   * Get all my projects (merged from user inputted, team work preset, and Jira)
   */
  const myProjects = computed(() => {
    const projects: Project[] = [
      ...allProjects.value,
      ...myJiraProjects.value,
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

  const pinProject = (title: string) => {
    if (!pinnedProjects.value.includes(title)) {
      pinnedProjects.value.push(title);
    }
  };

  const unpinProject = (title: string) => {
    pinnedProjects.value = pinnedProjects.value.filter((t) => t !== title);
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

  return {
    allTasks,
    allProjects,
    teamWorkTasks,
    teamWorkProjects,

    myProjects,
    sortedProjectTitles,
    pinProject,
    unpinProject,
    isPinned,
    getTasksByProject,
    codeReviewDescriptions,

    initTeamWorkPreset,
  };
}
