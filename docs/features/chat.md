# Chat

Chat turns plain messages into app data. Server: `api/chat.ts` (system prompt, tool schemas). Client: `useAiChat.ts` (AI SDK `Chat`, client-side tools), `ChatBar.vue` (the glass chat bar: composer, `/` menu, history, log saving), `AiChatMessage.vue` (rendering).

## Chat bar

`src/components/ChatBar.vue` is mounted in `App.vue`, so chat is available on every page (there is no Chat tab on Home).

- **States**: `hidden` (only the thin `chat-lip` button, aria-label "Open chat"), `bar` (the composer alone) and `open` (the conversation or history above the composer, up to 2/3 of the screen). On touch devices (`hover: none`) the rest state is `bar`, since there is no hover.
- **Reveal**: Ctrl+K, `/` pressed outside an input, hovering the bottom edge (150ms), or clicking the lip. Focusing the textarea also reveals it. After Esc or a click outside, hover reveals again only after the pointer has left and come back. An empty `bar` hides again on mouse leave; a bar holding a draft stays.
- **Animation**: island-style, like `NotificationIsland`: it pops in from a dot with one overshoot (the panel opens at the peak), and on close the panel folds into the pill, which then shrinks sideways and fades. `prefers-reduced-motion` skips it.
- **Commands**: picking one from the menu (Enter/Tab/click), or typing `/note ` with the trailing space, turns it into a chip (`.command-chip`) and clears the textarea. A whole `/note text` set at once (paste) does not become a chip, so no `command` is sent. Backspace at the start turns the chip back into text.
- **History**: `src/composables/useChatHistory.ts` keeps conversations in localStorage under `chatHistory` (`storageKeys.chat.history`), newest first, max 50 (`MAX_CONVERSATIONS`). Pasted images are stripped on save (a message with only an image becomes "(image)"), so stored conversations stay small. The pill title is the first user message without its command. History button (aria-label "History") shows `.history-pill`s; "New chat" starts a fresh conversation.
- **Keyboard** (composer empty, no chip or attachment): ↑ or ← opens history; ↑↓ select a conversation, Enter opens it, → goes back to the chat. Esc closes the bar (or the slash menu first). Enter sends, Shift+Enter is a new line.
- **Log saving** (Save / Discard on `extractLogs` cards, Undo) lives in `ChatBar.vue`.

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

`src/common/chatCommands.ts`: `/log`, `/note`, `/event`, `/ask`, `/catchup`. Typing `/` opens the menu (arrows, Enter/Tab to pick, Esc to hide); a picked command becomes a chip in front of the textarea.

- The message text keeps its `/note` prefix, so history shows what each message was; the user bubble renders it as a chip.
- The client also sends `command` in the request body. The server validates it against `SERVER_CHAT_COMMANDS`, narrows `activeTools` to that feature's tool and adds one rule to the prompt. Text replies stay allowed, which is how the model asks back for missing details.
- `/catchup` never reaches the model: it runs the existing Catch-up summary.
- The command applies only to the message it is on: the request body is rebuilt on every send.
