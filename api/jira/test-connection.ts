import type { VercelRequest, VercelResponse } from '@vercel/node';

import { jiraErrorMessage, jiraGet } from '../_lib/jira.js';
import { AuthError, headerReader, requireUser } from '../_lib/neonAuth.js';

// Interface for request body
interface TestConnectionRequest {
  domain: string;
  email: string;
  apiToken: string;
}

interface JiraMyself {
  accountId: string;
  displayName: string;
  emailAddress?: string;
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

    const { domain, email, apiToken } = req.body as TestConnectionRequest;

    // Validate required fields
    if (!domain || !email || !apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: domain, email, apiToken'
      });
    }

    const creds = { domain, email, apiToken };

    try {
      const { data } = await jiraGet<JiraMyself>(creds, '/myself');
      return res.status(200).json({
        success: true,
        message: `Connected successfully! Welcome, ${data.displayName}`,
        user: {
          accountId: data.accountId,
          displayName: data.displayName,
          emailAddress: data.emailAddress,
        },
      });
    } catch {
      // A scoped token with only issue/board read scopes cannot read /myself.
      // What the app needs is issue search, so test that before giving up.
      await jiraGet(creds, '/search/jql', { jql: 'order by created DESC', maxResults: 1, fields: 'summary' });
      return res.status(200).json({
        success: true,
        message: 'Connected successfully! The token can read issues.',
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    const { status, message } = jiraErrorMessage(error, 'Connection failed');
    return res.status(status).json({ success: false, message });
  }
}
