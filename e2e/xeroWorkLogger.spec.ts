import path from 'path';

import dayjs from 'dayjs';

import { test } from '@playwright/test';
import _ from 'lodash';

import { XeroConfig } from './interfaces/xeroConfig.js';
import { getTaskEntries, saveTaskEntriesWithLoggedStatus } from './logHelpers/fileHelper.js';
import { ProgressTracker } from './logHelpers/progressTracker.js';
import { createOrOpenProject, goBackToAllProjects } from './logHelpers/projectHelper.js';
import { addTimeSpentToTask, createTask } from './logHelpers/taskHelper.js';
import { convertMinutesToHourMinutes, filter200ProjectsPerPage, loginXero } from './logHelpers/utils.js';

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
    console.log(`\n📊 Total records to log: ${taskEntries.length}\n`);

    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(taskEntries.length === 0, 'No task entries found to log.');

    // Initialize progress tracker
    const progress = new ProgressTracker(taskEntries.length);

    try {
      await loginXero(page, config);
      await filter200ProjectsPerPage(page);

      // Create Projects
      const projectGroups = _.groupBy(taskEntries, (e) => e.project);

      for (const [projectName, tasksEntriesInProject] of Object.entries(projectGroups)) {
        console.log(''); // blank line between projects
        await createOrOpenProject(page, config.contactName, projectName);

        // Create Tasks
        const taskGroups = _.groupBy(tasksEntriesInProject, (te) => te.task);
        for (const [taskName, tasks] of Object.entries(taskGroups)) {
          await createTask(page, taskName);

          for (const entry of tasks) {
            // Plan entries are filtered out by getTaskEntries before reaching here
            await addTimeSpentToTask(page, entry.task, entry.duration!, entry.date, entry.description);
            entry.isLogged = true;
            const label = progress.increment();
            const duration = convertMinutesToHourMinutes(entry.duration!);
            const date = dayjs(entry.date).format('YYYY-MM-DD');
            const desc = entry.description ? ` · "${entry.description}"` : '';
            console.log(`    ${label} ⏱  ${date} · ${duration}${desc}`);
          }
        }

        await goBackToAllProjects(page);
      }

      // Open the detailed time report and keep the browser open
      // await openDetailedTimeReport(page, config.contactName);

      // Count successfully logged entries
      const loggedCount = taskEntries.filter((e) => e.isLogged).length;
      console.log(`\n✅ Successfully logged: ${loggedCount}/${taskEntries.length} entries\n`);
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      const loggedCount = taskEntries.filter((e) => e.isLogged).length;
      console.log(`\n⚠️  Partially logged: ${loggedCount}/${taskEntries.length} entries\n`);
    } finally {
      saveTaskEntriesWithLoggedStatus(templateFilePath, taskEntries);
      console.log('💾 CSV file updated with logged status\n');
    }
  });
});
