// Jira ticket interface (flattened structure)
export interface JiraTicket {
  key: string; // e.g., "ABC-123"
  summary: string;
  assigneeDisplayName?: string;
  assigneeEmail?: string;
  assigneeAccountId?: string;
  statusName: string;
  issueTypeName: string;
  description?: string;
}
