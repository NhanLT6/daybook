import { computed } from 'vue';

import type { ChatCommandName } from '@/common/chatCommands';
import type { DaybookUIMessage } from '@/interfaces/AiChat';
import type { TextUIPart } from 'ai';

import { useStorage } from '@vueuse/core';

import { parseChatCommand } from '@/common/chatCommands';
import { storageKeys } from '@/common/storageKeys';

export interface ChatConversation {
  id: string;
  title: string; // first user message, shown on the history pill
  command?: ChatCommandName; // first message's command, colours the pill's dot
  createdAt: number;
  updatedAt: number;
  messages: DaybookUIMessage[];
}

// Older conversations fall off the end; history is for "what did I just log", not an archive
export const MAX_CONVERSATIONS = 50;

// Newest first. Kept in localStorage: conversations are small once images are dropped (below)
const conversations = useStorage<ChatConversation[]>(storageKeys.chat.history, []);

/**
 * Pasted screenshots are data URLs and would fill localStorage after a few chats,
 * so a stored message keeps its text and drops the image.
 */
export function stripImages(messages: DaybookUIMessage[]): DaybookUIMessage[] {
  return messages.map((m) => {
    if (!m.parts.some((p) => p.type === 'file')) return m;
    const parts = m.parts.filter((p) => p.type !== 'file');
    return { ...m, parts: parts.length ? parts : [{ type: 'text', text: '(image)' }] };
  });
}

/** Title and command from the first user message, e.g. `/note buy milk` → "buy milk", note. */
export function describeConversation(messages: DaybookUIMessage[]): Pick<ChatConversation, 'title' | 'command'> {
  const first = messages.find((m) => m.role === 'user');
  const text = first?.parts.find((p): p is TextUIPart => p.type === 'text')?.text.trim() ?? '';
  const { command, rest } = parseChatCommand(text);
  return { title: rest || (command ? `/${command.name}` : text) || 'Image', command: command?.name };
}

export function useChatHistory() {
  const byId = computed(() => new Map(conversations.value.map((c) => [c.id, c])));

  /** Create or update a conversation and move it to the top. */
  const upsert = (id: string, messages: DaybookUIMessage[]) => {
    if (!messages.length) return;
    const now = Date.now();
    const existing = byId.value.get(id);
    const next: ChatConversation = {
      id,
      ...describeConversation(messages),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: stripImages(messages),
    };
    conversations.value = [next, ...conversations.value.filter((c) => c.id !== id)].slice(0, MAX_CONVERSATIONS);
  };

  const get = (id: string) => byId.value.get(id);

  return { conversations, upsert, get };
}
