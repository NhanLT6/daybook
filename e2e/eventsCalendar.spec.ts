import { expect, test } from '@playwright/test';

/**
 * Events page calendar: picking a day highlights the events on it in the list, clicking a row
 * highlights that event's days on the calendar, and "the last work day" skips weekends and holidays.
 */

test.beforeEach(async ({ page }) => {
  // Wed Oct 7 2026, Sat–Sun weekend
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00'));
  await page.addInitScript(() => {
    localStorage.setItem('weekendDays', JSON.stringify([6, 0]));
    localStorage.setItem(
      'events',
      JSON.stringify([
        {
          id: 'x',
          title: 'Sync logs to Xero',
          date: '2026-10-30',
          type: 'custom',
          repeat: { freq: 'month', interval: 1, monthlyBy: 'lastWorkday' },
        },
        { id: 'o', title: 'Team offsite', date: '2026-10-14', type: 'custom' },
        { id: 'h', title: 'Reunification Day', date: '2027-04-30', type: 'holiday' },
      ]),
    );
  });
  await page.goto('/events');
  await expect(page.locator('main tr', { hasText: 'Sync logs to Xero' })).toBeVisible({ timeout: 20000 });
});

test('a picked day highlights its events, a clicked event highlights its days', async ({ page }) => {
  const xero = page.locator('main tr', { hasText: 'Sync logs to Xero' });
  const offsite = page.locator('main tr', { hasText: 'Team offsite' });

  await page.locator('.vc-day.id-2026-10-14 .vc-day-content').click();
  await expect(offsite).toHaveClass(/event-row--active/);
  await expect(xero).not.toHaveClass(/event-row--active/);

  // Selecting a row clears the picked day and moves the calendar to the event's next date
  await xero.click();
  await expect(xero).toHaveClass(/event-row--active/);
  await expect(offsite).not.toHaveClass(/event-row--active/);
  await expect(page.locator('.vc-day.id-2026-10-30 .vc-highlight')).toBeVisible();

  // The holiday moves the April occurrence back to Thursday the 29th (Oct → Apr is 6 pages)
  for (let i = 0; i < 6; i++) await page.locator('.vc-arrow.vc-next').click();
  await expect(page.locator('.vc-day.id-2027-04-29 .vc-highlight')).toBeVisible();
  await expect(page.locator('.vc-day.id-2027-04-30 .vc-highlight')).toHaveCount(0);
});

test('"the last work day" preset moves the start and previews the next dates', async ({ page }) => {
  await page.getByRole('button', { name: 'New Event' }).click();
  const dialog = page.locator('.v-dialog');
  await dialog.getByLabel('Title').fill('Give Bonusly points');

  await dialog.locator('.v-select', { hasText: 'Repeat' }).click();
  await page.getByRole('option', { name: 'Every month on the last work day' }).click();
  await expect(dialog).toContainText('Oct 30');
  await expect(dialog).toContainText('Next: Fri, Oct 30 · Mon, Nov 30 · Thu, Dec 31');

  await dialog.getByRole('button', { name: 'Add' }).click();
  const row = page.locator('main tr', { hasText: 'Give Bonusly points' });
  await expect(row).toContainText('Oct 30');
  await expect(row).toContainText('Every month on the last work day');
});
