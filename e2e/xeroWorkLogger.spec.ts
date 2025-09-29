import path from 'path';

import dayjs from 'dayjs';

import { test } from '@playwright/test';
import _ from 'lodash';

import { XeroConfig } from './interfaces/xeroConfig.js';
import { getTaskEntries, saveTaskEntriesWithLoggedStatus } from './logHelpers/fileHelper.js';
import { createOrOpenProject, goBackToAllProjects } from './logHelpers/projectHelper.js';
import { addTimeSpentToTask, createTask } from './logHelpers/taskHelper.js';
import { filter200ProjectsPerPage, loginXero } from './logHelpers/utils.js';

test.describe('Xero Work Logger', () => {
  // eslint-disable-next-line playwright/expect-expect
  test('Log work in Xero', async ({ page }) => {
    const config: XeroConfig = {
      contactName: process.env.VITE_XERO_CONTACT_NAME!,
      userName: process.env.VITE_XERO_USERNAME!,
      password: process.env.VITE_XERO_PASSWORD!,
      templatePath: process.env.VITE_XERO_TEMPLATE_PATH!,
    };

    const fileName = `TimeLog-${dayjs().format('YYYY-MM')}.csv`;
    const templateFilePath = path.join(config.templatePath, fileName);

    const taskEntries = getTaskEntries(templateFilePath);
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(taskEntries.length === 0, 'No task entries found to log.');

    try {
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
            entry.isLogged = true;
          }
        }

        await goBackToAllProjects(page);
      }

      // Open the detailed time report and keep the browser open
      // await openDetailedTimeReport(page, config.contactName);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      saveTaskEntriesWithLoggedStatus(templateFilePath, taskEntries);
    }
  });
});
