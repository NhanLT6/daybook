import type { JiraConfig } from '@/interfaces/JiraConfig';
import type { JiraTicket } from '@/interfaces/JiraTicket';

import { httpClient } from './httpClient';

// API route base URL (relative path works for both dev and production)
const API_BASE_URL = '/api';

// Response interfaces from Vercel API
interface TestConnectionResponse {
  success: boolean;
  message: string;
  statusCode?: number;
  user?: {
    accountId: string;
    displayName: string;
    emailAddress: string;
  };
}

interface FetchTicketsResponse {
  success: boolean;
  tickets?: JiraTicket[];
  total?: number;
  message?: string;
  statusCode?: number;
}

// Test connection to Jira via Vercel API
export const testJiraConnection = async (
  config: JiraConfig,
): Promise<{ success: boolean; message: string; user?: any }> => {
  try {
    const response = await httpClient.post<TestConnectionResponse>(`${API_BASE_URL}/jira/test-connection`, {
      domain: config.domain,
      email: config.email,
      apiToken: config.apiToken,
    });

    return response.data;
  } catch (error: any) {
    // Extract error message from response
    const message = error.response?.data?.message || 'Failed to connect to Jira';
    return { success: false, message };
  }
};

// Fetch tickets from Jira via Vercel API
export const fetchJiraTickets = async (
  config: JiraConfig,
  statuses: string[] = ['To Do', 'In Progress', 'In Review', 'Done', 'QA'],
): Promise<JiraTicket[]> => {
  const response = await httpClient.post<FetchTicketsResponse>(`${API_BASE_URL}/jira/fetch-tickets`, {
    domain: config.domain,
    email: config.email,
    apiToken: config.apiToken,
    projectKey: config.projectKey,
    statuses,
  });

  if (!response.data.success || !response.data.tickets) {
    throw new Error(response.data.message || 'Failed to fetch tickets');
  }

  return response.data.tickets;
};
