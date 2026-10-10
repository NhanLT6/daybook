import { describe, expect, it } from 'vitest';

import { parseChatCommand, suggestChatCommands } from '@/common/chatCommands';

describe('parseChatCommand', () => {
  it('splits a known command from the rest of the message', () => {
    const { command, rest } = parseChatCommand('/note ask BA about login\n[ ] check logs');
    expect(command?.name).toBe('note');
    expect(rest).toBe('ask BA about login\n[ ] check logs');
  });

  it('is case-insensitive and allows a bare command', () => {
    expect(parseChatCommand('/LOG').command?.name).toBe('log');
    expect(parseChatCommand('/catchup').rest).toBe('');
  });

  it('leaves unknown commands and plain text alone', () => {
    expect(parseChatCommand('/deploy now')).toEqual({ rest: '/deploy now' });
    expect(parseChatCommand('2h on T-123 /log')).toEqual({ rest: '2h on T-123 /log' });
  });

  it('needs a space after the command word', () => {
    expect(parseChatCommand('/notes are here').command).toBeUndefined();
  });
});

describe('suggestChatCommands', () => {
  it('lists every command for a lone slash and filters by prefix', () => {
    expect(suggestChatCommands('/').map((c) => c.name)).toEqual(['log', 'note', 'event', 'ask', 'catchup']);
    expect(suggestChatCommands('/no').map((c) => c.name)).toEqual(['note']);
  });

  it('stops suggesting once the command word is done', () => {
    expect(suggestChatCommands('/note ')).toEqual([]);
    expect(suggestChatCommands('hello')).toEqual([]);
  });
});
