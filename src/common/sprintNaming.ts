import type { SprintNaming } from '@/interfaces/Event';

import dayjs, { type Dayjs } from 'dayjs';

/**
 * Sprint names built from a format: plain text plus {token}s that each sprint fills in, like .NET's
 * ToString(format). Users never type tokens: the sprint form offers named styles and inserts tokens as chips.
 * A sprint belongs to the quarter / year it starts in. See docs/features/events.md (Sprints).
 */

export type SprintTokenKey =
  | 'year'
  | 'yy'
  | 'quarter'
  | 'month'
  | 'inQuarter'
  | 'inYear'
  | 'number'
  | 'week'
  | 'start'
  | 'end';

/** Every token, in the order the chip palette lists them. `label` is what the chip says. */
export const SPRINT_TOKENS: { key: SprintTokenKey; label: string }[] = [
  { key: 'year', label: 'Year' },
  { key: 'yy', label: 'Year, short' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'month', label: 'Month' },
  { key: 'inQuarter', label: 'No. in quarter' },
  { key: 'inYear', label: 'No. in year' },
  { key: 'number', label: 'Running no.' },
  { key: 'week', label: 'Week of year' },
  { key: 'start', label: 'Start date' },
  { key: 'end', label: 'End date' },
];

const TOKEN_KEYS = new Set<string>(SPRINT_TOKENS.map((t) => t.key));

export type SprintStyleId = 'quarter' | 'number' | 'year';

/** The ready-made name styles; anything else is Custom. */
export const SPRINT_STYLES: { id: SprintStyleId; format: string; hint: string }[] = [
  { id: 'quarter', format: 'Sprint {year} Q{quarter}.{inQuarter}', hint: 'By quarter. Number restarts each quarter' },
  { id: 'number', format: 'Sprint {number}', hint: 'Running number' },
  { id: 'year', format: 'Sprint {year}.{inYear}', hint: 'By year. Number restarts each year' },
];

export const DEFAULT_SPRINT_FORMAT = SPRINT_STYLES[0].format;

export type SprintFormatPart = { text: string } | { token: SprintTokenKey };

/** Splits a format into text and tokens. An unknown {word} stays text. */
export function parseSprintFormat(format: string): SprintFormatPart[] {
  const parts: SprintFormatPart[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = parts.at(-1);
    if (last && 'text' in last) last.text += text;
    else parts.push({ text });
  };
  let at = 0;
  for (const match of format.matchAll(/\{(\w+)\}/g)) {
    pushText(format.slice(at, match.index));
    if (TOKEN_KEYS.has(match[1])) parts.push({ token: match[1] as SprintTokenKey });
    else pushText(match[0]);
    at = match.index + match[0].length;
  }
  pushText(format.slice(at));
  return parts;
}

/** Inverse of parseSprintFormat. */
export const joinSprintFormat = (parts: SprintFormatPart[]): string =>
  parts.map((part) => ('token' in part ? `{${part.token}}` : part.text)).join('');

/** ISO 8601 week number (weeks start Monday; week 1 holds the year's first Thursday). */
const isoWeek = (day: Dayjs): number => {
  const thursday = day.add(3 - ((day.day() + 6) % 7), 'day');
  return Math.floor(thursday.diff(thursday.startOf('year'), 'day') / 7) + 1;
};

const quarterKey = (day: string) => `${day.slice(0, 4)}-${Math.ceil(Number(day.slice(5, 7)) / 3)}`;
const yearKey = (day: string) => day.slice(0, 4);

/**
 * The numbers of sprint `index` in a series whose sprints start on `starts` (sorted YYYY-MM-DD, skipped sprints
 * already left out). `first` is the first sprint's number: it offsets the running number, and the per-quarter /
 * per-year numbers within the first sprint's quarter / year only (a team joining mid-quarter at Q4.3).
 */
export function sprintNumbers(starts: string[], index: number, first: number) {
  const countIn = (key: (day: string) => string) => {
    const own = key(starts[index]);
    const count = starts.slice(0, index + 1).filter((day) => key(day) === own).length;
    return own === key(starts[0]) ? count + first - 1 : count;
  };
  return { number: first + index, inQuarter: countIn(quarterKey), inYear: countIn(yearKey) };
}

/** Fills in a format for one sprint. */
export function formatSprintName(
  format: string,
  sprint: { start: string; end?: string; numbers: ReturnType<typeof sprintNumbers> },
): string {
  const start = dayjs(sprint.start);
  const end = dayjs(sprint.end ?? sprint.start);
  const values: Record<SprintTokenKey, string> = {
    year: start.format('YYYY'),
    yy: start.format('YY'),
    quarter: String(Math.ceil((start.month() + 1) / 3)),
    month: String(start.month() + 1),
    inQuarter: String(sprint.numbers.inQuarter),
    inYear: String(sprint.numbers.inYear),
    number: String(sprint.numbers.number),
    week: String(isoWeek(start)),
    start: start.format('DD/MM'),
    end: end.format('DD/MM'),
  };
  return parseSprintFormat(format)
    .map((part) => ('token' in part ? values[part.token] : part.text))
    .join('');
}

/** Name of sprint `index` of a series; `starts` as in sprintNumbers, `spanDays` = days from a start to its end. */
export const sprintName = (naming: SprintNaming, starts: string[], index: number, spanDays: number): string =>
  formatSprintName(naming.format, {
    start: starts[index],
    end: dayjs(starts[index]).add(spanDays, 'day').format('YYYY-MM-DD'),
    numbers: sprintNumbers(starts, index, naming.first),
  });
