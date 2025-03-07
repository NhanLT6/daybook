import fs from 'fs';

import dayjs from 'dayjs';

import { test } from '@playwright/test';
import _ from 'lodash';
import Papa from 'papaparse';

interface TaskEntry {
  date: Date;
  project: string;
  task: string;
  duration: number;
  description?: string;
}

interface XeroConfig {
  contactName: string;
  userName: string;
  password: string;
  templateFilePath: string;
}

const timeToWait = {
  modalToBeHidden: 15000,
  dataToBeLoaded: 15000,
};

test('Log work in Xero', async ({ page }) => {
  const config: XeroConfig = {
    contactName: process.env.VITE_XERO_CONTACT_NAME!,
    userName: process.env.VITE_XERO_USERNAME!,
    password: process.env.VITE_XERO_PASSWORD!,
    templateFilePath: process.env.VITE_XERO_TEMPLATE_FILE_PATH!,
  };

  const taskEntries = getTaskEntries(config.templateFilePath);

  await loginXero(page, config);
  await filter200ProjectsPerPage(page);

  // Create Projects
  const projectGroups = _.groupBy(taskEntries, (e) => e.project);
  for (const [projectName, tasksEntriesInProject] of Object.entries(projectGroups)) {
    await createOrOpenProject(page, config.contactName, projectName);

    // Create Tasks
    const taskGroups = _.groupBy(tasksEntriesInProject, (te) => te.task);
    for (const [taskName, tasks] of Object.entries(taskGroups)) {
      await createTask(page, taskName);

      for (const entry of tasks) {
        await addTimeSpentToTask(page, entry.task, entry.duration, entry.date, entry.description);
      }
    }

    await goBackToAllProjects(page);
  }

  // Wait until browser closed manually
  await new Promise(() => {});
});

async function loginXero(page: any, config: XeroConfig) {
  await page.goto('https://go.xero.com/app/!lep5g/projects/');

  await page.getByPlaceholder('Email address').fill(config.userName);
  await page.getByPlaceholder('Password').fill(config.password);

  await page.getByRole('button', { name: 'Log in' }).click();

  // Wait for 2FA if needed
  await page.getByLabel('Trust this device', { exact: true }).check();
  await page.getByPlaceholder('123456').click();
  // await page.waitForTimeout(60000);
}

async function filter200ProjectsPerPage(page: any) {
  try {
    await page.click(
      "//button[@class='xui-button xui-select--button xui-button-borderless-main xui-button-small xui-button-has-icon']",
    );
    await page.click('#Selectaperpagecount200 button');
  } catch {
    // Ignore if filtering fails
  }
}

async function goBackToAllProjects(page: any) {
  await page.getByRole('link', { name: 'All projects' }).click();
}

async function createOrOpenProject(page: any, contactName: string, projectName: string) {
  // Wait for project list to be loaded
  await page.waitForSelector('div[data-automationid="list-view-list"]', {
    state: 'visible',
    timeout: timeToWait.dataToBeLoaded,
  });

  // Check if Project exists
  const projectElement = page
    .locator('a[data-automationid="project-list-item"]')
    .filter({
      has: page.locator('div[data-automationid="project-item-project-name"]', { hasText: projectName }),
    })
    .filter({
      has: page.locator('span[data-automationid="project-item-contact-name"]', { hasText: contactName }),
    });

  const isProjectExist = (await projectElement.count()) > 0;
  if (isProjectExist) {
    await openProject(page, contactName, projectName);
    return;
  }

  // If project doesn't exist, create it
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('button', { name: 'In progress' }).click();

  // Contact
  await page.getByPlaceholder('Find or create a contact').fill(contactName);
  const contactButton = page.locator('button[data-automationid="autocompleter-option--body"]', {
    hasText: contactName,
  });
  await contactButton.click();

  // Project name
  await page.getByLabel('Project name').fill(projectName);

  // Save
  await page.getByRole('button', { name: 'Create' }).click();
  await page
    .locator('section[data-automationid="project-modal-modal"]')
    .waitFor({ state: 'hidden', timeout: timeToWait.modalToBeHidden });
}

async function openProject(page: any, contactName: string, projectName: string) {
  await page
    .locator('a[data-automationid="project-list-item"]')
    .filter({
      has: page.locator('div[data-automationid="project-item-project-name"]', { hasText: projectName }),
    })
    .filter({
      has: page.locator('span[data-automationid="project-item-contact-name"]', { hasText: contactName }),
    })
    .click();
}

async function createTask(page: any, taskName: string) {
  // Wait for task list to be loaded
  await page.waitForSelector('div[data-automationid="task-list-container"]', {
    state: 'visible',
    timeout: timeToWait.dataToBeLoaded,
  });

  const taskElements = page
    .locator('div[data-automationid="task-item-row-node"]')
    .filter({ has: page.locator('span[data-automationid="task-item-name-field"]', { hasText: taskName }) });

  const isTaskExist = (await taskElements.count()) > 0;
  if (isTaskExist) return;

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Task' }).click();

  await page.getByPlaceholder('Name or choose task').fill(taskName);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .locator('section[data-automationid="task-modal-modal"]')
    .waitFor({ state: 'hidden', timeout: timeToWait.modalToBeHidden });
}

async function addTimeSpentToTask(page: any, taskName: string, duration: number, date: Date, description?: string) {
  // Open time entry modal
  await page.locator('button[data-automationid="quick-add-dropdown-add-button"]:has-text("Add")').click();
  await page.getByRole('button', { name: 'Time entry' }).click();

  // Task
  await page.getByLabel('Task').click();
  await page.getByRole('button', { name: taskName, exact: true }).click();

  // Description
  if (description) await page.getByLabel('Description(optional)').fill(description);

  // Duration
  page.locator('#duration').fill(convertDecimalHourToHourMinutes(duration));

  // Date
  await page.getByPlaceholder('Choose a date').click();
  await page.getByLabel(dayjs(date).format('ddd MMM DD')).click();

  // Save
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .locator('section[data-automationid="time-entry-modal-modal"]')
    .waitFor({ state: 'hidden', timeout: timeToWait.modalToBeHidden });
}

async function openDetailedTimeReport(page: any, contactName: string) {
  // Go to Detailed Time Report
  await page.getByRole('link', { name: 'Reports' }).click();

  await page.getByRole('link', { name: 'Favourite Detailed Time More' }).click();

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

  await page.locator('data-automationid="report-settings-filter-modal-apply-button"').click();

  // Click Update to load report
  await page.getByRole('button', { name: 'Update' }).click();
}

function convertDecimalHourToHourMinutes(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

function getTaskEntries(filePath: string): TaskEntry[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => {
      return _.camelCase(header);
    },
    transform: (value, field) => {
      if (field === 'date') return new Date(value);
      if (field === 'duration') return parseFloat(value);
      return value;
    },
    complete: (results) => {
      return results.data as TaskEntry[];
    },
  });

  return result.data as TaskEntry[];
}
