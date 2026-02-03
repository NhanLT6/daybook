import fs from 'fs';

import dayjs from 'dayjs';

import _ from 'lodash';
import Papa from 'papaparse';

import { TaskEntry } from '../interfaces/taskEntry.js';

/**
 * Get unlogged task entries from CSV file
 * Returns only entries that need to be logged (isLogged === false)
 */
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

/**
 * Get ALL task entries from CSV file (including already logged ones)
 * Used for preserving all rows when updating the file
 */
function getAllTaskEntries(filePath: string): TaskEntry[] {
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

  return result.data as TaskEntry[];
}

/**
 * Save task entries back to CSV file, preserving ALL rows
 * Only updates the IsLogged status for processed entries
 *
 * @param filePath - Path to the CSV file
 * @param processedEntries - Entries that were processed (with updated isLogged status)
 */
function saveTaskEntriesWithLoggedStatus(filePath: string, processedEntries: TaskEntry[]): void {
  // Read ALL entries from the original file (including already logged ones)
  const allEntries = getAllTaskEntries(filePath);

  // Create a map of processed entries by ID for quick lookup
  const processedMap = new Map(processedEntries.map((entry) => [entry.id, entry]));

  // Update isLogged status for processed entries while preserving all rows
  const updatedEntries = allEntries.map((entry) => {
    const processedEntry = processedMap.get(entry.id);
    return {
      Id: entry.id,
      Date: dayjs(entry.date).format('MM-DD-YY'),
      Project: entry.project,
      Task: entry.task,
      Duration: entry.duration,
      Description: entry.description || '',
      // Update isLogged status if this entry was processed, otherwise keep original
      IsLogged: processedEntry ? (processedEntry.isLogged ? 'true' : 'false') : (entry.isLogged ? 'true' : 'false'),
    };
  });

  const csvContent = Papa.unparse(updatedEntries);
  fs.writeFileSync(filePath, csvContent);
}

export { getTaskEntries, getAllTaskEntries, saveTaskEntriesWithLoggedStatus };
