import { Page } from '@playwright/test';

import { XeroConfig } from '../interfaces/xeroConfig.js';

async function loginXero(page: Page, config: XeroConfig) {
  await page.goto('https://go.xero.com/app/!lep5g/projects/');

  await page.getByPlaceholder('Email address').fill(config.userName);
  await page.getByPlaceholder('Password').fill(config.password);

  await page.getByRole('button', { name: 'Log in' }).click();

  // Wait for 2FA if needed
  await page.getByLabel('Trust this device', { exact: true }).check();
  await page.getByPlaceholder('123456').click();
  // await page.waitForTimeout(60000);
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

function convertDecimalHourToHourMinutes(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

function convertMinutesToDecimalHours(minutes: number): number {
  return parseFloat((minutes / 60).toFixed(2));
}

export {
  loginXero,
  filter200ProjectsPerPage,
  openDetailedTimeReport,
  convertDecimalHourToHourMinutes,
  convertMinutesToDecimalHours,
};
