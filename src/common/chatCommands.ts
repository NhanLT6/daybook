import type { ServerChatCommand } from '@/interfaces/aiTools';

export type ChatCommandName = ServerChatCommand | 'catchup';

export interface ChatCommand {
  name: ChatCommandName;
  icon: string;
  color: string; // theme color (main.ts `cmd-*`), so each feature reads apart at a glance
  hint: string; // shown in the / menu
}

// Order = order in the / menu: the logging command first, since that is what Chat is mostly for
export const CHAT_COMMANDS: ChatCommand[] = [
  { name: 'log', icon: 'mdi-clock-plus-outline', color: 'cmd-log', hint: 'Log time' },
  { name: 'note', icon: 'mdi-note-plus-outline', color: 'cmd-note', hint: 'Save a sticky note' },
  { name: 'event', icon: 'mdi-calendar-plus', color: 'cmd-event', hint: 'Add a calendar event' },
  { name: 'ask', icon: 'mdi-note-search-outline', color: 'cmd-ask', hint: 'Ask about your notes' },
  { name: 'catchup', icon: 'mdi-history', color: 'cmd-catchup', hint: 'Catch up on recent work' },
];

/** `/note buy milk` → `{ command: 'note', rest: 'buy milk' }`. Unknown or no command → `command` undefined. */
export function parseChatCommand(text: string): { command?: ChatCommand; rest: string } {
  const match = /^\/(\w+)(?:\s+|$)([\s\S]*)$/.exec(text.trimStart());
  const command = match && CHAT_COMMANDS.find((c) => c.name === match[1].toLowerCase());
  return command ? { command, rest: match[2].trim() } : { rest: text };
}

/**
 * Commands to suggest while the user is still typing the command word (`/`, `/no`).
 * Empty once they type a space or the text doesn't start with `/`.
 */
export function suggestChatCommands(text: string): ChatCommand[] {
  const match = /^\/(\w*)$/.exec(text);
  if (!match) return [];
  const typed = match[1].toLowerCase();
  return CHAT_COMMANDS.filter((c) => c.name.startsWith(typed));
}
