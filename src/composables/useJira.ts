import { computed, ref } from 'vue';

import type { JiraProject } from '@/interfaces/JiraProject';
import type { JiraTicket } from '@/interfaces/JiraTicket';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { fetchJiraTickets, testJiraConnection as testJiraConnectionApi } from '@/apis/jiraApi';
import { shortDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';
import { differenceBy } from 'lodash';
import { toast } from 'vue-sonner';

export function useJira() {
  // Separate loading states for different operations (TanStack Query style)
  const isSyncing = ref(false);
  const isTesting = ref(false);
  const error = ref<string | null>(null);

  // Storage for last sync date - tracks when we last auto-synced
  const lastSyncDate = useStorage<string | null>(storageKeys.jira.lastSyncDate, null);

  const jiraProjects = useStorage<JiraProject[]>(storageKeys.jiraProjects, []);

  const { jiraConfig } = useSettingsStore();

  const transformTicketToJiraProject = (ticket: JiraTicket): JiraProject => ({
    title: `${ticket.key} ${ticket.summary}`,

    jiraTicketKey: ticket.key,
    jiraAssigneeEmail: ticket.assigneeEmail,
    jiraAssigneeName: ticket.assigneeDisplayName,
    jiraStatus: ticket.statusName,
  });

  /**
   * Check if we need to sync today (only for auto-sync)
   * Returns true if last sync was on a different day
   */
  const shouldAutoSync = (): boolean => {
    if (!jiraConfig.enabled) return false;

    if (!lastSyncDate.value) {
      return true; // Never synced before
    }

    const today = dayjs().format(shortDateFormat);
    return lastSyncDate.value !== today;
  };

  const syncTicketsToLocalStorage = async (): Promise<{ fetched: number; saved: number }> => {
    isSyncing.value = true;
    error.value = null;

    try {
      const tickets = await fetchJiraTickets(jiraConfig);
      const newJiraProjects = tickets.map(transformTicketToJiraProject);
      const projectsToAdd = differenceBy(newJiraProjects, jiraProjects.value, (p) => p.title);
      jiraProjects.value.push(...projectsToAdd);

      lastSyncDate.value = dayjs().format(shortDateFormat);

      return {
        fetched: tickets.length,
        saved: projectsToAdd.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync Jira tickets';
      error.value = message;
      throw new Error(message);
    } finally {
      isSyncing.value = false;
    }
  };

  /**
   * Test Jira connection with user feedback (toast notifications)
   * TanStack Query style - handles loading state and error handling internally
   */
  const testConnection = async (): Promise<void> => {
    isTesting.value = true;

    try {
      const result = await testJiraConnectionApi(jiraConfig);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Connection test failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      isTesting.value = false;
    }
  };

  const myJiraProjects = computed((): JiraProject[] => {
    return jiraProjects.value.filter(
      (project) => project.jiraAssigneeEmail?.toLowerCase() === jiraConfig.email.toLowerCase(),
    );
  });

  const teamJiraProjects = computed((): JiraProject[] => {
    return jiraProjects.value.filter(
      (project) => project.jiraAssigneeEmail?.toLowerCase() !== jiraConfig.email.toLowerCase(),
    );
  });

  return {
    isSyncing,
    isTesting,
    error,

    testConnection,
    syncTicketsToLocalStorage,
    shouldAutoSync,

    myJiraProjects,
    teamJiraProjects,
  };
}
