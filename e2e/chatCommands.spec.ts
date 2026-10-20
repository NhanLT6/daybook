import { expect, type Page, type Route, test } from '@playwright/test';
import dayjs from 'dayjs';

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
  await expect(page.getByRole('link', { name: 'Notes' })).toBeVisible({ timeout: 20000 });
  await page.keyboard.press('Control+k');
  const input = page.getByLabel('Message');
  await expect(input).toBeVisible();
  return input;
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

  // Typing / opens the menu; picking a command turns it into a chip and clears the textarea
  await input.fill('/no');
  await expect(page.getByLabel('Suggestions')).toBeVisible();
  await input.press('Enter');
  await expect(page.locator('.chat-composer .command-chip')).toContainText('/note');
  await expect(input).toHaveValue('');

  await input.pressSequentially('ask BA about login');
  await input.press('Enter');

  await expect(page.getByText('Saved.')).toBeVisible();
  const row = page.locator('.added-item', { hasText: 'ask BA about login' });
  await expect(row).toBeVisible();

  // The command travelled with the request; the client tool's output went back in the follow-up
  expect(requests[0].command).toBe('note');
  const toolPart = requests[1].messages.at(-1)?.parts.find((p) => p.type === 'tool-addNote');
  expect(toolPart?.state).toBe('output-available');

  await page.getByRole('link', { name: 'Notes' }).click();
  await expect(page.locator('.note-card', { hasText: 'ask BA about login' })).toBeVisible();
  await expect(page.locator('.note-card', { hasText: 'check logs' }).locator('input[type="checkbox"]')).toHaveCount(1);

  // Chat state lives in memory across client-side navigation; re-open the bar
  await page.getByRole('link', { name: 'Home' }).click();
  await page.keyboard.press('Control+k');
  await row.getByRole('button', { name: 'Undo' }).click();
  await expect(row).toContainText('Removed');

  await page.getByRole('link', { name: 'Notes' }).click();
  await expect(page.locator('.note-card', { hasText: 'ask BA about login' })).toHaveCount(0);
});

test('/event adds a calendar event through the addEvent tool', async ({ page }) => {
  // Next Friday, relative to today: a fixed date drops out of the Events page's Upcoming list once it passes
  const today = dayjs();
  const friday = today.add((5 - today.day() + 7) % 7 || 7, 'day');
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    return fulfillStream(
      route,
      requests.length === 1
        ? toolCall('addEvent', {
            title: 'Sprint review',
            date: friday.format('YYYY-MM-DD'),
            startTime: '14:00',
            endTime: '15:00',
          })
        : textReply('Added to your calendar.'),
    );
  });

  const input = await openChat(page);
  // Typing the word plus a space turns it into a chip (a pasted/filled "/event text" would not)
  await input.pressSequentially('/event ');
  await expect(page.locator('.chat-composer .command-chip')).toContainText('/event');
  await input.pressSequentially('sprint review next friday 2-3pm');
  await input.press('Enter');

  await expect(page.getByText('Added to your calendar.')).toBeVisible();
  await expect(
    page.locator('.added-item', { hasText: `Sprint review · ${friday.format('ddd D MMM')} 14:00–15:00` }),
  ).toBeVisible();
  expect(requests[0].command).toBe('event');

  // Scoped to the list: the chat history (hidden, still in the DOM) also holds "sprint review"
  await page.goto('/events');
  await expect(page.locator('.event-row', { hasText: 'Sprint review' })).toBeVisible({ timeout: 20000 });
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

test('/ suggests projects and tasks mid-message; Tab inserts one as a chip', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    return fulfillStream(route, textReply('Got it.'));
  });

  // Home seeds the "Team work" preset (Daily meeting, Code review, …)
  const input = await openChat(page);
  const menu = page.getByLabel('Suggestions');

  // A date is not a mention
  await input.pressSequentially('sync 10/20');
  await expect(menu).toBeHidden();
  await input.fill('');

  // Mid-message: no commands, only projects / tasks, matched without accents or case
  await input.pressSequentially('2h /dai');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('option').first()).toContainText('Daily meeting');
  await expect(menu).not.toContainText('/log');
  await input.press('Tab');
  await expect(input).toHaveValue('2h Team work › Daily meeting ');
  await expect(page.locator('.composer-backdrop .mention-chip')).toHaveText('Team work › Daily meeting');

  // Esc hides the menu for that / only; Enter then sends
  await input.pressSequentially('/cod');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await input.press('Backspace');
  await input.press('Backspace');
  await input.press('Backspace');
  await input.press('Backspace');

  // Backspace right after a chip takes the whole chip, and Ctrl+Z brings it back
  await input.press('Backspace'); // the trailing space
  await input.press('Backspace');
  await expect(input).toHaveValue('2h ');
  await page.keyboard.press('Control+z');
  await expect(input).toHaveValue('2h Team work › Daily meeting');

  await input.press('Enter');
  await expect(page.getByText('Got it.')).toBeVisible();
  const sent = requests[0].messages.at(-1)?.parts.find((p) => p.type === 'text');
  expect(sent?.text).toBe('2h Team work › Daily meeting');
  await expect(page.locator('.chat-msg.is-me .mention-chip')).toHaveText('Team work › Daily meeting');
});
