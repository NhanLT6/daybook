import dayjs from 'dayjs';

import { yearAndMonthFormat } from '@/common/DateFormat';

const currentMonth = dayjs().format(yearAndMonthFormat);
const currentYear = dayjs().year();

export const storageKeys = {
  timeLogsOfCurrentMonth: `timeLogs-${currentMonth}`,
  tasks: `tasks-${currentMonth}`,
  projects: `projects-${currentMonth}`,
  jiraProjects: `jiraProjects-${currentMonth}`,
  holidays: `holidays-${currentYear}`,
  settings: {
    projectColorMaps: 'projectColorMaps',
  },
  jira: {
    config: 'jiraConfig',
    lastSyncDate: 'jiraLastSyncDate', // Stores the date of last auto-sync
  },
};
