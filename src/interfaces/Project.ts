export interface Project {
  title: string;

  jira?: {
    ticketKey: string; // e.g., "ABC-123"
    assigneeEmail?: string;
    assigneeName?: string;
    status?: string;
  };
}
