import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

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

    // Return success response
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
      });

      // Map status codes to user-friendly messages
      const errorMessages: Record<number, string> = {
        401: 'Authentication failed. Please check your email and API token.',
        403: 'Access denied. Please check your permissions.',
        404: 'Jira instance not found. Please verify your domain.',
        410: 'Resource no longer available. This may indicate an issue with the Jira API endpoint or your account permissions.',
        429: 'Rate limit exceeded. Please try again in a few minutes.',
      };

      let message: string;

      if (status) {
        const baseMessage = errorMessages[status] || 'Connection failed';
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
      message: `An unexpected error occurred: ${errorMessage}`,
      statusCode: 500,
    });
  }
}
