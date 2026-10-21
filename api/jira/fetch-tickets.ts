import type { VercelRequest, VercelResponse } from '@vercel/node';

import { jiraErrorMessage, jiraGet } from '../_lib/jira.js';
import { AuthError, headerReader, requireUser } from '../_lib/neonAuth.js';

// Interface for request body
interface FetchTicketsRequest {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
  statuses?: string[];
}

// Jira API response interfaces
interface JiraApiIssue {
  key: string;
  fields: {
    summary: string;
    assignee?: {
      displayName: string;
      emailAddress: string;
      accountId: string;
    } | null;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    description?: string;
  };
}

interface JiraSearchResponse {
  issues: JiraApiIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

// Helper functions
function buildJqlQuery(projectKey: string, statuses: string[]): string {
  const statusList = statuses.map((status) => `"${status}"`).join(',');
  return `project = ${projectKey} AND status IN (${statusList}) AND sprint in openSprints() ORDER BY created DESC`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Gated so this cannot be used as an anonymous proxy for probing Atlassian
    // credentials from our domain. The Jira credentials themselves still come
    // from the caller's own request body.
    await requireUser(headerReader(req));

    const { domain, email, apiToken, projectKey, statuses } = req.body as FetchTicketsRequest;

    // Validate required fields
    if (!domain || !email || !apiToken || !projectKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: domain, email, apiToken, projectKey',
      });
    }

    // Validate statuses array
    if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid statuses field. Expected a non-empty array of status names.',
      });
    }

    const jql = buildJqlQuery(projectKey, statuses);

    const response = await jiraGet<JiraSearchResponse>({ domain, email, apiToken }, '/search/jql', {
      jql,
      fields: 'summary,assignee,status,issuetype,description',
      maxResults: 100,
      startAt: 0,
    });

    // Transform and return tickets (flattened structure)
    const tickets = response.data.issues.map((issue) => {
      // Clean summary: remove ticket key if it's prefixed (e.g., "[DS-3774] " or "DS-3774: ")
      let cleanSummary = issue.fields.summary;
      const bracketPattern = new RegExp(`^\\[${issue.key}\\]\\s*`, 'i');
      const colonPattern = new RegExp(`^${issue.key}:\\s*`, 'i');

      cleanSummary = cleanSummary.replace(bracketPattern, '').replace(colonPattern, '');

      return {
        key: issue.key,
        summary: cleanSummary,
        assigneeDisplayName: issue.fields.assignee?.displayName,
        assigneeEmail: issue.fields.assignee?.emailAddress,
        assigneeAccountId: issue.fields.assignee?.accountId,
        statusName: issue.fields.status.name,
        issueTypeName: issue.fields.issuetype.name,
        description: issue.fields.description,
      };
    });

    return res.status(200).json({
      success: true,
      tickets,
      total: response.data.total,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    const { status, message } = jiraErrorMessage(error, 'Failed to fetch tickets');
    return res.status(status).json({ success: false, message });
  }
}
