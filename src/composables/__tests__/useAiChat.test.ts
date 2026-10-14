import { describe, it, expect } from 'vitest';

import type { DaybookUIMessage } from '@/interfaces/AiChat';

import { convertToModelMessages, generateText, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

import { extractLogsInputSchema } from '@/interfaces/aiTools';

import { extractLogsFromMessage, fileToBase64, withExtractLogsResults } from '../useAiChat';

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

describe('withExtractLogsResults', () => {
  const logs = [{ project: 'DS', task: 'DS-4442', date: '2026-10-19', duration: 240 }];
  // The reported conversation: logs extracted, then a correction typed before saving
  const history = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'log team meeting on monday this week 30mins' }] },
    {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'tool-extractLogs', toolCallId: 'call_1', state: 'input-available', input: { logs } }],
    },
    { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'the date is wrong, should be 12 Oct not 19' }] },
  ] as unknown as DaybookUIMessage[];

  const tools = { extractLogs: tool({ inputSchema: extractLogsInputSchema }) };
  const model = () =>
    new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'ok' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }),
    });

  it('the raw history is rejected for a missing tool result (the reported error)', async () => {
    const messages = await convertToModelMessages(history);
    await expect(generateText({ model: model(), messages, tools })).rejects.toThrow(/Tool result is missing/);
  });

  it('answers the pending call so the follow-up message goes through', async () => {
    const messages = await convertToModelMessages(withExtractLogsResults(history, () => undefined));
    await expect(generateText({ model: model(), messages, tools })).resolves.toBeTruthy();
  });

  it('tells the model what the user did with the card', () => {
    const outputOf = (state?: 'saved' | 'discarded') => {
      const part = withExtractLogsResults(history, () => state)[1].parts[0];
      return 'output' in part ? part.output : undefined;
    };
    expect(outputOf()).toEqual({ status: 'not saved yet' });
    expect(outputOf('saved')).toEqual({ status: 'saved' });
    expect(outputOf('discarded')).toEqual({ status: 'discarded' });
  });

  it('leaves the chat state alone, so the log card still reads its input', () => {
    withExtractLogsResults(history, () => 'saved');
    expect(extractLogsFromMessage(history[1])).toEqual(logs);
  });
});

describe('useAiChat', () => {
  it('exports fileToBase64', () => {
    expect(typeof fileToBase64).toBe('function');
  });
});
