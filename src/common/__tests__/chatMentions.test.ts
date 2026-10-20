import { describe, expect, it } from 'vitest';

import { type ChatMention, findMentionQuery, foldText, matchMentions, splitMentions } from '@/common/chatMentions';

const project = (label: string): ChatMention => ({ label, kind: 'project', project: label });
const task = (p: string, t: string): ChatMention => ({ label: `${p} › ${t}`, kind: 'task', project: p, task: t });

describe('findMentionQuery', () => {
  it('starts at a / that opens the text or follows whitespace', () => {
    expect(findMentionQuery('/da', 3)).toEqual({ start: 0, query: 'da' });
    expect(findMentionQuery('2h on /dao t', 12)).toEqual({ start: 6, query: 'dao t' });
    expect(findMentionQuery('/log 2h /x', 10)).toEqual({ start: 8, query: 'x' });
  });

  it('ignores dates, and/or and URLs', () => {
    expect(findMentionQuery('meeting 10/20', 13)).toBeNull();
    expect(findMentionQuery('và/hoặc', 7)).toBeNull();
    expect(findMentionQuery('see https://x.io/a', 18)).toBeNull();
  });

  it('stops at a line break, a leading space or the caret', () => {
    expect(findMentionQuery('/da\nmore', 8)).toBeNull();
    expect(findMentionQuery('/ da', 4)).toBeNull();
    expect(findMentionQuery('/dao tao', 4)).toEqual({ start: 0, query: 'dao' });
  });
});

describe('matchMentions', () => {
  const list = [project('DS-123 Login bug'), project('Đào tạo'), task('Team work', 'Daily meeting'), project('Admin')];

  it('matches accents-, case- and word-insensitively, label starts first', () => {
    expect(foldText('Đào tạo')).toBe('dao tao');
    expect(matchMentions(list, 'd', 8).map((m) => m.label)).toEqual([
      'DS-123 Login bug',
      'Đào tạo',
      'Team work › Daily meeting',
    ]); // not "Admin": the d is mid-word
    expect(matchMentions(list, 'login', 8).map((m) => m.label)).toEqual(['DS-123 Login bug']);
    expect(matchMentions(list, '123', 8).map((m) => m.label)).toEqual(['DS-123 Login bug']);
    expect(matchMentions(list, 'dao t', 8).map((m) => m.label)).toEqual(['Đào tạo']);
    expect(matchMentions(list, 'xyz', 8)).toEqual([]);
  });

  it('keeps the given order for an empty query, up to the limit', () => {
    expect(matchMentions(list, '', 2).map((m) => m.label)).toEqual(['DS-123 Login bug', 'Đào tạo']);
  });
});

describe('splitMentions', () => {
  it('cuts out whole labels only', () => {
    expect(splitMentions('2h on DS-123 Login bug, fixed', ['DS-123 Login bug'])).toEqual([
      { text: '2h on ', mention: false },
      { text: 'DS-123 Login bug', mention: true },
      { text: ', fixed', mention: false },
    ]);
    expect(splitMentions('retrospective', ['Retro'])).toEqual([{ text: 'retrospective', mention: false }]);
    expect(splitMentions('Retrospective', ['Retro'])).toEqual([{ text: 'Retrospective', mention: false }]);
  });

  it('prefers the longest label', () => {
    expect(splitMentions('Team work › Retro 1h', ['Team work', 'Team work › Retro'])).toEqual([
      { text: 'Team work › Retro', mention: true },
      { text: ' 1h', mention: false },
    ]);
  });
});
