import { expect, type Page, type Route, test } from '@playwright/test';

/**
 * Slash commands and the client-side addNote / addEvent tools. /api/chat is mocked with
 * AI SDK UI message stream chunks (same as chatSearchNotes.spec), so no API key is needed.
 */

const sse = (chunks: object[]) =>
  [...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`), 'data: [DONE]\n\n'].join('');

const fulfillStream = (route: Route, chunks: object[]) =>
  route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
    body: sse(chunks),
  });

const toolCall = (toolName: string, input: object) => [
  { type: 'start' },
  { type: 'start-step' },
  { type: 'tool-input-available', toolCallId: `call-${toolName}`, toolName, input },
  { type: 'finish-step' },
  { type: 'finish' },
];

const textReply = (text: string) => [
  { type: 'start' },
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish' },
];

type ChatRequest = { command?: string; messages: Array<{ parts: Array<Record<string, unknown>> }> };

async function openChat(page: Page) {
  await page.goto('/');
  await page.locator('.v-tab', { hasText: 'Chat' }).click({ timeout: 20000 });
  return page.getByPlaceholder('Describe your work');
}

test('/note saves a sticky note through the addNote tool, and Undo removes it', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    return fulfillStream(
      route,
      requests.length === 1 ? toolCall('addNote', { text: 'ask BA about login\n[ ] check logs' }) : textReply('Saved.'),
    );
  });

  const input = await openChat(page);

  // Typing / opens the menu; picking a command fills it in
  await input.fill('/no');
  await expect(page.getByLabel('Commands')).toBeVisible();
  await input.press('Enter');
  await expect(input).toHaveValue('/note ');

  await input.pressSequentially('ask BA about login');
  await input.press('Enter');

  await expect(page.getByText('Saved.')).toBeVisible();
  const row = page.locator('.added-item', { hasText: 'ask BA about login' });
  await expect(row).toBeVisible();

  // The command travelled with the request; the client tool's output went back in the follow-up
  expect(requests[0].command).toBe('note');
  const toolPart = requests[1].messages.at(-1)?.parts.find((p) => p.type === 'tool-addNote');
  expect(toolPart?.state).toBe('output-available');

  await page.locator('.v-tab', { hasText: 'Notes' }).click();
  await expect(page.locator('.note-card', { hasText: 'ask BA about login' })).toBeVisible();
  await expect(page.locator('.note-card', { hasText: 'check logs' }).locator('input[type="checkbox"]')).toHaveCount(1);

  await page.locator('.v-tab', { hasText: 'Chat' }).click();
  await row.getByRole('button', { name: 'Undo' }).click();
  await expect(row).toContainText('Removed');

  await page.locator('.v-tab', { hasText: 'Notes' }).click();
  await expect(page.locator('.note-card', { hasText: 'ask BA about login' })).toHaveCount(0);
});

test('/event adds a calendar event through the addEvent tool', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    return fulfillStream(
      route,
      requests.length === 1
        ? toolCall('addEvent', { title: 'Sprint review', date: '2026-10-16', startTime: '14:00', endTime: '15:00' })
        : textReply('Added to your calendar.'),
    );
  });

  const input = await openChat(page);
  await input.fill('/event sprint review next friday 2-3pm');
  await input.press('Enter');

  await expect(page.getByText('Added to your calendar.')).toBeVisible();
  await expect(page.locator('.added-item', { hasText: 'Sprint review · Fri 16 Oct 14:00–15:00' })).toBeVisible();
  expect(requests[0].command).toBe('event');

  await page.goto('/events');
  await expect(page.getByText('Sprint review').first()).toBeVisible({ timeout: 20000 });
});

test('a message without a command sends no command', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    return fulfillStream(route, textReply('How long did it take?'));
  });

  const input = await openChat(page);
  await input.fill('worked on T-123');
  await input.press('Enter');

  await expect(page.getByText('How long did it take?')).toBeVisible();
  expect(requests[0].command).toBeUndefined();
});
