import { expect, test } from '@playwright/test';

/**
 * Repeating events: a biweekly series shows as one row with its next occurrence, "Skip next date"
 * moves it to the following one (Undo brings it back), and the form's Repeat presets save a rule.
 */

test('biweekly series shows next occurrence, skips and undoes', async ({ page }) => {
  // Wed Sep 30 2026 — the series (every other Tuesday from Sep 15) next falls on Oct 13
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00'));
  await page.addInitScript(() => {
    localStorage.setItem(
      'events',
      JSON.stringify([
        { id: 'r1', title: 'I host daily', date: '2026-09-15', type: 'custom', repeat: { freq: 'week', interval: 2 } },
      ]),
    );
  });

  await page.goto('/events');
  const row = page.locator('main tr', { hasText: 'I host daily' });
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText('Oct 13');
  await expect(row).toContainText('Every 2 weeks on Tuesday');

  await row.locator('button:has(.mdi-calendar-remove-outline)').click();
  await expect(row).toContainText('Oct 27');

  await page.locator('.island-action-btn', { hasText: 'Undo' }).click();
  await expect(row).toContainText('Oct 13');
});

test('repeat preset and custom rule save from the form', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00'));
  await page.goto('/events');

  await page.getByRole('button', { name: 'New Event' }).click();
  const dialog = page.locator('.v-dialog');
  await dialog.getByLabel('Title').fill('Sprint review');

  // Preset: derived from the default date (today, a Wednesday)
  await dialog.locator('.v-select', { hasText: 'Repeat' }).click();
  await page.getByRole('option', { name: 'Every 2 weeks on Wednesday' }).click();
  await dialog.getByRole('button', { name: 'Add' }).click();

  const row = page.locator('main tr', { hasText: 'Sprint review' });
  await expect(row).toContainText('Sep 30');
  await expect(row).toContainText('Every 2 weeks on Wednesday');

  // Custom: every 3 weeks, ending after 4 times
  await row.locator('button:has(.mdi-pencil-outline)').click();
  await dialog.locator('.v-select', { hasText: 'Repeat' }).click();
  await page.getByRole('option', { name: 'Custom…' }).click();
  await dialog.locator('input[type="number"]').first().fill('3');
  await dialog.getByRole('button', { name: 'After' }).click();
  await dialog.getByLabel('Occurrences').fill('4');
  await expect(dialog).toContainText('Every 3 weeks on Wednesday, 4 times');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(row).toContainText('Every 3 weeks on Wednesday, 4 times');
});
