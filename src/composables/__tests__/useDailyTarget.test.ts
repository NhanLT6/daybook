import { describe, expect, it } from 'vitest';

import { dailyTargetMinutes } from '@/composables/useDailyTarget';

describe('dailyTargetMinutes', () => {
  it('converts the target hours to minutes', () => {
    expect(dailyTargetMinutes(true, 8)).toBe(480);
    expect(dailyTargetMinutes(true, 7.5)).toBe(450);
  });

  it('is null (no limit) when the target is off, even with hours kept', () => {
    expect(dailyTargetMinutes(false, 8)).toBeNull();
  });

  it('is null for a cleared or non-positive hours value', () => {
    expect(dailyTargetMinutes(true, null)).toBeNull();
    expect(dailyTargetMinutes(true, 0)).toBeNull();
  });
});
