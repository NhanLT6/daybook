// Jira configuration interface
export interface JiraConfig {
  enabled: boolean;
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}
