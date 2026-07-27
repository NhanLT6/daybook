import dayjs from 'dayjs';

import { parse, unparse } from 'papaparse';

import { camelCase, toNumber } from 'lodash';
import { nanoid } from 'nanoid';

import { isoDateFormat, templateDateFormat } from '@/common/DateFormat';
import type { TimeLog } from '@/interfaces/TimeLog';

// Xero template columns; IsLogged is a Xero concept, not part of the core model.
export function xeroExportCsv(logs: TimeLog[]): string {
  return unparse(
    logs.map((log) => ({
      Id: log.id,
      Date: dayjs(log.date, isoDateFormat).format(templateDateFormat),
      Project: log.project,
      Task: log.task,
      Duration: log.duration ?? '',
      Type: log.type ?? 'log',
      Description: log.description,
      IsLogged: false,
    })),
  );
}

export function xeroImportCsv(csv: string): TimeLog[] {
  const result = parse(csv, {
    header: true,
    transformHeader: (h: string) => camelCase(h),
    transform(value: string, header: string) {
      if (header === 'date') return dayjs(value, templateDateFormat).format(isoDateFormat);
      if (header === 'duration') return value ? toNumber(value) : undefined;
      if (header === 'type') return value === 'plan' ? 'plan' : 'log';
      return value;
    },
  });
  if (result.errors.length) throw new Error(result.errors.map((e) => e.message).join('; '));
  return (result.data as Record<string, string | number | undefined>[]).map((row) => {
    const duration = row.duration as number | undefined;
    return {
      id: (row.id as string) ?? nanoid(),
      date: row.date as string,
      project: row.project as string,
      task: row.task as string,
      duration: duration || undefined,
      type: (row.type as 'log' | 'plan' | undefined) ?? (duration ? 'log' : 'plan'),
      description: row.description as string | undefined,
    };
  });
}
