import { expect, type Page, test } from '@playwright/test';

/**
 * E2E coverage for the LogList filter bar (project / task / date-range / search)
 * and its two-way project sync with the Insights panel.
 *
 * Data is seeded straight into localStorage (the app's store) before load, so the
 * tests are deterministic regardless of what's already saved. All seeded logs live
 * in the *current* month, because LogList only shows the current month's bucket and
 * the date-range filter is clamped to it.
 */

// Force the large (lg+) layout so the Insights panel renders inline, not in the drawer.
test.use({ viewport: { width: 1440, height: 900 } });

const pad = (n: number) => String(n).padStart(2, '0');

// Current month's storage key: `timeLogs-YYYY-MM`
function storageKey(): string {
  const now = new Date();
  return `timeLogs-${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

// A day in the current month, formatted as the app's shortDateFormat (MM/DD/YYYY)
function dateId(day: number): string {
  const now = new Date();
  return `${pad(now.getMonth() + 1)}/${pad(day)}/${now.getFullYear()}`;
}

interface Seed {
  project: string;
  task: string;
  day: number;
  duration: number;
  description: string;
}

// Six logs across four projects on six distinct early-month days (1–9 exist in every month).
const SEED: Seed[] = [
  { project: 'Gamma', task: 'Docs', day: 3, duration: 50, description: 'write api docs' },
  { project: 'Team work', task: 'Daily meeting', day: 5, duration: 30, description: 'standup' },
  { project: 'Alpha', task: 'Design', day: 6, duration: 90, description: 'wireframes for dashboard' },
  { project: 'Alpha', task: 'QA', day: 7, duration: 45, description: 'regression testing' },
  { project: 'Beta', task: 'Dev', day: 8, duration: 120, description: 'api endpoint work' },
  { project: 'Beta', task: 'QA', day: 9, duration: 60, description: 'smoke testing' },
];

const ALL_DAYS = SEED.map((s) => s.day);

// Locators (scoped by the stable classes / icons the component already uses)
const searchToggle = (page: Page) => page.locator('.log-search .v-icon-btn');
const searchInput = (page: Page) => page.getByPlaceholder('Search');
const searchClear = (page: Page) => page.locator('.log-search__field .v-field__clearable');
const filterButton = (page: Page) => page.locator('button:has(.mdi-filter-variant)');
const filterBadge = (page: Page) => page.locator('.v-badge__badge');
const filterMenu = (page: Page) => page.locator('.v-overlay__content').filter({ hasText: 'Clear all' });
const datePanel = (page: Page, day: number) => page.locator(`[id="${dateId(day)}"]`);

// Click the field container (not the input) — the input is covered by `.v-field__input`,
// which intercepts pointer events; the container accepts the click and opens the dropdown.
const menuField = (page: Page, label: string) =>
  filterMenu(page).locator('.v-input', { hasText: label }).locator('.v-field');

async function seedAndOpen(page: Page) {
  const logs = SEED.map((s, i) => ({
    id: `seed-${i}`,
    date: dateId(s.day),
    project: s.project,
    task: s.task,
    duration: s.duration,
    type: 'log',
    description: s.description,
  }));

  await page.addInitScript(
    (payload: { key: string; data: string }) => {
      window.localStorage.setItem(payload.key, payload.data);
    },
    { key: storageKey(), data: JSON.stringify(logs) },
  );

  await page.goto('/');
  // Wait until the seeded rows have rendered
  await expect(datePanel(page, ALL_DAYS[0])).toHaveCount(1);
}

// Assert exactly the given days' panels are present (and no other seeded day is)
async function expectVisibleDays(page: Page, days: number[]) {
  for (const day of ALL_DAYS) {
    await expect(datePanel(page, day)).toHaveCount(days.includes(day) ? 1 : 0);
  }
}

test.describe('LogList filters', () => {
  test('search filters the list and the clear button resets it', async ({ page }) => {
    await seedAndOpen(page);
    await expectVisibleDays(page, ALL_DAYS);

    // Expand the search field and type a description-only match
    await searchToggle(page).click();
    await expect(searchInput(page)).toBeFocused();
    await searchInput(page).fill('wireframes');

    // Only Alpha/Design (day 6) has that description
    await expectVisibleDays(page, [6]);

    // The clear (×) button empties the query and restores the full list
    await searchClear(page).click();
    await expect(searchInput(page)).toHaveValue('');
    await expectVisibleDays(page, ALL_DAYS);
  });

  test('project filter narrows the list, shows a badge, and Clear all closes the popup', async ({
    page,
  }) => {
    await seedAndOpen(page);

    await filterButton(page).click();
    await expect(filterMenu(page)).toBeVisible();

    // Pick a project
    await menuField(page, 'Project').click();
    await page.getByRole('option', { name: 'Beta', exact: true }).click();

    // Only Beta's days (8, 9) remain, and the funnel badge shows one active filter
    await expectVisibleDays(page, [8, 9]);
    await expect(filterBadge(page)).toHaveText('1');

    // Clear all resets the list AND closes the popup
    await filterMenu(page).getByRole('button', { name: 'Clear all' }).click();
    await expect(filterMenu(page)).toHaveCount(0);
    await expectVisibleDays(page, ALL_DAYS);
    await expect(filterBadge(page)).toBeHidden();
  });

  test('task filter is scoped to the selected project', async ({ page }) => {
    await seedAndOpen(page);

    await filterButton(page).click();
    await menuField(page, 'Project').click();
    await page.getByRole('option', { name: 'Beta', exact: true }).click();

    // With Beta chosen, tasks narrow to Dev / QA — pick Dev
    await menuField(page, 'Task').click();
    await page.getByRole('option', { name: 'Dev', exact: true }).click();

    // Beta + Dev = day 8 only (Beta/QA on day 9 is filtered out)
    await expectVisibleDays(page, [8]);
    await expect(filterBadge(page)).toHaveText('2');
  });

  test('selecting a project in Insights filters the LogList', async ({ page }) => {
    await seedAndOpen(page);

    // The Insights panel lists projects with their totals; click Alpha's row
    await page.locator('.insights-panel').getByText('Alpha', { exact: true }).click();

    // LogList should now show only Alpha's days (6, 7)
    await expectVisibleDays(page, [6, 7]);
    // …and the filter badge reflects the shared project selection
    await expect(filterBadge(page)).toHaveText('1');
  });
});
