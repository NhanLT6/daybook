import { expect, test } from '@playwright/test';

/**
 * The Events header used to be a VToolbar, which cannot wrap: on a phone the title
 * collapsed to zero width and the filter labels clipped to "MIN"/"UPCOMING" behind
 * their own scrollbars. Guards the wrapped layout at the narrowest width we support.
 */

test.use({ viewport: { width: 375, height: 812 } });

test('events header stays readable and filters work on mobile', async ({ page }) => {
  // Pinned so the seeded events stay "upcoming" regardless of when the suite runs
  await page.clock.setFixedTime(new Date('2026-09-01T10:00:00'));
  await page.addInitScript(() => {
    localStorage.setItem(
      'events',
      JSON.stringify([
        { id: 'e1', title: 'Team offsite', date: '2026-09-15', type: 'custom' },
        { id: 'h1', title: 'National Day', date: '2026-09-02', type: 'holiday' },
      ]),
    );
  });

  await page.goto('/events');
  // Scoped to the list: the day card under the calendar also names the next event
  const list = page.locator('.event-list');
  await expect(list.getByText('National Day')).toBeVisible({ timeout: 20000 });

  // Title is actually laid out, not crushed to nothing
  const box = await page.locator('.event-toolbar__title').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(40);

  // Nothing pushes the page sideways
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // Every filter label is fully rendered rather than clipped by its own scroll box
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.event-toolbar__controls .v-btn')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent?.trim()),
  );
  expect(clipped).toEqual([]);

  // And they still filter
  const controls = page.locator('.event-toolbar__controls');
  await controls.getByRole('button', { name: 'Mine', exact: true }).click();
  await expect(list).toContainText('Team offsite');
  await expect(list).not.toContainText('National Day');
});
