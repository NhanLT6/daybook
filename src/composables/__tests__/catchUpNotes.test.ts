import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useAuth', () => ({ authHeaders: async () => ({ Authorization: 'Bearer t' }) }));

import { httpClient } from '@/apis/httpClient';
import { db, initDb } from '@/db';
import { fetchCatchUpItems, logsStamp, summaryKey } from '@/composables/useCatchUpSummary';

const taskItem = (text: string, checked: boolean) =>
  `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>${text}</p></div></li>`;

describe('Catch-up with notes', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initDb();
    await db.notes.clear();
    await db.timeLogs.clear();
    vi.restoreAllMocks();
  });

  it('sends open note items and shows the returned lines as a notes group', async () => {
    await db.notes.upsert({
      id: 'n1',
      content: `<p>ask BA abt login redirect?</p><ul data-type="taskList">${taskItem('ping PM', false)}${taskItem('old', true)}</ul>`,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({
      data: { lines: [], todoLines: [], noteLines: ['Ask the BA about the login redirect', 'Ping the PM'] },
    });

    const items = await fetchCatchUpItems();

    expect(post.mock.calls[0][1]).toMatchObject({ notes: ['ask BA abt login redirect?', 'ping PM'] });
    expect(items).toEqual([
      { project: '', text: 'Ask the BA about the login redirect', ongoing: false, group: 'notes' },
      { project: '', text: 'Ping the PM', ongoing: false, group: 'notes' },
    ]);
  });

  it('does not call the API when there are no logs, plans or open note items', async () => {
    const post = vi.spyOn(httpClient, 'post');
    expect(await fetchCatchUpItems()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('cache key changes when open note items change, and matches the old key without notes', () => {
    expect(summaryKey([], [])).toBe(logsStamp([]));
    expect(summaryKey([], ['a'])).not.toBe(summaryKey([], ['a', 'b']));
  });
});
