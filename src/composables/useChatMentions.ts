import { computed } from 'vue';

import { type ChatMention, TASK_SEPARATOR } from '@/common/chatMentions';
import { useJira } from '@/composables/useJira';
import { useWorkspace } from '@/composables/useWorkspace';

import { uniqBy } from 'lodash';

/**
 * Everything the chat's `/` menu can mention, most likely first: recent Project › Task pairs and recent
 * projects, then pinned and the rest alphabetically, then the remaining tasks. Jira tickets are projects
 * whose title is the ticket (`DS-123 Summary`).
 */
export function useChatMentions() {
  const { myProjects, allTasks, sortedProjectTitles, recentProjectTitles, recentProjectTasks } = useWorkspace();
  const { myJiraProjects } = useJira();

  const mentions = computed((): ChatMention[] => {
    const jiraTitles = new Set(myJiraProjects.value.map((p) => p.title));
    const projectTitles = new Set(myProjects.value.map((p) => p.title));

    const project = (title: string): ChatMention => ({
      label: title,
      kind: jiraTitles.has(title) ? 'jira' : 'project',
      project: title,
    });
    const task = (projectTitle: string, title: string): ChatMention => ({
      label: `${projectTitle}${TASK_SEPARATOR}${title}`,
      kind: 'task',
      project: projectTitle,
      task: title,
    });

    const list: ChatMention[] = [
      ...recentProjectTasks.value.map((t) => task(t.project, t.task)),
      ...recentProjectTitles.value.map(project),
      ...sortedProjectTitles.value.map(project),
      // A task named like its project (Jira) adds nothing over the project itself
      ...allTasks.value
        .filter((t) => projectTitles.has(t.project) && t.title !== t.project)
        .map((t) => task(t.project, t.title)),
    ];
    return uniqBy(list, (m) => m.label);
  });

  const labels = computed(() => mentions.value.map((m) => m.label));

  return { mentions, labels };
}
