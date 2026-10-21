import type { VercelRequest, VercelResponse } from '@vercel/node';

import { jiraErrorMessage, jiraGet } from '../_lib/jira.js';
import { AuthError, headerReader, requireUser } from '../_lib/neonAuth.js';

interface StatusesRequest {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

// GET /project/{key}/statuses answers per issue type, so the same status repeats across types
interface JiraIssueTypeStatuses {
  statuses: { name: string; statusCategory?: { key: string } }[];
}

// Workflow order: To Do -> In Progress -> Done
const categoryOrder: Record<string, number> = { new: 0, indeterminate: 1, done: 2 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Gated like the other Jira proxies so it is not an anonymous credential prober
    await requireUser(headerReader(req));

    const { domain, email, apiToken, projectKey } = req.body as StatusesRequest;
    if (!domain || !email || !apiToken || !projectKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: domain, email, apiToken, projectKey',
      });
    }

    const { data } = await jiraGet<JiraIssueTypeStatuses[]>(
      { domain, email, apiToken },
      `/project/${encodeURIComponent(projectKey.trim())}/statuses`,
    );

    const byName = new Map<string, number>();
    for (const status of data.flatMap((issueType) => issueType.statuses)) {
      if (!byName.has(status.name)) byName.set(status.name, categoryOrder[status.statusCategory?.key ?? ''] ?? 1);
    }
    const statuses = [...byName.entries()]
      .sort(([nameA, orderA], [nameB, orderB]) => orderA - orderB || nameA.localeCompare(nameB))
      .map(([name]) => name);

    return res.status(200).json({ success: true, statuses });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    const { status, message } = jiraErrorMessage(error, 'Failed to fetch statuses');
    return res.status(status).json({ success: false, message });
  }
}
