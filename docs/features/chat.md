# Chat

Chat turns plain messages into app data. Server: `api/chat.ts` (system prompt, tool schemas). Client: `useAiChat.ts` (AI SDK `Chat`, client-side tools), `AiChatPanel.vue` (input, `/` menu), `AiChatMessage.vue` (rendering).

## Tools

All schemas live in `src/interfaces/aiTools.ts`, shared by client and server.

| Tool | Runs | Result in the UI |
|---|---|---|
| `extractLogs` | model only, no output | Log cards with Save / Discard, then Undo until the next message |
| `searchNotes` | browser (notes are in IndexedDB) | "Checked your notes" marker |
| `addNote` | browser: plain text → note HTML (`plainTextToNoteHtml`, then `sanitizeNoteHtml`) | Saved row with Undo |
| `addEvent` | browser: one-off custom event; repeats are refused and sent to the Events page | Saved row with Undo |

Browser tools have no `execute` on the server. The client answers them in `onToolCall` with `addToolOutput` (never awaited there, it can deadlock the job queue), and `sendAutomaticallyWhen` sends the result back so the model can confirm. A turn that only extracted logs never resubmits, because `extractLogs` gets no output.

Notes and events save straight away (Undo instead of a confirm step); logs keep the confirm card.

## Slash commands

`src/common/chatCommands.ts`: `/log`, `/note`, `/event`, `/ask`, `/catchup`. Typing `/` opens the menu (arrows, Enter/Tab to pick, Esc to hide).

- The message text keeps its `/note` prefix, so history shows what each message was; the user bubble renders it as a chip.
- The client also sends `command` in the request body. The server validates it against `SERVER_CHAT_COMMANDS`, narrows `activeTools` to that feature's tool and adds one rule to the prompt. Text replies stay allowed, which is how the model asks back for missing details.
- `/catchup` never reaches the model: it runs the existing Catch-up summary.
- The command applies only to the message it is on: the request body is rebuilt on every send.
