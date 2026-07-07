import { describe, it, expect } from 'vitest';

import type { DaybookUIMessage } from '@/interfaces/AiChat';

import { extractLogsFromMessage, fileToBase64 } from '../useAiChat';

// Build a message from loosely-typed parts that mirror the AI SDK's streamed
// tool part shapes. Cast through unknown so fixtures stay terse.
function msg(...parts: unknown[]): Pick<DaybookUIMessage, 'parts'> {
  return { parts: parts as DaybookUIMessage['parts'] };
}

describe('extractLogsFromMessage', () => {
  const logs = [{ project: 'DS', task: 'DS-1234', date: '2026-07-07', duration: 120 }];

  it('reads logs from a completed tool-extractLogs part', () => {
    expect(
      extractLogsFromMessage(msg({ type: 'tool-extractLogs', toolCallId: 'c1', state: 'input-available', input: { logs } })),
    ).toEqual(logs);
  });

  it('returns [] while the tool input is still streaming', () => {
    expect(
      extractLogsFromMessage(msg({ type: 'tool-extractLogs', toolCallId: 'c1', state: 'input-streaming', input: undefined })),
    ).toEqual([]);
  });

  it('returns [] for a plain text (conversational) message', () => {
    expect(extractLogsFromMessage(msg({ type: 'text', text: 'what did I work on?' }))).toEqual([]);
  });

  it('ignores other tools', () => {
    expect(
      extractLogsFromMessage(msg({ type: 'tool-somethingElse', toolCallId: 'c1', state: 'input-available', input: { logs } })),
    ).toEqual([]);
  });

  it('supports plan entries with no duration', () => {
    const plan = [{ project: 'DS', task: 'DS-1234', date: '2026-07-07' }];
    expect(
      extractLogsFromMessage(msg({ type: 'tool-extractLogs', toolCallId: 'c1', state: 'input-available', input: { logs: plan } })),
    ).toEqual(plan);
  });
});

describe('useAiChat', () => {
  it('exports fileToBase64', () => {
    expect(typeof fileToBase64).toBe('function');
  });
});
