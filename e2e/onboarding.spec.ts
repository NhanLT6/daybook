import { expect, type Page, test } from '@playwright/test';

/**
 * First-visit welcome in the chat. The config makes every other spec a returning visitor;
 * this one starts from an empty browser.
 */

// The welcome rises 0.9s after load; give it time to (not) appear
const pastWelcomeDelay = (page: Page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1500)));

test.describe('first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('opens the chat with a welcome whose suggestions answer without the AI, once', async ({ page }) => {
    const aiRequests: string[] = [];
    await page.route(/\/api\/(chat|help)$/, (route) => {
      aiRequests.push(route.request().url());
      return route.abort();
    });

    await page.goto('/');
    const welcome = page.locator('.chat-msg.is-ai', { hasText: 'welcome to Daybook' });
    await expect(welcome).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: 'Where is my data stored?' }).click();
    await expect(page.getByText('Only in this browser.')).toBeVisible();
    expect(aiRequests).toEqual([]);

    // No "Good morning" toast stacked on the welcome
    await expect(page.getByRole('status', { name: 'Notifications' })).toHaveCount(0);

    // A second visit doesn't open it again; the conversation is in History
    await page.reload();
    await expect(page.getByRole('link', { name: 'Notes' })).toBeVisible({ timeout: 20000 });
    await pastWelcomeDelay(page);
    await expect(welcome).toBeHidden();
    await page.keyboard.press('Control+k');
    await page.getByLabel('Message').press('ArrowUp'); // empty composer: ↑ opens History
    await expect(page.locator('.history-pill', { hasText: 'Where is my data stored?' })).toBeVisible();
  });
});

test('a returning visitor gets no welcome, and /help shows it on demand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Notes' })).toBeVisible({ timeout: 20000 });
  await pastWelcomeDelay(page);
  await expect(page.getByText('welcome to Daybook')).toBeHidden();

  await page.keyboard.press('Control+k');
  const input = page.getByLabel('Message');
  await input.fill('/he');
  await input.press('Enter');
  await expect(page.locator('.chat-msg.is-ai', { hasText: 'welcome to Daybook' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Do I need an account?' })).toBeVisible();
});
