import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { balconyLayout } from '../src/components/garden/layouts/balcony';

test.use({ viewport: { width: 1440, height: 1000 }, headless: true });

const expectOnePlant = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('garden') || '{}').plants?.filter(Boolean).length))
    .toBe(1);

test('Garden is opt-in, has its own page, and keeps plants when hidden', async ({ page }) => {
  await page.goto('/setting');
  const toggle = page.getByRole('checkbox', { name: 'Enable Garden' });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'Garden', exact: true })).toHaveCount(0);
  await page.goto('/garden');
  await expect(page.locator('.garden-canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Go to Settings' }).click();
  await toggle.check();
  await page.getByRole('link', { name: 'Open garden' }).click();
  const canvas = page.locator('.garden-canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(box.x).toBe(88);
  expect(box.y).toBe(8);
  expect(box.width).toBe(1344);
  expect(box.height).toBe(984);
  await page.screenshot({ path: test.info().outputPath('garden-layout-desktop.png') });
  await expect(page.locator('.garden-heading, .garden-footer, .garden-caption')).toHaveCount(0);
  const fullscreen = (await page.getByRole('button', { name: 'Fullscreen', exact: true }).boundingBox())!;
  expect(fullscreen.y).toBe(box.y + 16);
  expect(fullscreen.x + fullscreen.width).toBe(box.x + box.width - 16);
  // The middle tier keeps saved slot 0 after the extra plank is added.
  const slot = balconyLayout.slots(box.width, box.height).find((slot) => slot.index === 0)!;
  await canvas.click({ position: { x: slot.x, y: slot.soilY - 14 * slot.scale } });
  await page.getByRole('button', { name: 'Monstera', exact: true }).click();
  await expectOnePlant(page);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.locator('.app-rail-shell')).toHaveCount(0);
  await expect(page.locator('.garden-page--focus')).toBeVisible();
  await expect.poll(async () => Math.round((await canvas.boundingBox())!.width)).toBe(1440);
  expect(Math.round((await canvas.boundingBox())!.height)).toBe(1000);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await toggle.uncheck();
  await toggle.check();
  await page.getByRole('link', { name: 'Open garden' }).click();
  await expectOnePlant(page);
  await page.reload();
  await expectOnePlant(page);
});

test('Garden fits mobile, hides the top bar in fullscreen, and exits with its button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/setting');
  await page.getByRole('checkbox', { name: 'Enable Garden' }).check();
  await page.getByRole('link', { name: 'Open garden' }).click();
  await expect(page.locator('.garden-canvas')).toBeVisible();
  const normal = (await page.locator('.garden-canvas').boundingBox())!;
  expect(normal.y).toBe(61);
  expect(normal.y + normal.height).toBe(836);
  await page.screenshot({ path: test.info().outputPath('garden-layout-mobile.png') });
  await expect(page.locator('.chat-bar-spacer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.locator('.v-app-bar')).toHaveCount(0);
  await expect.poll(async () => Math.round((await page.locator('.garden-canvas').boundingBox())!.width)).toBe(390);
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.locator('.v-app-bar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('the previous garden preference opens the balcony and preserves grown plants', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('showGarden', 'true');
    localStorage.setItem('notificationGreetingLastShownAt', String(Date.now()));
    localStorage.setItem('gardenLayout', 'japanese');
    const species = ['monstera', 'lanhodiep', 'senda', 'luoiho', 'tocien', 'duongxi', 'hoagiay', 'hongmon', 'trauba'];
    localStorage.setItem(
      'garden',
      JSON.stringify({
        plants: species.map((species) => ({ species, stage: 4, seed: 123 })),
        drops: 3,
        earnedToday: 3,
        earnedDay: '2026-11-04',
      }),
    );
  });
  await page.goto('/garden');
  await expect(page.locator('.garden-canvas')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gardenLayout'))).toBe('shelf');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('garden')!).plants.every((p: { stage: number }) => p.stage === 4),
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath('balcony-grown-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Math.round((await page.locator('.garden-canvas').boundingBox())!.width)).toBe(374);
  await page.screenshot({ path: test.info().outputPath('balcony-grown-mobile.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(async () => Math.round((await page.locator('.garden-canvas').boundingBox())!.width)).toBe(1920);
  await page.screenshot({ path: test.info().outputPath('balcony-grown-fullscreen.png') });
  expect(errors).toEqual([]);
});
