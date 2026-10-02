import { referencedImageIds, sweepOrphanNoteImages } from '@/composables/useNoteImages';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ createdAt: new Map<string, number>(), deleted: [] as string[] }));
vi.mock('@/db/noteImageStore', () => ({
  getNoteImageIdsBefore: async (cutoff: number) =>
    [...store.createdAt].filter(([, at]) => at < cutoff).map(([id]) => id),
  deleteNoteImages: async (ids: string[]) => {
    store.deleted.push(...ids);
    ids.forEach((id) => store.createdAt.delete(id));
  },
  getNoteImage: async () => undefined,
  putNoteImages: async () => {},
}));

const DAY = 24 * 60 * 60 * 1000;
const NOW = 10 * DAY;

describe('useNoteImages', () => {
  beforeEach(() => {
    store.createdAt.clear();
    store.deleted = [];
  });

  it('finds image ids in note html', () => {
    expect(referencedImageIds('<p>a</p><img data-image-id="a1"><img data-image-id="b_2" width="3">')).toEqual([
      'a1',
      'b_2',
    ]);
  });

  it('sweeps only unreferenced images older than the grace period', async () => {
    store.createdAt.set('used', NOW - 5 * DAY);
    store.createdAt.set('orphan-old', NOW - 2 * DAY);
    store.createdAt.set('orphan-new', NOW - DAY / 2); // e.g. pasted into a note that isn't saved yet

    const count = await sweepOrphanNoteImages(['<img data-image-id="used">'], NOW);

    expect(count).toBe(1);
    expect(store.deleted).toEqual(['orphan-old']);
    expect([...store.createdAt.keys()]).toEqual(['used', 'orphan-new']);
  });
});
