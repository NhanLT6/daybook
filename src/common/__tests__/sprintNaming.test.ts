import { describe, expect, it } from 'vitest';

import type { AppEvent } from '@/interfaces/Event';

import { atOccurrence, getOccurrences } from '@/common/eventRecurrence';
import { formatSprintName, joinSprintFormat, parseSprintFormat, sprintNumbers } from '@/common/sprintNaming';

// Mon Oct 5 → Fri Oct 16 2026, every 2 weeks
const sprints = (format: string, first = 1, overrides: Partial<AppEvent> = {}): AppEvent => ({
  id: 's',
  title: '',
  type: 'custom',
  date: '2026-10-05',
  endDate: '2026-10-16',
  repeat: { freq: 'week', interval: 2 },
  sprint: { format, first },
  ...overrides,
});

const nameOn = (event: AppEvent, occurrence: string) => atOccurrence(event, occurrence).title;

describe('parseSprintFormat', () => {
  it('splits text and tokens, and joins back', () => {
    const parts = parseSprintFormat('Sprint {year} Q{quarter}.{inQuarter}');
    expect(parts).toEqual([
      { text: 'Sprint ' },
      { token: 'year' },
      { text: ' Q' },
      { token: 'quarter' },
      { text: '.' },
      { token: 'inQuarter' },
    ]);
    expect(joinSprintFormat(parts)).toBe('Sprint {year} Q{quarter}.{inQuarter}');
  });

  it('keeps an unknown {word} as text', () => {
    expect(parseSprintFormat('Team {name} {number}')).toEqual([{ text: 'Team {name} ' }, { token: 'number' }]);
  });
});

describe('sprintNumbers', () => {
  const starts = ['2026-12-14', '2026-12-28', '2027-01-11', '2027-01-25'];

  it('restarts the quarter and year numbers in a new period', () => {
    expect(sprintNumbers(starts, 2, 1)).toEqual({ number: 3, inQuarter: 1, inYear: 1 });
    expect(sprintNumbers(starts, 3, 1)).toEqual({ number: 4, inQuarter: 2, inYear: 2 });
  });

  it('offsets only the first period by the first number', () => {
    expect(sprintNumbers(starts, 1, 6)).toEqual({ number: 7, inQuarter: 7, inYear: 7 });
    expect(sprintNumbers(starts, 2, 6)).toEqual({ number: 8, inQuarter: 1, inYear: 1 });
  });
});

describe('sprint titles', () => {
  it('names each sprint by quarter, restarting each quarter', () => {
    const event = sprints('Sprint {year} Q{quarter}.{inQuarter}');
    expect(nameOn(event, '2026-10-05')).toBe('Sprint 2026 Q4.1');
    expect(nameOn(event, '2026-10-19')).toBe('Sprint 2026 Q4.2');
    // Dec 28 → Jan 8 starts in Q4, so it counts there
    expect(nameOn(event, '2026-12-28')).toBe('Sprint 2026 Q4.7');
    expect(nameOn(event, '2027-01-11')).toBe('Sprint 2027 Q1.1');
  });

  it('starts mid-quarter from the first number', () => {
    const event = sprints('Sprint {year} Q{quarter}.{inQuarter}', 3);
    expect(nameOn(event, '2026-10-05')).toBe('Sprint 2026 Q4.3');
    expect(nameOn(event, '2027-01-11')).toBe('Sprint 2027 Q1.1');
  });

  it('keeps a running number going', () => {
    const event = sprints('Sprint {number}', 42);
    expect(nameOn(event, '2026-10-19')).toBe('Sprint 43');
    expect(nameOn(event, '2027-01-11')).toBe('Sprint 49');
  });

  it('numbers by year', () => {
    const event = sprints('Sprint {year}.{inYear}', 21);
    expect(nameOn(event, '2026-12-28')).toBe('Sprint 2026.27');
    expect(nameOn(event, '2027-01-11')).toBe('Sprint 2027.1');
  });

  it('gives a skipped sprint no number', () => {
    const event = sprints('Sprint {number}', 1, { repeat: { freq: 'week', interval: 2, skip: ['2026-10-19'] } });
    expect(getOccurrences(event, '2026-10-01', '2026-11-10')).toEqual(['2026-10-05', '2026-11-02']);
    expect(nameOn(event, '2026-11-02')).toBe('Sprint 2');
  });

  it('names a single sprint', () => {
    const event = sprints('Sprint {year} Q{quarter}.{inQuarter}', 7, {
      date: '2026-12-21',
      endDate: '2026-12-25',
      repeat: undefined,
    });
    expect(nameOn(event, '2026-12-21')).toBe('Sprint 2026 Q4.7');
  });

  it('leaves plain events alone', () => {
    expect(nameOn({ ...sprints(''), sprint: undefined, title: 'Standup' }, '2026-10-19')).toBe('Standup');
  });
});

describe('formatSprintName', () => {
  it('fills in dates, month, short year and ISO week', () => {
    const numbers = { number: 1, inQuarter: 1, inYear: 1 };
    expect(
      formatSprintName('{yy}-{month} W{week} ({start} – {end})', { start: '2026-10-19', end: '2026-10-30', numbers }),
    ).toBe('26-10 W43 (19/10 – 30/10)');
    // Jan 1 2027 is a Friday: still week 53 of 2026
    expect(formatSprintName('W{week}', { start: '2027-01-01', numbers })).toBe('W53');
  });
});
