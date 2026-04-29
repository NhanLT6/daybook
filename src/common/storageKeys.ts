import dayjs from 'dayjs';

import { yearAndMonthFormat } from '@/common/DateFormat';

const currentMonth = dayjs().format(yearAndMonthFormat);

export const storageKeys = {
  timeLogsOfCurrentMonth: `timeLogs-${currentMonth}`,
  tasks: `tasks-${currentMonth}`,
  projects: `projects-${currentMonth}`,
  pinnedProjects: `pinnedProjects-${currentMonth}`,
  jiraProjects: `jiraProjects-${currentMonth}`,
  events: 'events',
  categories: 'categories',
  settings: {
    calendarView: 'calendarView',
    projectColorMaps: 'projectColorMaps',
  },
  jira: {
    config: 'jiraConfig',
    lastSyncDate: 'jiraLastSyncDate',
  },
};
