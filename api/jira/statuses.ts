import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { JiraConfig } from '../../src/interfaces/JiraConfig.js';
import { jiraErrorMessage, jiraGet, resolveJiraConfig } from '../_lib/jira.js';
import { AuthError, headerReader, requireUser } from '../_lib/neonAuth.js';

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
    const { userId } = await requireUser(headerReader(req));

    const creds = await resolveJiraConfig(userId, (req.body ?? {}) as Partial<JiraConfig>);
    if (!creds.domain || !creds.email || !creds.apiToken || !creds.projectKey) {
      return res.status(400).json({
        success: false,
        message: 'Jira domain, email, API token and project key are required',
      });
    }

    const { data } = await jiraGet<JiraIssueTypeStatuses[]>(
      creds,
      `/project/${encodeURIComponent(creds.projectKey.trim())}/statuses`,
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
