import axios, { type AxiosResponse } from 'axios';

// Shared Jira REST client for the api/jira handlers.
//
// Atlassian has two kinds of API tokens:
// - classic tokens work against the site URL (https://{site}.atlassian.net/rest/api/3)
// - scoped tokens (picked scopes like read:jira-work) are rejected there with a 401 and only
//   work through the gateway: https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3
// Both use Basic email:token. We try the site URL first and fall back to the gateway on a 401.

export interface JiraCredentials {
  domain: string;
  email: string;
  apiToken: string;
}

// Site subdomain -> cloudId, kept for the life of the warm function instance
const cloudIdCache = new Map<string, string>();

export function normalizeDomain(domain: string): string {
  let normalized = domain.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/\.atlassian\.net.*$/i, '');
  normalized = normalized.replace(/\.(com|net|org|io)$/i, '');
  normalized = normalized.replace(/\/.*$/, '');
  return normalized.trim();
}

function encodeCredentials(email: string, apiToken: string): string {
  return Buffer.from(`${email}:${apiToken}`, 'utf-8').toString('base64');
}

// Public endpoint, no auth needed
async function getCloudId(site: string): Promise<string> {
  const cached = cloudIdCache.get(site);
  if (cached) return cached;

  const { data } = await axios.get<{ cloudId: string }>(`https://${site}.atlassian.net/_edge/tenant_info`, {
    timeout: 15000,
  });
  cloudIdCache.set(site, data.cloudId);
  return data.cloudId;
}

export async function jiraGet<T>(
  creds: JiraCredentials,
  path: string,
  params?: Record<string, unknown>,
): Promise<AxiosResponse<T>> {
  const site = normalizeDomain(creds.domain);
  const config = {
    headers: {
      Authorization: `Basic ${encodeCredentials(creds.email, creds.apiToken)}`,
      Accept: 'application/json',
    },
    params,
    timeout: 30000,
  };

  try {
    return await axios.get<T>(`https://${site}.atlassian.net/rest/api/3${path}`, config);
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;

    // Likely a scoped token: retry through the gateway. If the cloudId lookup fails, keep the original 401.
    const cloudId = await getCloudId(site).catch(() => {
      throw error;
    });
    return axios.get<T>(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3${path}`, config);
  }
}

export function jiraErrorMessage(error: unknown, fallback: string): { status: number; message: string } {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 500;
    const data = error.response?.data;
    const detail = data?.errorMessages?.[0] || data?.message || error.message;
    if (status === 401) {
      return {
        status,
        message: `Jira rejected the credentials (${detail}). Check the email and token, and for a scoped token that it has read:jira-work.`,
      };
    }
    return { status, message: detail };
  }
  return { status: 500, message: error instanceof Error ? error.message : fallback };
}
