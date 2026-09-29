import { reactive } from 'vue';

import { beforeEach, describe, expect, it } from 'vitest';

import type { AppEvent } from '@/interfaces/Event';

import { initDb } from '@/db';
import { useCollection } from '@/composables/useCollection';
import { useEvents } from '@/composables/useEvents';

describe('useEvents', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
    await useCollection('events').clear();
  });

  // Regression: useCollection's toRaw only unwraps the top level. A repeating event built from
  // reactive form state (or read back out of `events`) carries a nested proxy in `repeat`, which
  // IndexedDB rejects with DataCloneError — the save silently failed.
  it('saves events whose nested repeat rule is a reactive proxy', async () => {
    const { events, addEvent, replaceAll, ready } = useEvents();
    await ready;

    const end = reactive({ count: 4 });
    const event: AppEvent = {
      id: 'r1',
      title: 'Host daily',
      date: '2026-10-06',
      type: 'custom',
      repeat: { freq: 'week', interval: 2, end, skip: reactive(['2026-10-20']) },
    };

    await expect(addEvent(event)).resolves.not.toThrow();
    expect(events.value[0].repeat).toEqual({ freq: 'week', interval: 2, end: { count: 4 }, skip: ['2026-10-20'] });

    // Round-trip through replaceAll (the yearly holiday refresh path)
    await expect(replaceAll([...events.value])).resolves.not.toThrow();
    expect(events.value).toHaveLength(1);
  });
});
