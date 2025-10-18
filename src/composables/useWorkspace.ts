import { computed } from 'vue';

import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useStorage } from '@vueuse/core';

import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';
import { uniq, uniqBy } from 'lodash';

/**
 * Composable for managing workspace data: projects, tasks, and Jira integration
 *
 * Naming Convention:
 * - myInputtedProjects/myInputtedTasks = User's manually created projects/tasks (stored in localStorage)
 * - teamWorkProjects/teamWorkTasks = Built-in default projects/tasks (Team work, Code review, etc.)
 * - Jira projects = Projects with `jira` metadata (stored in projects array)
 * - allMyProjects/allMyTasks = Final merged list shown to users in dropdowns
 */
export function useWorkspace() {
  // --- User's Manually Inputted Data (localStorage) ---
  const myInputtedTasks = useStorage<Task[]>(storageKeys.tasks, []);
  const myInputtedProjects = useStorage<Project[]>(storageKeys.projects, []);

  // --- Settings & Jira Integration ---
  const settingsStore = useSettingsStore();

  // --- Team Work Preset Data ---
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
    if (
      settingsStore.useDefaultTasks &&
      myInputtedTasks.value.length === 0 &&
      myInputtedProjects.value.length === 0
    ) {
      // Initialize with team work preset tasks and projects
      myInputtedProjects.value = [...teamWorkProjects];
      myInputtedTasks.value = [...teamWorkTasks];
    }
  };

  /**
   * Get all my projects (merged from user inputted, team work preset, and Jira)
   * Returns unique project titles as array of strings
   */
  const allMyProjects = computed(() => {
    const sources: Project[] = [];

    // Add user's manually inputted projects (always included)
    // This includes both regular projects and Jira projects (projects with `jira` metadata)
    sources.push(...myInputtedProjects.value);

    // Add team work preset projects if enabled in settings
    if (settingsStore.useDefaultTasks) {
      sources.push(...teamWorkProjects);
    }

    // Return unique project titles
    return uniq(uniqBy(sources, 'title').map((project) => project.title));
  });

  /**
   * Get all my tasks for a specific project
   * Returns unique task titles as array of strings
   * For Jira tickets, uses the ticket title as both project and task
   *
   * @param projectTitle - The project to get tasks for
   */
  const allMyTasks = computed(() => (projectTitle?: string) => {
    if (!projectTitle) return [];

    const sources: Task[] = [];

    // Add user's manually inputted tasks (always included)
    sources.push(...myInputtedTasks.value);

    // Add team work preset tasks if enabled in settings
    if (settingsStore.useDefaultTasks) {
      sources.push(...teamWorkTasks);
    }

    // Add Jira ticket as task if the project is a Jira ticket
    // For Jira tickets, the ticket title is used as both project and task
    if (settingsStore.jiraConfig.enabled) {
      const jiraProject = myInputtedProjects.value.find((p) => p.jira && p.title === projectTitle);
      if (jiraProject) {
        sources.push({
          title: projectTitle, // Use the same title as project for Jira tickets
          project: projectTitle,
        });
      }
    }

    // Filter by project and return unique task titles
    return uniq(
      uniqBy(
        sources.filter((task) => task.project === projectTitle),
        'title',
      ).map((task) => task.title),
    );
  });

  /**
   * Get all tasks grouped by project
   * Returns object mapping project titles to array of task titles
   *
   * Example: { "Team work": ["Daily meeting", "Code review"], ... }
   */
  const tasksByProject = computed(() => {
    const sources: Task[] = [];

    // Add user's manually inputted tasks (always included)
    sources.push(...myInputtedTasks.value);

    // Add team work preset tasks if enabled in settings
    if (settingsStore.useDefaultTasks) {
      sources.push(...teamWorkTasks);
    }

    // Group by project
    return allMyProjects.value.reduce(
      (acc, projectTitle) => {
        // Filter regular tasks for this project
        const regularTasks = sources.filter((task) => task.project === projectTitle);

        // Check if this is a Jira project - if so, add it as its own task
        if (settingsStore.jiraConfig.enabled && isJiraProject(projectTitle)) {
          regularTasks.push({
            title: projectTitle,
            project: projectTitle,
          });
        }

        acc[projectTitle] = uniq(uniqBy(regularTasks, 'title').map((task) => task.title));
        return acc;
      },
      {} as Record<string, string[]>,
    );
  });

  /**
   * Check if a project is from Jira
   *
   * @param projectTitle - The project title to check
   */
  const isJiraProject = (projectTitle: string): boolean => {
    return myInputtedProjects.value.some((project) => project.jira && project.title === projectTitle);
  };

  /**
   * Get full Project object by title
   * Useful for accessing Jira metadata
   *
   * @param projectTitle - The project title to find
   */
  const getProjectByTitle = (projectTitle: string): Project | undefined => {
    // Search in projects array (includes both regular and Jira projects)
    return myInputtedProjects.value.find((p) => p.title === projectTitle);
  };

  return {
    // Raw data sources
    myInputtedTasks,
    myInputtedProjects,
    teamWorkTasks,
    teamWorkProjects,

    // Computed merged data (what UI should use)
    allMyProjects,
    allMyTasks,
    tasksByProject,

    // Helper functions
    initTeamWorkPreset,
    isJiraProject,
    getProjectByTitle,

    // Backward compatibility aliases (for existing code)
    customTasks: myInputtedTasks,
    customProjects: myInputtedProjects,
    presetTasks: teamWorkTasks,
    presetProjects: teamWorkProjects,
    availableProjects: allMyProjects,
    availableTasks: allMyTasks,
    initializePresets: initTeamWorkPreset,
  };
}
