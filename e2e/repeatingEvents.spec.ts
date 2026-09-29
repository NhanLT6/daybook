import { expect, type Page, test } from '@playwright/test';

/**
 * Repeating events: a biweekly series shows as one row with its next occurrence, "Skip next date"
 * moves it to the following one (Undo brings it back), and the form's Repeat presets save a rule.
 */

// Clicks a day in the open date picker by its accessible label ("Monday, October 5, 2026"), which
// stays unambiguous while the month-change transition briefly shows two months
const pickDay = (page: Page, date: Date) =>
  page
    .getByRole('button', {
      name: new RegExp(`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}$`),
    })
    .click();

// Day N of next month, so the picked dates are always in the future
const nextMonthDay = (day: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, day);
};

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
  await dialog.getByLabel('Repeat interval').fill('3');
  await dialog.getByRole('button', { name: 'After' }).click();
  await dialog.getByLabel('Occurrences').fill('4');
  await expect(dialog).toContainText('Every 3 weeks on Wednesday, 4 times');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(row).toContainText('Every 3 weeks on Wednesday, 4 times');
});

// Uses the real clock: Vuetify's date picker menu doesn't open under page.clock
test('range picked in the date picker repeats via the custom panel', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'New Event' }).click();
  const dialog = page.locator('.v-dialog');
  await dialog.getByLabel('Title').fill('Sprint');

  // The picker emits Date objects; picking a range here used to crash the Repeat field
  await dialog.getByRole('textbox', { name: 'Date' }).click();
  await page.getByRole('button', { name: 'Range' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await pickDay(page, nextMonthDay(5));
  await pickDay(page, nextMonthDay(16));
  await page.keyboard.press('Escape');

  await dialog.locator('.v-select', { hasText: 'Repeat' }).click();
  await page.getByRole('option', { name: 'Custom…' }).click();

  // A 12-day range can't repeat weekly: Custom starts at every 2 weeks, and forcing weekly is rejected
  await expect(dialog.getByLabel('Repeat interval')).toHaveValue('2');
  await dialog.getByLabel('Repeat interval').fill('1');
  await expect(dialog).toContainText('longer than the time between repeats');
  await expect(dialog.getByRole('button', { name: 'Add' })).toBeDisabled();
  await dialog.getByLabel('Repeat interval').fill('2');
  await expect(dialog).not.toContainText('longer than the time between repeats');
  await dialog.getByRole('button', { name: 'Add' }).click();

  await expect(page.locator('main tr', { hasText: 'Sprint' })).toContainText(/Every 2 weeks on \w+day/);
});

test('separate days picked in Multiple mode repeat as a set', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'New Event' }).click();
  const dialog = page.locator('.v-dialog');
  await dialog.getByLabel('Title').fill('Gym');

  await dialog.getByRole('textbox', { name: 'Date' }).click();
  await page.getByRole('button', { name: 'Multiple' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  for (const day of [5, 6, 9]) await pickDay(page, nextMonthDay(day));
  // Today starts out picked; untick it
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: /^Today, / }).click();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('textbox', { name: 'Date' })).toHaveValue(/\w{3} 5, 6, 9/);

  // Weekly presets name every picked weekday
  await dialog.locator('.v-select', { hasText: 'Repeat' }).click();
  await page.getByRole('option', { name: /^Every week on \w+day, \w+day and \w+day$/ }).click();
  await dialog.getByRole('button', { name: 'Add' }).click();

  const row = page.locator('main tr', { hasText: 'Gym' });
  await expect(row).toContainText(/\w{3} 5, 6, 9/);
  await expect(row).toContainText(/Every week on \w+day, \w+day and \w+day/);
});
