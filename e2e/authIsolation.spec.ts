import { expect, type Page, test } from '@playwright/test';
import { Client } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

/**
 * The security property that matters: credentials are stored per Neon Auth account
 * and one user can never read another's. Requires the API to be running
 * (`yarn dev:api`) — vite proxies /api to it.
 */

for (const f of ['.env', '.env.local', '.env.development.local']) {
  dotenv.config({ path: resolve(process.cwd(), f) });
}

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now());
const userA = { email: `daybook-a-${stamp}@example.com`, password: 'test-password-123', name: 'User A' };
const userB = { email: `daybook-b-${stamp}@example.com`, password: 'test-password-456', name: 'User B' };
const KEY_A = `AIza-fake-key-${stamp}-A`;

async function db<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client(process.env.NEON_CONNECTION_STRING);
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

async function signUp(page: Page, user: typeof userA) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Create an account/i }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(user.name);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email);
  // The show/hide eye button is also labelled "Password", so scope to the textbox.
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible({ timeout: 20000 });
}

/** The card that directly owns the title — a bare hasText filter also matches the grid. */
const aiCard = (page: Page) => page.locator('.v-card:has(> .v-card-title:text-is("AI Assistant"))');
const geminiKeyField = (page: Page) => page.getByRole('textbox', { name: 'Gemini API Key', exact: true });

test.afterAll(async () => {
  // Cascades to user_settings.
  await db(`delete from neon_auth."user" where email = any($1)`, [[userA.email, userB.email]]);
});

test('user A saves a Gemini key against their own account', async ({ page }) => {
  await page.goto('/');
  await signUp(page, userA);

  await page.goto('/setting');
  const card = aiCard(page);
  await expect(card).toBeVisible({ timeout: 20000 });

  const save = card.getByRole('button', { name: /Save credentials/i });
  await expect(save, 'save is disabled — the session did not survive navigation').toBeEnabled({ timeout: 20000 });

  await card.locator('input[type="checkbox"]').first().click();
  await geminiKeyField(page).fill(KEY_A);
  await save.click();
  await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 20000 });

  const rows = await db<{ ai_config: { apiKey?: string } }>(
    `select s.ai_config from public.user_settings s
       join neon_auth."user" u on u.id = s.user_id
      where u.email = $1`,
    [userA.email],
  );
  expect(rows, 'no settings row written for user A').toHaveLength(1);
  expect(rows[0].ai_config.apiKey).toBe(KEY_A);
});

test('user B cannot see user A credentials', async ({ page }) => {
  await page.goto('/');
  await signUp(page, userB);

  await page.goto('/setting');
  await expect(aiCard(page)).toBeVisible({ timeout: 20000 });

  // B's form must be empty — never seeded from A's row.
  await expect(geminiKeyField(page)).toHaveValue('');

  // And B's own token must resolve to B's (empty) settings, not A's.
  const settings = await page.evaluate(async () => {
    const mod = await import('/src/composables/useAuth.ts');
    const headers = await mod.authHeaders();
    const res = await fetch('/api/settings', { headers: headers ?? {} });
    return { status: res.status, body: await res.json() };
  });

  expect(settings.status).toBe(200);
  expect(JSON.stringify(settings.body)).not.toContain(KEY_A);
  expect(settings.body.aiConfig.apiKey).toBe('');
});

test('the API rejects unauthenticated and forged tokens', async ({ page }) => {
  await page.goto('/');

  const results = await page.evaluate(async () => {
    const none = await fetch('/api/settings');
    const forged = await fetch('/api/settings', { headers: { Authorization: 'Bearer not-a-real-token' } });
    return { none: none.status, forged: forged.status };
  });

  expect(results.none).toBe(401);
  expect(results.forged).toBe(401);
});
