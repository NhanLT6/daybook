import { expect, type Page, test } from '@playwright/test';

/**
 * Sticky Notes (Steps 8 & 10 of docs/plans/2026-09-10-sticky-notes.md): create/persist,
 * empty-note discard, checklist formatting, delete+undo, XSS-safe rendering, and
 * drag & drop (reorder + trash).
 */

async function openNotesTab(page: Page) {
  const notesTab = page.locator('.v-tab', { hasText: 'Notes' });
  await expect(notesTab).toBeVisible({ timeout: 20000 });
  await notesTab.click();
  await expect(page.locator('[aria-label="New note"]')).toBeVisible();
}

async function openNewNoteEditor(page: Page) {
  await page.locator('[aria-label="New note"]').click();
  const editor = page.locator('.notes-editor-overlay .ProseMirror');
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  return editor;
}

async function xssFlag(page: Page): Promise<number | undefined> {
  return page.evaluate(() => (window as typeof window & { __xss?: number }).__xss);
}

test('creates a note and it persists across reload', async ({ page }) => {
  await page.goto('/');
  await openNotesTab(page);

  await openNewNoteEditor(page);
  await page.keyboard.type('Ask Bob about T-123');
  await page.locator('[aria-label="Back to notes"]').click();

  const preview = page.locator('.note-card .note-preview');
  await expect(preview).toContainText('Ask Bob about T-123');

  await page.reload();
  await openNotesTab(page);
  await expect(page.locator('.note-card .note-preview')).toContainText('Ask Bob about T-123');
});

test('discards an empty note when navigating back', async ({ page }) => {
  await page.goto('/');
  await openNotesTab(page);

  await openNewNoteEditor(page);
  await page.locator('[aria-label="Back to notes"]').click();

  await expect(page.locator('.notes-editor-overlay')).toHaveCount(0);
  await expect(page.locator('.note-card')).toHaveCount(0);
});

test('creates a checklist note with a checkbox in the preview', async ({ page }) => {
  await page.goto('/');
  await openNotesTab(page);

  await openNewNoteEditor(page);
  await page.locator('[aria-label="Checklist"]').click();
  await page.keyboard.type('Is login bug resolved?');
  await page.locator('[aria-label="Back to notes"]').click();

  const preview = page.locator('.note-card .note-preview');
  await expect(preview.locator('input[type="checkbox"]')).toHaveCount(1);
  await expect(preview).toContainText('Is login bug resolved?');
});

test('deletes a note and undo restores it', async ({ page }) => {
  await page.goto('/');
  await openNotesTab(page);

  await openNewNoteEditor(page);
  await page.keyboard.type('Delete me please');
  await page.locator('[aria-label="Back to notes"]').click();
  await expect(page.locator('.note-card')).toHaveCount(1);

  await page.locator('.note-card').click();
  await expect(page.locator('.notes-editor-overlay .ProseMirror')).toBeVisible();
  await page.locator('[aria-label="Delete note"]').click();

  await expect(page.locator('.note-card')).toHaveCount(0);

  const undoButton = page.locator('.island-action-btn', { hasText: 'Undo' });
  await expect(undoButton).toBeVisible();
  await undoButton.click();

  await expect(page.locator('.note-card')).toHaveCount(1);
  await expect(page.locator('.note-card .note-preview')).toContainText('Delete me please');
});

test('sanitizes malicious html written directly into the notes store', async ({ page }) => {
  const xssContent =
    '<img src=x onerror="window.__xss=1"><a href="javascript:window.__xss=2">jslink</a><script>window.__xss=3</script>';

  await page.goto('/');
  await openNotesTab(page);

  await page.evaluate(
    (note) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('daybook');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('notes', 'readwrite');
          tx.objectStore('notes').put(note);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { id: 'xss-note', content: xssContent, order: -1, createdAt: Date.now(), updatedAt: Date.now() },
  );

  await page.reload();
  await openNotesTab(page);

  const preview = page.locator('.note-card .note-preview');
  await expect(preview).toContainText('jslink');
  await expect(preview.locator('img')).toHaveCount(0);
  await expect(preview.locator('script')).toHaveCount(0);
  await expect(preview.locator('a[href]')).toHaveCount(0);
  expect(await xssFlag(page)).toBeUndefined();

  await page.locator('.note-card').click();
  await expect(page.locator('.notes-editor-overlay .ProseMirror')).toBeVisible();
  expect(await xssFlag(page)).toBeUndefined();
});

test('reorders notes by dragging and the new order survives a reload', async ({ page }) => {
  await page.goto('/');
  await openNotesTab(page);

  await openNewNoteEditor(page);
  await page.keyboard.type('Alpha');
  await page.locator('[aria-label="Back to notes"]').click();

  await openNewNoteEditor(page);
  await page.keyboard.type('Beta');
  await page.locator('[aria-label="Back to notes"]').click();

  const cards = page.locator('.note-card');
  await expect(cards).toHaveCount(2);
  // New notes are inserted first, so Beta (created last) starts ahead of Alpha.
  await expect(cards.nth(0).locator('.note-preview')).toContainText('Beta');
  await expect(cards.nth(1).locator('.note-preview')).toContainText('Alpha');

  await cards.nth(0).dragTo(cards.nth(1));

  await expect(cards.nth(0).locator('.note-preview')).toContainText('Alpha');
  await expect(cards.nth(1).locator('.note-preview')).toContainText('Beta');

  await page.reload();
  await openNotesTab(page);

  const reloadedCards = page.locator('.note-card');
  await expect(reloadedCards).toHaveCount(2);
  await expect(reloadedCards.nth(0).locator('.note-preview')).toContainText('Alpha');
  await expect(reloadedCards.nth(1).locator('.note-preview')).toContainText('Beta');
});

test('drags a note onto the trash and undo restores it', async ({ page }) => {
  await page.goto('/');
  await openNotesTab(page);

  await openNewNoteEditor(page);
  await page.keyboard.type('Drag me to the trash');
  await page.locator('[aria-label="Back to notes"]').click();

  const card = page.locator('.note-card');
  await expect(card).toHaveCount(1);

  const cardBox = await card.boundingBox();
  expect(cardBox).toBeTruthy();
  const cardCenterX = cardBox!.x + cardBox!.width / 2;
  const cardCenterY = cardBox!.y + cardBox!.height / 2;

  // The trash zone only mounts once a drag starts, so drive the gesture with raw mouse
  // events: press on the card, nudge the mouse to trigger dragstart, then hand off to trash.
  await card.hover();
  await page.mouse.down();
  await page.mouse.move(cardCenterX, cardCenterY + 30, { steps: 8 });

  const trash = page.locator('.notes-trash');
  await expect(trash).toBeVisible();

  const trashBox = await trash.boundingBox();
  expect(trashBox).toBeTruthy();
  await page.mouse.move(trashBox!.x + trashBox!.width / 2, trashBox!.y + trashBox!.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.note-card')).toHaveCount(0);

  const undoButton = page.locator('.island-action-btn', { hasText: 'Undo' });
  await expect(undoButton).toBeVisible();
  await undoButton.click();

  await expect(page.locator('.note-card')).toHaveCount(1);
  await expect(page.locator('.note-card .note-preview')).toContainText('Drag me to the trash');
});
