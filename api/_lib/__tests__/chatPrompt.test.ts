import { describe, expect, it } from 'vitest';

import { buildSystemPrompt, type PromptContext } from '../chatPrompt';

const context: PromptContext = {
  projects: ['Team work'],
  tickets: ['DS-4475 Redesigned test tracking flow'],
  reviewTickets: ['DS-4556 Fix export'],
  tasks: [{ project: 'Team work', title: 'Daily meeting' }],
};

const contextStart = (prompt: string) => prompt.indexOf('\nContext\n');

describe('buildSystemPrompt', () => {
  it('/log gets the log rules and lists, not the app guide or notes rules', () => {
    const prompt = buildSystemPrompt(context, '2026-10-28', 480, 'log');
    expect(prompt).toContain('call the extractLogs tool');
    expect(prompt).toContain('DS-4475 Redesigned test tracking flow');
    expect(prompt).toContain('Daily target: 480 minutes');
    expect(prompt).not.toContain('Questions about Daybook itself');
    expect(prompt).not.toContain('sticky notes');
  });

  it('/note gets only the dates, no lists', () => {
    const prompt = buildSystemPrompt(context, '2026-10-28', 480, 'note');
    expect(prompt).toContain('addNote');
    expect(prompt).toContain('2026-10-28');
    expect(prompt).not.toContain('DS-4475');
  });

  it('without a command, everything is there', () => {
    const prompt = buildSystemPrompt(context, '2026-10-28', null, undefined);
    for (const part of ['extractLogs', 'searchNotes', 'addEvent', 'Questions about Daybook itself', 'Daily target: none'])
      expect(prompt).toContain(part);
  });

  // Providers cache an unchanged prefix: everything that varies per user or day must come after the fixed text
  it('keeps everything per-request in the Context tail', () => {
    const a = buildSystemPrompt(context, '2026-10-28', 480, 'log');
    const b = buildSystemPrompt({ ...context, tickets: ['XY-1 Other'] }, '2026-11-02', null, 'log');
    expect(contextStart(a)).toBeGreaterThan(0);
    expect(a.slice(0, contextStart(a))).toBe(b.slice(0, contextStart(b)));
  });
});
