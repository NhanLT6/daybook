import type { VercelRequest, VercelResponse } from '@vercel/node';

import axios from 'axios';

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
function encodeCredentials(email: string, apiToken: string): string {
  const credentials = `${email}:${apiToken}`;
  return Buffer.from(credentials, 'utf-8').toString('base64');
}

function normalizeDomain(domain: string): string {
  let normalized = domain.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/\.atlassian\.net.*$/i, '');
  normalized = normalized.replace(/\.(com|net|org|io)$/i, '');
  normalized = normalized.replace(/\/.*$/, '');
  return normalized.trim();
}

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

    // Normalize domain and create Jira API URL
    const cleanDomain = normalizeDomain(domain);
    const baseURL = `https://${cleanDomain}.atlassian.net/rest/api/3`;
    const authToken = encodeCredentials(email, apiToken);
    const jql = buildJqlQuery(projectKey, statuses);

    const response = await axios.get<JiraSearchResponse>(`${baseURL}/search/jql`, {
      headers: {
        Authorization: `Basic ${authToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      params: {
        jql,
        fields: 'summary,assignee,status,issuetype,description',
        maxResults: 100,
        startAt: 0,
      },
      timeout: 30000,
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
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseData = error.response?.data;

      // Log detailed error for debugging
      console.error('[Jira API Error]', {
        status,
        statusText,
        data: responseData,
        url: error.config?.url,
        params: error.config?.params,
      });

      const errorMessages: Record<number, string> = {
        400: 'Invalid request. Please check your project key and settings.',
        401: 'Authentication failed. Please check your credentials.',
        403: 'Access denied. Please check your permissions.',
        404: 'Project not found. Please verify your project key.',
        410: 'Resource no longer available. This may indicate an issue with the Jira API endpoint or your account permissions.',
        429: 'Rate limit exceeded. Please try again in a few minutes.',
      };

      let message: string;

      if (status) {
        const baseMessage = errorMessages[status] || 'Failed to fetch tickets';
        // Include Jira's error message if available
        const jiraError = responseData?.errorMessages?.[0] || responseData?.message;
        const detailMessage = jiraError ? ` Details: ${jiraError}` : '';
        message = `${baseMessage} (Status: ${status}${statusText ? ` - ${statusText}` : ''})${detailMessage}`;
      } else if (error.code === 'ECONNABORTED') {
        message = 'Connection timeout. Please check your internet connection.';
      } else if (error.code === 'ENOTFOUND') {
        message = 'Cannot reach Jira server. Please check your domain.';
      } else {
        message = `Network error: ${error.message}`;
      }

      return res.status(status || 500).json({
        success: false,
        message,
        statusCode: status,
        details: responseData, // Include full error response for debugging
      });
    }

    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: `An unexpected error occurred while fetching tickets: ${errorMessage}`,
      statusCode: 500,
    });
  }
}
