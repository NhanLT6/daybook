import dayjs from 'dayjs';

import { yearAndMonthFormat } from '@/common/DateFormat';

const currentMonth = dayjs().format(yearAndMonthFormat);
const currentYear = dayjs().year();

export const storageKeys = {
  timeLogsOfCurrentMonth: `timeLogs-${currentMonth}`,
  tasks: `tasks-${currentMonth}`,
  projects: `projects-${currentMonth}`,
  holidays: `holidays-${currentYear}`,
  settings: {
    projectColorMaps: 'projectColorMaps',
  },
};
