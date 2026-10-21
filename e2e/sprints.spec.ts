import { expect, test } from '@playwright/test';

/**
 * Sprints: the New Event split button's menu opens the sprint form, the picked name style previews the
 * names coming up, and the saved series shows the running sprint's own name in the list and the day card.
 */

test('sprints are named per sprint, by quarter or a custom format', async ({ page }) => {
  // Tue Oct 20 2026: the second sprint of a series starting Mon Oct 5 is running
  // install + resume (not setFixedTime): a frozen clock keeps Vuetify's date picker menu from opening
  await page.clock.install({ time: new Date('2026-10-20T10:00:00') });
  await page.clock.resume();
  await page.goto('/events');

  await page.getByRole('button', { name: 'More ways to add' }).click();
  await page.getByText('New sprints').click();
  const dialog = page.locator('.v-dialog');
  await dialog.getByLabel('First sprint starts').click();
  await page.locator('.v-date-picker').getByRole('button', { name: 'Monday, October 5, 2026' }).click();

  // Default style: by quarter, restarting each quarter; a sprint counts in the quarter it starts in
  await expect(dialog).toContainText('Sprint 2026 Q4.2');
  await expect(dialog).toContainText('Sprint 2026 Q4.7');
  await expect(dialog).toContainText('Sprint 2027 Q1.1');

  // Running number from 42
  await dialog.getByText('Running number').click();
  await dialog.getByLabel('First number').fill('42');
  await expect(dialog.getByLabel('First number')).toHaveValue('42');
  await expect(dialog).toContainText('Sprint 43');

  // Custom: chips build on the current format
  await dialog.getByText('Custom…').click();
  const name = dialog.getByRole('textbox', { name: 'Sprint name' });
  // Clicking past the last chip puts the caret at the end (click() waits for the opening panel to settle)
  const box = (await name.boundingBox())!;
  await name.click({ position: { x: box.width - 4, y: box.height / 2 } });
  await page.keyboard.type(' (');
  await dialog.getByRole('button', { name: /Start date/ }).click();
  await page.keyboard.type(')');
  await expect(dialog).toContainText('Reads as Sprint 42 (05/10)');

  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  const row = page.locator('main tr', { hasText: 'Sprint 43 (19/10)' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Every 2 weeks');
  await expect(page.locator('.event-day-card')).toContainText('Sprint 43 (19/10)');

  // Editing reopens the sprint form with the custom format
  await row.hover();
  await row.getByRole('button', { name: 'Edit event' }).click();
  await expect(page.locator('.v-dialog')).toContainText('Edit Sprints');
  await expect(page.locator('.v-dialog').getByRole('textbox', { name: 'Sprint name' })).toContainText('Start date');
});
