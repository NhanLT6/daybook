import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { NO_TASK } from '@/composables/useTaskBreakdown';
import type { TimeLog } from '@/interfaces/TimeLog';

export interface DateBounds {
  from: dayjs.Dayjs;
  to: dayjs.Dayjs;
}

/** Raw VDatePicker range output (Date[]) → inclusive day bounds, or null when empty. */
export function computeDateBounds(range: unknown[]): DateBounds | null {
  if (!range.length) return null;
  return {
    from: dayjs(range[0] as Date).startOf('day'),
    to: dayjs(range[range.length - 1] as Date).endOf('day'),
  };
}

export interface LogFilterCriteria {
  project?: string | null;
  task?: string | null;
  dateBounds?: DateBounds | null;
  search?: string;
}

/**
 * Single source of truth for the project → task → date range → text search filter
 * chain, shared by LogList (the filtered table) and HomeView (Insights' filtered stats),
 * so both surfaces always agree on which logs are "currently filtered".
 */
export function filterTimeLogs(logs: TimeLog[], criteria: LogFilterCriteria): TimeLog[] {
  let result = logs;

  if (criteria.project) result = result.filter((l) => l.project === criteria.project);

  if (criteria.task) {
    result =
      criteria.task === NO_TASK ? result.filter((l) => !l.task) : result.filter((l) => l.task === criteria.task);
  }

  const bounds = criteria.dateBounds;
  if (bounds) {
    result = result.filter((l) => {
      const d = dayjs(l.date, isoDateFormat);
      return d.isValid() && !d.isBefore(bounds.from) && !d.isAfter(bounds.to);
    });
  }

  const q = criteria.search?.trim().toLowerCase();
  if (q) result = result.filter((l) => [l.project, l.task, l.description].some((f) => f?.toLowerCase().includes(q)));

  return result;
}
