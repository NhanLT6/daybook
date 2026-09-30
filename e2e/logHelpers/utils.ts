import { Page } from '@playwright/test';

import dayjs from 'dayjs';
import truncate from 'lodash/truncate.js';

import { TaskEntry } from '../interfaces/taskEntry.js';
import { XeroConfig } from '../interfaces/xeroConfig.js';

const XERO_NAME_MAX_LENGTH = 100;

async function loginXero(page: Page, config: XeroConfig) {
  await page.goto('https://go.xero.com/app/!lep5g/projects/');

  // Xero may do a client-side JS redirect to login when the session is expired.
  // Checking the URL immediately after goto is unreliable because the initial URL
  // already matches /projects/ before the redirect fires. Instead, wait for something
  // that only one of the two pages renders: the login form or the projects toolbar.
  // A slow or unexpected login page must not be mistaken for a restored session.
  const emailInput = page.locator('[data-automationid="Username--input"]');
  const newProjectButton = page.getByRole('button', { name: 'New project' });
  await emailInput.or(newProjectButton).first().waitFor({ state: 'visible', timeout: 120000 });

  if (!(await emailInput.isVisible())) {
    console.log('✅ Restored session — skipping login');
    return;
  }

  await emailInput.fill(config.userName);
  await page.locator('[data-automationid="PassWord--input"]').fill(config.password);

  await page.locator('[data-automationid="LoginSubmit--button"]').click();

  // Wait for the user to enter the 2FA code; the projects page shows once it is accepted
  await newProjectButton.waitFor({ state: 'visible', timeout: 120000 }).catch(() => {
    throw new Error('2FA authentication failed or timed out. Please ensure you can complete 2FA within 2 minutes.');
  });

  // Save auth cookies so the next run can skip login
  await page.context().storageState({ path: './auth-state.json' });
  console.log('💾 Auth state saved');
}

async function filter200ProjectsPerPage(page: Page) {
  try {
    // try to wait for the dropdown to appear within 2s
    const dropdownSelector =
      "//button[@class='xui-button xui-select--button xui-button-borderless-main xui-button-small xui-button-has-icon']";

    await page.locator(dropdownSelector).waitFor({
      state: 'visible',
      timeout: 2_000,
    });

    // only if the wait succeeded do we proceed
    await page.click(dropdownSelector);
    await page.click('#Selectaperpagecount200 button');
  } catch {
    // timing out means the button never showed up → skip
    console.log('Paging dropdown never appeared, skipping filter200ProjectsPerPage');
  }
}

async function openDetailedTimeReport(page: Page, contactName: string) {
  // Go to Detailed Time Report
  await page.getByRole('link', { name: 'Reports' }).click();

  await page.getByRole('link', { name: 'Detailed Time' }).click();

  // Set Project Status to In Progress
  await page.getByPlaceholder('Search for Project Status').click();
  await page.getByRole('button', { name: 'In progress' }).click();

  // Group by Date
  await page.getByLabel('Grouping/Summarising').click();
  await page.getByRole('button', { name: 'Date', exact: true }).click();

  // Filter by Contact
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByText('Staff', { exact: true }).click();
  await page.getByRole('checkbox', { name: contactName }).check();

  await page.locator('[data-automationid="report-settings-filter-modal-apply-button"]').click();

  // Click Update to load the report
  await page.getByRole('button', { name: 'Update' }).click();

  // Keep the browser open indefinitely
  await new Promise(() => {});
}

function convertMinutesToHourMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/** Xero has no task-less time entry — default a blank task to the entry's project name. */
function defaultBlankTasksToProject(entries: TaskEntry[]): void {
  for (const entry of entries) entry.task = entry.task || entry.project;
}

/**
 * Xero cuts names off at its limit on save, so a later lookup by the full name never matches
 * and the run hangs — shorten them up front. Trailing space is dropped because Xero trims it.
 */
function truncateNamesToXeroLimit(entries: TaskEntry[]): void {
  // Cut at the last space inside the limit so the name ends on a whole word
  const fitToLimit = (name: string) =>
    truncate(name, { length: XERO_NAME_MAX_LENGTH, separator: ' ', omission: '' }).trimEnd();

  for (const entry of entries) {
    entry.project = fitToLimit(entry.project);
    entry.task = fitToLimit(entry.task);
  }
}

/** One progress line for a logged entry: date · duration · "description" (when present). */
function formatLoggedEntry(entry: TaskEntry): string {
  const date = dayjs(entry.date).format('YYYY-MM-DD');
  const duration = convertMinutesToHourMinutes(entry.duration!);
  const desc = entry.description ? ` · "${entry.description}"` : '';
  return `${date} · ${duration}${desc}`;
}

export {
  loginXero,
  defaultBlankTasksToProject,
  truncateNamesToXeroLimit,
  formatLoggedEntry,
  filter200ProjectsPerPage,
  openDetailedTimeReport,
  convertMinutesToHourMinutes,
};
