import { describe, expect, it } from 'vitest';

import { GREETING_INTERVAL_MS, getGreetingReason, getTimeOfDayGreeting } from '@/composables/useGreetingNotifications';

describe('useGreetingNotifications helpers', () => {
  it('uses time-of-day greeting copy', () => {
    expect(getTimeOfDayGreeting(new Date('2026-05-29T08:00:00'))).toBe('Good morning');
    expect(getTimeOfDayGreeting(new Date('2026-05-29T13:00:00'))).toBe('Good afternoon');
    expect(getTimeOfDayGreeting(new Date('2026-05-29T19:00:00'))).toBe('Good evening');
  });

  it('shows a first-visit greeting when no history exists', () => {
    expect(getGreetingReason(1000, null, null)).toBe('first-visit');
  });

  it('does not greet again before the four-hour cadence expires', () => {
    const now = 10_000;
    expect(getGreetingReason(now, '1000', String(now - GREETING_INTERVAL_MS + 1))).toBeNull();
  });

  it('shows a return greeting after four hours', () => {
    const now = 10_000;
    expect(getGreetingReason(now, '1000', String(now - GREETING_INTERVAL_MS))).toBe('return');
  });
});
