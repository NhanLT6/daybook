import { computed, onMounted } from 'vue';
import { useStorage } from '@vueuse/core';
import { uniq, uniqBy } from 'lodash';

import type { XeroProject } from '@/interfaces/XeroProject';
import type { XeroTask } from '@/interfaces/XeroTask';
import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';

export function useDefaultTasksProjects() {
  const tasks = useStorage<XeroTask[]>(storageKeys.xeroTasks, []);
  const projects = useStorage<XeroProject[]>(storageKeys.xeroProjects, []);
  const settingsStore = useSettingsStore();

  const defaultTasks = [
    { title: 'Daily meeting', project: 'Team work' },
    { title: 'Code review', project: 'Team work' },
    { title: 'Retro', project: 'Team work' },
    { title: 'Grooming', project: 'Team work' },
    { title: 'Planning', project: 'Team work' },
    { title: 'Demo', project: 'Team work' },
    { title: 'Team meeting', project: 'Team work' },
  ];

  const defaultProjects = uniqBy(
    defaultTasks.map((task) => ({ title: task.project })),
    'title',
  );

  // Initialize default tasks if they don't exist and setting is enabled
  onMounted(() => {
    if (settingsStore.useDefaultTasks && tasks.value.length === 0 && projects.value.length === 0) {
      // Initialize with default tasks and projects
      projects.value = [...defaultProjects];
      tasks.value = [...defaultTasks];
    }
  });

  const projectItems = computed(() => {
    const allProjects = settingsStore.useDefaultTasks 
      ? [...projects.value, ...defaultProjects] 
      : projects.value;
    return uniq(uniqBy(allProjects, 'title').map((project) => project.title));
  });

  const taskItems = computed(() => (projectTitle?: string) => {
    if (!projectTitle) return [];
    const allTasks = settingsStore.useDefaultTasks 
      ? [...tasks.value, ...defaultTasks] 
      : tasks.value;
    return uniq(
      uniqBy(
        allTasks.filter((t) => t.project === projectTitle),
        'title',
      ).map((task) => task.title),
    );
  });

  const tasksByProject = computed(() => {
    const allTasks = settingsStore.useDefaultTasks 
      ? [...tasks.value, ...defaultTasks] 
      : tasks.value;
    return projectItems.value.reduce((acc, projectTitle) => {
      acc[projectTitle] = uniq(
        uniqBy(
          allTasks.filter((t) => t.project === projectTitle),
          'title',
        ).map((task) => task.title),
      );
      return acc;
    }, {} as Record<string, string[]>);
  });

  return {
    tasks,
    projects,
    defaultTasks,
    defaultProjects,
    projectItems,
    taskItems,
    tasksByProject,
  };
}