export interface JiraProject {
  title: string;

  jiraTicketKey: string; // e.g., "ABC-123"
  jiraAssigneeEmail?: string;
  jiraAssigneeName?: string;
  jiraStatus?: string;
}
