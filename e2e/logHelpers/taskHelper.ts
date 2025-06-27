import dayjs from 'dayjs';

import { Page } from '@playwright/test';

import { convertDecimalHourToHourMinutes } from './utils.js';

async function createTask(page: Page, taskName: string) {
  // Wait for the task list to be loaded
  await page.locator('div[data-automationid="task-list-container"]').waitFor({ state: 'visible' });

  const taskElements = page.locator('span[data-automationid="task-item-name-field"]', { hasText: taskName });

  const isTaskExist = (await taskElements.count()) > 0;
  if (isTaskExist) return;

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Task' }).click();

  await page.getByPlaceholder('Name or choose task').fill(taskName);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('section[data-automationid="task-modal-modal"]').waitFor({ state: 'hidden' });
}

async function addTimeSpentToTask(page: Page, taskName: string, duration: number, date: Date, description?: string) {
  // Open time entry modal
  await page.locator('button[data-automationid="quick-add-dropdown-add-button"]', { hasText: 'Add' }).click();
  await page.getByRole('button', { name: 'Time entry' }).click();

  // Task
  await page.getByLabel('Task').click();
  await page.getByRole('button', { name: taskName }).first().click();

  // Description
  if (description) await page.getByLabel('Description(optional)').fill(description);

  // Duration
  await page.locator('#duration').fill(convertDecimalHourToHourMinutes(duration));

  // Date
  await page.getByPlaceholder('Choose a date').click();
  await page.getByLabel(dayjs(date).format('ddd MMM DD')).click();

  // Save
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('section[data-automationid="time-entry-modal-modal"]').waitFor({ state: 'hidden' });
}

export { createTask, addTimeSpentToTask };
