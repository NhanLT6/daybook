import fs from 'fs';

import dayjs from 'dayjs';

import _ from 'lodash';
import Papa from 'papaparse';

import { TaskEntry } from '../interfaces/taskEntry.js';

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
      if (field === 'isLogged') return value.toLowerCase() === 'true';
      return value;
    },
    complete: (results) => {
      return results.data as TaskEntry[];
    },
  });

  return (result.data as TaskEntry[]).filter((entry) => !entry.isLogged);
}

function saveTaskEntriesWithLoggedStatus(filePath: string, taskEntries: TaskEntry[]): void {
  // Create a copy of taskEntries that has duration in hours instead of minutes
  const entriesForSaving = taskEntries.map((entry) => ({
    Id: entry.id,
    Date: dayjs(entry.date).format('MM-DD-YY'),
    Project: entry.project,
    Task: entry.task,
    Duration: entry.duration,
    Description: entry.description || '',
    IsLogged: entry.isLogged ? 'true' : 'false',
  }));

  const csvContent = Papa.unparse(entriesForSaving);
  fs.writeFileSync(filePath, csvContent);
}

export { getTaskEntries, saveTaskEntriesWithLoggedStatus };
