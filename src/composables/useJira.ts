import { ref } from 'vue';

import type { JiraTicket } from '@/interfaces/JiraTicket';
import type { Project } from '@/interfaces/Project';

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

  // Storage for current month's projects
  const projects = useStorage<Project[]>(storageKeys.projects, []);

  const { jiraConfig } = useSettingsStore();

  /**
   * Validate if all required Jira configurations are provided
   * @returns true if all required configs are present, false otherwise
   */
  const validateJiraConfigs = (): boolean => {
    return !!(
      jiraConfig.enabled &&
      jiraConfig.domain &&
      jiraConfig.email &&
      jiraConfig.apiToken &&
      jiraConfig.projectKey
    );
  };

  /**
   * Transform JiraTicket to Project format for storage
   */
  const transformTicketToProject = (ticket: JiraTicket): Project => ({
    title: `${ticket.key} ${ticket.summary}`,
    jira: {
      ticketKey: ticket.key,
      assigneeEmail: ticket.assigneeEmail,
      assigneeName: ticket.assigneeDisplayName,
      status: ticket.statusName,
    },
  });

  /**
   * Check if we need to sync today (only for auto-sync)
   * Returns true if last sync was on a different day
   */
  const shouldAutoSync = (): boolean => {
    if (!lastSyncDate.value) {
      return true; // Never synced before
    }

    const today = dayjs().format(shortDateFormat);
    return lastSyncDate.value !== today;
  };

  /**
   * Fetch Jira tickets and save them as Projects to localStorage
   * Uses the Vercel API proxy to bypass CORS
   * Internal method used by both auto-sync and manual sync
   */
  const syncTicketsToLocalStorage = async (): Promise<void> => {
    isSyncing.value = true;
    error.value = null;

    try {
      // Fetch tickets via Vercel serverless function
      const tickets = await fetchJiraTickets(jiraConfig);
      const jiraProjects = tickets.map(transformTicketToProject);

      const newProjects = differenceBy(jiraProjects, projects.value, (p) => p.title);
      projects.value.push(...newProjects);

      lastSyncDate.value = dayjs().format(shortDateFormat);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync Jira tickets';
      error.value = message;
      throw new Error(message);
    } finally {
      isSyncing.value = false;
    }
  };

  /**
   * Manual sync with user feedback (toast notifications)
   * TanStack Query style - handles loading state and error handling internally
   */
  const syncTickets = async (): Promise<void> => {
    try {
      await syncTicketsToLocalStorage();
      toast.success(`Successfully synced ${getAllTickets().length} ticket(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync Jira tickets');
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
      toast.error(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      isTesting.value = false;
    }
  };

  /**
   * Get tickets assigned to the current user
   * @param userEmail - Current user's email address
   */
  const getMyTickets = (userEmail: string): Project[] => {
    return projects.value.filter((project) => project.jira?.assigneeEmail?.toLowerCase() === userEmail.toLowerCase());
  };

  /**
   * Get tickets assigned to other team members (not current user)
   * @param userEmail - Current user's email address
   */
  const getTeamTickets = (userEmail: string): Project[] => {
    return projects.value.filter(
      (project) => project.jira?.assigneeEmail && project.jira.assigneeEmail.toLowerCase() !== userEmail.toLowerCase(),
    );
  };

  /**
   * Get all Jira tickets from localStorage
   */
  const getAllTickets = (): Project[] => {
    return projects.value.filter((project) => project.jira != null);
  };

  /**
   * Clear all Jira tickets from localStorage
   */
  const clearTickets = (): void => {
    projects.value = projects.value.filter((project) => project.jira == null);
  };

  return {
    // Loading states (TanStack Query style - consumers don't manage these)

    isSyncing,
    isTesting,
    error,

    // User-facing methods with built-in loading & error handling
    testConnection,
    syncTickets,

    // Internal methods (for auto-sync and advanced use cases)
    validateJiraConfigs,
    syncTicketsToLocalStorage,
    shouldAutoSync,

    // Data access methods
    getMyTickets,
    getTeamTickets,
    getAllTickets,
    clearTickets,
  };
}
