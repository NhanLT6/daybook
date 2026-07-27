import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

import { AuthError, headerReader, requireUser } from '../_lib/neonAuth.js';

// Interface for request body
interface TestConnectionRequest {
  domain: string;
  email: string;
  apiToken: string;
}

// Helper to encode credentials
function encodeCredentials(email: string, apiToken: string): string {
  const credentials = `${email}:${apiToken}`;
  return Buffer.from(credentials, 'utf-8').toString('base64');
}

// Normalize domain
function normalizeDomain(domain: string): string {
  let normalized = domain.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/\.atlassian\.net.*$/i, '');
  normalized = normalized.replace(/\.(com|net|org|io)$/i, '');
  normalized = normalized.replace(/\/.*$/, '');
  return normalized.trim();
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

    // Normalize domain and create Jira API URL
    const cleanDomain = normalizeDomain(domain);
    const baseURL = `https://${cleanDomain}.atlassian.net/rest/api/3`;
    const authToken = encodeCredentials(email, apiToken);

    // Make request to Jira API
    const response = await axios.get(`${baseURL}/myself`, {
      headers: {
        Authorization: `Basic ${authToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return res.status(200).json({
      success: true,
      message: `Connected successfully! Welcome, ${response.data.displayName}`,
      user: {
        accountId: response.data.accountId,
        displayName: response.data.displayName,
        emailAddress: response.data.emailAddress,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.errorMessages?.[0] || error.response?.data?.message || error.message;

      return res.status(status).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
