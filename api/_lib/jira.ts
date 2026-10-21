import { createHash } from 'node:crypto';

import axios, { type AxiosResponse } from 'axios';

import type { JiraConfig } from '../../src/interfaces/JiraConfig.js';
import { isMaskedSecret } from '../../src/interfaces/ServerSettings.js';
import { getSettings } from './settingsRepo.js';

// Shared Jira REST client for the api/jira handlers.
//
// Atlassian has two kinds of API tokens:
// - classic tokens work against the site URL (https://{site}.atlassian.net/rest/api/3)
// - scoped tokens (picked scopes like read:jira-work) are rejected there (401, sometimes 404) and only
//   work through the gateway: https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3
// Both use Basic email:token. needsGateway works out which one a token is before the real call.

export interface JiraCredentials {
  domain: string;
  email: string;
  apiToken: string;
}

/**
 * The caller's Jira settings with any unsaved edits from the request body on top. The browser never
 * holds the saved token: it sends the masked value (use the saved one), a new one to Test, or '' (none).
 */
export async function resolveJiraConfig(userId: string, body: Partial<JiraConfig> = {}): Promise<JiraConfig> {
  const { jiraConfig: stored } = await getSettings(userId);
  return {
    ...stored,
    domain: body.domain || stored.domain,
    email: body.email || stored.email,
    apiToken: body.apiToken === undefined || isMaskedSecret(body.apiToken) ? stored.apiToken : body.apiToken,
    projectKey: body.projectKey || stored.projectKey,
  };
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

// (site + token) -> whether that token needs the gateway, so the probe runs once per warm instance
const gatewayCache = new Map<string, boolean>();

/**
 * A scoped token is not only refused by the site URL: some endpoints there answer 200 with empty
 * results (JRACLOUD-94545), so a 401/404 fallback is not enough. Probe /myself on the site URL once:
 * a classic token gets 200 there, a scoped token never does.
 */
async function needsGateway(site: string, creds: JiraCredentials, headers: Record<string, string>): Promise<boolean> {
  const key = `${site}:${createHash('sha256').update(`${creds.email}:${creds.apiToken}`).digest('hex')}`;
  const cached = gatewayCache.get(key);
  if (cached !== undefined) return cached;

  try {
    await axios.get(`https://${site}.atlassian.net/rest/api/3/myself`, { headers, timeout: 15000 });
    gatewayCache.set(key, false);
    return false;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status !== 401 && status !== 403 && status !== 404) throw error;
    gatewayCache.set(key, true);
    return true;
  }
}

export async function jiraGet<T>(
  creds: JiraCredentials,
  path: string,
  params?: Record<string, unknown>,
): Promise<AxiosResponse<T>> {
  const site = normalizeDomain(creds.domain);
  const headers = {
    Authorization: `Basic ${encodeCredentials(creds.email, creds.apiToken)}`,
    Accept: 'application/json',
  };

  const baseURL = (await needsGateway(site, creds, headers))
    ? `https://api.atlassian.com/ex/jira/${await getCloudId(site)}/rest/api/3`
    : `https://${site}.atlassian.net/rest/api/3`;

  return axios.get<T>(`${baseURL}${path}`, { headers, params, timeout: 30000 });
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
