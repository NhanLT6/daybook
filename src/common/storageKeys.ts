import dayjs from 'dayjs';

import { yearAndMonthFormat } from '@/common/DateFormat';

const currentMonth = dayjs().format(yearAndMonthFormat);

export const storageKeys = {
  xeroLogsOfCurrentMonth: `xeroLogs-${currentMonth}`,
  xeroTasks: `xeroTasks-${currentMonth}`,
  xeroProjects: `xeroProjects-${currentMonth}`,
  settings: {
    projectColorMaps: 'projectColorMaps',
  },
};
