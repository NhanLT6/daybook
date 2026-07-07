import { beforeEach, describe, expect, it } from 'vitest';

import { createPinia, setActivePinia } from 'pinia';

import { useDateDisplay } from '@/composables/useDateDisplay';
import { useSettingsStore } from '@/stores/settings';

describe('useDateDisplay.formatInternalDateForDisplay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // Regression: internal dates are stored ISO (YYYY-MM-DD). Formatting one must
  // not yield "Invalid Date" (previously it parsed the internal date as MM/DD/YYYY).
  it('formats an ISO internal date without producing Invalid Date', () => {
    const { formatInternalDateForDisplay } = useDateDisplay();
    const out = formatInternalDateForDisplay('2026-07-01');
    expect(out).not.toContain('Invalid');
    expect(out).toBe('07/01/2026'); // default dateDisplayFormat is MM/DD/YYYY
  });

  it('respects the user dateDisplayFormat setting', () => {
    const settings = useSettingsStore();
    settings.dateDisplayFormat = 'DD-MM-YYYY';
    const { formatInternalDateForDisplay } = useDateDisplay();
    expect(formatInternalDateForDisplay('2026-07-01')).toBe('01-07-2026');
  });
});
