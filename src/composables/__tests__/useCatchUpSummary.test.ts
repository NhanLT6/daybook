import { beforeEach, describe, expect, it } from 'vitest';

import { createPinia, setActivePinia } from 'pinia';

import { isGeminiAvailable, shouldSkipCatchUp, useCatchUpSummary } from '@/composables/useCatchUpSummary';
import { useNotificationCenterStore } from '@/stores/notificationCenter';

describe('useCatchUpSummary helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('skips catch-up when Gemini is unavailable', () => {
    expect(shouldSkipCatchUp('2026-05-29', null, { enabled: false, apiKey: '', model: 'gemini-2.5-flash' })).toBe(true);
  });

  it('skips catch-up when dismissed today', () => {
    expect(
      shouldSkipCatchUp('2026-05-29', '2026-05-29', {
        enabled: true,
        apiKey: 'key',
        model: 'gemini-2.5-flash',
      }),
    ).toBe(true);
  });

  it('allows catch-up when Gemini is available and not dismissed', () => {
    const config = { enabled: true, apiKey: 'key', model: 'gemini-2.5-flash' };

    expect(isGeminiAvailable(config)).toBe(true);
    expect(shouldSkipCatchUp('2026-05-29', null, config)).toBe(false);
  });

  it('enqueues a ready catch-up notification', () => {
    const { enqueueCatchUp } = useCatchUpSummary();
    const notificationCenter = useNotificationCenterStore();

    enqueueCatchUp('## Recent work', '2026-05-29');

    expect(notificationCenter.queueCount).toBe(1);
    expect(notificationCenter.activeItem?.kind).toBe('catchup');
    expect(notificationCenter.activeItem?.payload?.markdown).toBe('## Recent work');
  });
});
