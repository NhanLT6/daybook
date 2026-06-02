import { describe, expect, it } from 'vitest';

import type { RememberedDate } from '@/stores/settings';
import { REMEMBER_DATE_EXPIRY_MS, getRememberedDate } from '@/composables/useRememberDate';

describe('getRememberedDate', () => {
  const now = 1_000_000;
  const fresh: RememberedDate = { date: '2026-06-03T00:00:00.000Z', savedAt: now - 1000 };

  it('returns null when setting is disabled', () => {
    expect(getRememberedDate(fresh, false, now)).toBeNull();
  });

  it('returns null when no entry is stored', () => {
    expect(getRememberedDate(null, true, now)).toBeNull();
  });

  it('returns the date for a fresh entry', () => {
    const result = getRememberedDate(fresh, true, now);
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe(fresh.date);
  });

  it('returns null for an expired entry (past boundary)', () => {
    const expired: RememberedDate = { date: '2026-06-03T00:00:00.000Z', savedAt: now - REMEMBER_DATE_EXPIRY_MS - 1 };
    expect(getRememberedDate(expired, true, now)).toBeNull();
  });

  it('is still valid exactly at the expiry boundary', () => {
    const boundary: RememberedDate = { date: '2026-06-03T00:00:00.000Z', savedAt: now - REMEMBER_DATE_EXPIRY_MS };
    expect(getRememberedDate(boundary, true, now)).toBeInstanceOf(Date);
  });

  it('returns null for a corrupted date string', () => {
    const corrupt: RememberedDate = { date: '[object Object]', savedAt: now - 1000 };
    expect(getRememberedDate(corrupt, true, now)).toBeNull();
  });
});
