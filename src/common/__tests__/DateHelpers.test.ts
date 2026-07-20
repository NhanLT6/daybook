import { describe, expect, it } from 'vitest';

import { sumMinutesToHours } from '@/common/DateHelpers';

describe('sumMinutesToHours', () => {
  it('rounds once after summing, not per log', () => {
    // Each entry rounds UP by 0.05 individually (0.25→0.3, 0.75→0.8, 1.25→1.3, 1.75→1.8).
    // The old per-log rounding gave 0.3+0.8+1.3+1.8 = 4.2 (the bug).
    // Correct: round(240 / 60, 1) = 4.0
    expect(sumMinutesToHours([15, 45, 75, 105])).toBe(4.0);
  });

  it('reproduces the reported 7h55m → 8.1h drift', () => {
    // 475 minutes = 7h55m. Per-log rounding inflates to 8.1h; correct is 7.9h.
    expect(sumMinutesToHours([15, 45, 75, 105, 30, 60, 120, 25])).toBe(7.9);
  });

  it('returns 0 for no logs', () => {
    expect(sumMinutesToHours([])).toBe(0);
  });
});
