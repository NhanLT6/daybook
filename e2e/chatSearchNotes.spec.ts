import { expect, type Page, type Route, test } from '@playwright/test';

/**
 * Chat's searchNotes tool runs in the browser: the model asks for notes, the client reads
 * them from IndexedDB and sends them back in a follow-up request. /api/chat is mocked with
 * AI SDK UI message stream chunks, so no API key or network is needed.
 */

const sse = (chunks: object[]) =>
  [...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`), 'data: [DONE]\n\n'].join('');

const fulfillStream = (route: Route, chunks: object[]) =>
  route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
    body: sse(chunks),
  });

async function addNote(page: Page, text: string) {
  await page.locator('.v-tab', { hasText: 'Notes' }).click();
  await page.locator('[aria-label="New note"]').first().click();
  await expect(page.locator('.notes-editor-overlay .ProseMirror')).toBeFocused();
  await page.keyboard.type(text);
  await page.locator('[aria-label="Back to notes"]').click();
  await expect(page.locator('.note-card .note-preview')).toContainText(text);
}

test('Chat answers from notes via the searchNotes tool', async ({ page }) => {
  const requests: Array<{ messages: Array<{ parts: Array<Record<string, unknown>> }>; projects?: unknown }> = [];

  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);

    if (requests.length === 1) {
      // Step 1: the model calls searchNotes
      return fulfillStream(route, [
        { type: 'start', messageId: 'assistant-1' },
        { type: 'start-step' },
        { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'searchNotes', input: { query: 'auth bug' } },
        { type: 'finish-step' },
        { type: 'finish' },
      ]);
    }

    // Step 2: the model answers from the notes it got back
    return fulfillStream(route, [
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Your note says to ask the BA about the login redirect.' },
      { type: 'text-end', id: 't1' },
      { type: 'finish-step' },
      { type: 'finish' },
    ]);
  });

  await page.goto('/');
  await expect(page.locator('.v-tab', { hasText: 'Notes' })).toBeVisible({ timeout: 20000 });
  await addNote(page, 'ask BA abt login redirect?');

  await page.locator('.v-tab', { hasText: 'Chat' }).click();
  const input = page.getByPlaceholder('Describe your work…');
  await input.fill('what did I note about the auth bug?');
  await input.press('Enter');

  await expect(page.getByText('Your note says to ask the BA about the login redirect.')).toBeVisible();
  await expect(page.getByText('Checked your notes')).toBeVisible();

  // The follow-up request carried the note text as the tool output, plus the usual context
  expect(requests).toHaveLength(2);
  const toolPart = requests[1].messages.at(-1)?.parts.find((p) => p.type === 'tool-searchNotes');
  expect(toolPart?.state).toBe('output-available');
  expect(JSON.stringify(toolPart?.output)).toContain('ask BA abt login redirect?');
  expect(requests[1].projects).toBeDefined();
});
