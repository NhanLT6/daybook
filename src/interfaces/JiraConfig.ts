// Jira configuration interface
export interface JiraConfig {
  enabled: boolean;
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
  statuses: string; // Semi-colon separated list of statuses (e.g., "To Do;In Progress;Done")
}
