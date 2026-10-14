import { describe, expect, it } from 'vitest';

import { dateContext } from '../dateContext';

describe('dateContext', () => {
  it('lists this week and last week Monday-first, so "monday this week" is a lookup', () => {
    const text = dateContext('2026-10-14'); // a Wednesday
    expect(text).toContain('Today is Wednesday 2026-10-14.');
    expect(text).toContain('This week: Monday 2026-10-12, Tuesday 2026-10-13, Wednesday 2026-10-14');
    expect(text).toContain('Sunday 2026-10-18.');
    expect(text).toContain('Last week: Monday 2026-10-05,');
  });

  it('keeps a Sunday in the week that started the Monday before', () => {
    expect(dateContext('2026-10-18')).toContain('This week: Monday 2026-10-12,');
  });

  it('starts the week on today when today is Monday', () => {
    expect(dateContext('2026-10-12')).toContain('This week: Monday 2026-10-12,');
  });

  it('falls back to the raw date when it cannot be parsed', () => {
    expect(dateContext('nonsense')).toBe("Today's date is nonsense.");
  });
});
