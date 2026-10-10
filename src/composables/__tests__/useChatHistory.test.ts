import { describe, expect, it } from 'vitest';

import type { DaybookUIMessage } from '@/interfaces/AiChat';

import { describeConversation, stripImages } from '../useChatHistory';

const user = (parts: DaybookUIMessage['parts']): DaybookUIMessage => ({ id: 'u1', role: 'user', parts });

describe('describeConversation', () => {
  it('titles a command message by its text and keeps the command', () => {
    expect(describeConversation([user([{ type: 'text', text: '/note buy milk' }])])).toEqual({
      title: 'buy milk',
      command: 'note',
    });
  });

  it('uses the plain text when there is no command', () => {
    expect(describeConversation([user([{ type: 'text', text: 'DS-1234 2h' }])])).toEqual({
      title: 'DS-1234 2h',
      command: undefined,
    });
  });

  it('falls back to the command name for a bare command', () => {
    expect(describeConversation([user([{ type: 'text', text: '/catchup' }])]).title).toBe('/catchup');
  });
});

describe('stripImages', () => {
  it('drops pasted images and keeps the text', () => {
    const [m] = stripImages([
      user([
        { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' },
        { type: 'text', text: 'from this screenshot' },
      ]),
    ]);
    expect(m.parts).toEqual([{ type: 'text', text: 'from this screenshot' }]);
  });

  it('leaves a placeholder when the image was the whole message', () => {
    const [m] = stripImages([user([{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' }])]);
    expect(m.parts).toEqual([{ type: 'text', text: '(image)' }]);
  });
});
