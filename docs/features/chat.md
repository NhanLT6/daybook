# Chat

Chat turns plain messages into app data. Server: `api/chat.ts` (system prompt, tool schemas). Client: `useAiChat.ts` (AI SDK `Chat`, client-side tools), `ChatBar.vue` (the chat bar and the app's notification surface: composer, `/` menu, history, log saving, toast), `AiChatMessage.vue` (rendering).

## Chat bar

`src/components/ChatBar.vue` is mounted in `App.vue`, so chat is available on every page (there is no Chat tab on Home).

- **States**: `hidden` (with a mouse: the **peek**, below), `bar` (the composer alone) and `open` (the conversation or history above the composer, up to 2/3 of the screen). On touch devices (`hover: none`) the rest state is `bar`, since there is no hover. What is drawn is a separate `shape` (`peek`, `toast`, `bar`, `open`), so a closing panel keeps its contents while it folds.
- **Peek** (`.chat-peek`, aria-label "Open chat", the click target): the bar's own box (560×56) sunk below the screen edge so only its top 10px (`--peek-h`) shows, inside the 12px bottom gutter: just the edge and its rim (full strength in light, .7 in dark), no text (Nhan: an edge saying the input is there is enough; the old line of light read as a hint, a row for it and tabs in the form were turned down). The composer stays underneath, invisible, so rising is a plain slide.
- **Overlay, no room made**: the chat overlays the pages; nothing shrinks for it on desktop (Nhan: shrinking the cards made the layout look misaligned). Only touch screens keep the 88px `.chat-bar-spacer` for the resting bar.
- **Reveal**: Ctrl+K, `/` pressed outside an input, clicking the peek (at once), or hovering it: the peek lifts 4px and its rim lights at once (`peekLit`, `is-lit`), and it rises after a 320ms dwell, so sweeping the mouse along the bottom doesn't pop it. Focusing the textarea also reveals it. After Esc or a click outside, hover reveals again only after the pointer has left and come back. An empty `bar` sinks back on mouse leave; a bar holding a draft stays. The risen chat keeps an invisible hover bridge (`.chat::after`) down to the screen edge, and the rise from the peek isn't clipped, so a pointer resting where the peek was doesn't count as leaving (it would bob up and down).
- **Surface**: solid, no glass or backdrop blur (Nhan: the coloured rim already sets it apart; the grey glass blended into the grey background and the peek didn't catch the eye). Light is white (`--chat-veil: #fff`, AI bubbles tinted `rgba(20,28,38,.05)`); dark is `#363636`, a step lighter than the `#2d2d2d` cards so it reads as a higher layer where shadows barely show (AI bubbles `rgba(255,255,255,.07)`, the `/` menu `#404040` one step above that).
- **Placement**: the peek, chat, toast and pill centre on the content area, right of the 80px nav rail + 12px margin on md and up (`has-rail`, `--content-x`), with a 12px right margin.
- **Shortcut tip**: until the bar has been opened once with `/` or Ctrl+K (`chatShortcutLearned` in localStorage), a hover-revealed bar shows "Tip: press / or Ctrl+K…" above the composer. An empty chat shows the same hint as its bubble (desktop only). AI not set up still surfaces as the server's error bubble with a Settings link.
- **The light** ("pha màu"): near-black `rgba(16,18,22,.8)` in light and white `rgba(255,255,255,.85)` in dark (`--light-mono`, follows the Vuetify theme) running through `#6f9bff`, `#ff7eb6` and `#ffad66`; the glow (`--halo-grad`) runs `#6f9bff #a98bff #ff7eb6 #ffad66 #6fdcc0`. The chat wears it as a 2px turning rim (dim .45 and paused on the resting peek, full and turning while lit) (`.chat-rim`: conic gradient, mask-composite exclude, `--a` registered with `@property` and turned over 9s) and a blurred `.chat-halo` sibling under it (a sibling so the chat's solid surface doesn't cover it; `syncFrame` keeps it on the chat's box every frame while it morphs). The rim's stops are a separate `--rim-stops` because the angle turns on the rim itself.
- **Animation** (`morphTo`): the chat element morphs width/height/radius/bottom between peek, toast, bar and panel with `cubic-bezier(.32,.72,0,1)`, no overshoot, 420ms (bar ⇄ panel runs on the CSS width and body-height transitions, same curve; sinking into the peek eases with `cubic-bezier(.5,0,.2,1)`). Contents that appear zoom in from scale .92 + blur(5px). Rising out of the peek, the rim stays at 1 for the first half, then settles to .75; the halo only flashes during the morph (.5 → 0) so the open chat stays neutral; only the rim carries colour (Nhan: calm glass vibe). Sinking back flashes the light the other way, then the rim drops to the peek's level. Morphs into or out of the peek don't clip the chat (no `overflow: hidden`, neither in the peek CSS nor from `freeze`), so the hover bridge stays under a resting pointer; otherwise Esc or a click outside with the pointer on the edge counts as leaving, resets the hover suppression and the chat bobs back up. Interrupting a morph carries on from the current box. `prefers-reduced-motion` skips all of it.
- **Notifications** (`notificationCenter` store, `useChatNotices`, `ChatNotice.vue`): every new item is announced once, highest priority first. Chat hidden: the peek morphs into a ~400×46 toast and the light (rim, halo) takes the kind's colour (`noticeColor`). Chat in use: a glass pill rises 10px above it instead; it never goes into the chat history. A notice without actions steps down after 3.2s; one with actions stays until it's acted on or dismissed. Crossing between hidden and shown drops passive notices and moves actionable ones across (toast ⇄ pill). Clicking the toast or pill opens the panel with the list expanded; clicking elsewhere drops a confirm toast. The open panel starts with an "N notifications today" row (`.notif-row`, the store's `isExpanded`) that expands the current items, each with its description, time, actions (with loading state) and quick dismiss (not on confirms). Action buttons are `.notice-action`.
- **Commands**: picking one from the menu (Enter/Tab/click), or typing `/note ` with the trailing space, turns it into a chip (`.command-chip`) and clears the textarea. A whole `/note text` set at once (paste) does not become a chip, so no `command` is sent. Backspace at the start turns the chip back into text.
- **History**: `src/composables/useChatHistory.ts` keeps conversations in localStorage under `chatHistory` (`storageKeys.chat.history`), newest first, max 50 (`MAX_CONVERSATIONS`). Pasted images are stripped on save (a message with only an image becomes "(image)"), so stored conversations stay small. The pill title is the first user message without its command. History button (aria-label "History") shows `.history-pill`s; "New chat" starts a fresh conversation.
- **Keyboard** (composer empty, no chip or attachment): ↑ or ← opens history; ↑↓ select a conversation, Enter opens it, → goes back to the chat. Esc closes the bar (or the slash menu first). Enter sends, Shift+Enter is a new line.
- **Log saving** (Save / Discard on `extractLogs` cards, Undo) lives in `ChatBar.vue`.

## Tools

All schemas live in `src/interfaces/aiTools.ts`, shared by client and server.

| Tool | Runs | Result in the UI |
|---|---|---|
| `extractLogs` | model only; output filled in per request (below) | Log cards with Save / Discard, then Undo until the next message |
| `searchNotes` | browser (notes are in IndexedDB) | "Checked your notes" marker |
| `addNote` | browser: plain text → note HTML (`plainTextToNoteHtml`, then `sanitizeNoteHtml`) | Saved row with Undo |
| `addEvent` | browser: one-off custom event; repeats are refused and sent to the Events page | Saved row with Undo |

Browser tools have no `execute` on the server. The client answers them in `onToolCall` with `addToolOutput` (never awaited there, it can deadlock the job queue), and `sendAutomaticallyWhen` sends the result back so the model can confirm. A turn that only extracted logs never resubmits, because `extractLogs` gets no output in the chat (the card reads its `input-available` part).

The model API rejects a history holding a tool call with no result (`AI_MissingToolResultsError`), so the transport's `prepareSendMessagesRequest` sends a copy where each pending `extractLogs` call is answered with what the user did with its card (`saved`, `discarded`, `not saved yet`; `withExtractLogsResults`). That is also how a correction like "the date is wrong" reaches the model with context.

## Dates

The client sends the local date (`dayjs`, not `toISOString()`, which is UTC). The server's `dateContext()` (`api/_lib/dateContext.ts`) spells out today's weekday and the dates of this week and last week, Monday-first, because models get the weekday of a bare date wrong ("monday this week" became next Monday).

Notes and events save straight away (Undo instead of a confirm step); logs keep the confirm card.

## Slash commands

`src/common/chatCommands.ts`: `/log`, `/note`, `/event`, `/ask`, `/catchup`. Typing `/` opens the menu (arrows, Enter/Tab to pick, Esc to hide); a picked command becomes a chip in front of the textarea.

- The message text keeps its `/note` prefix, so history shows what each message was; the user bubble renders it as a chip.
- The client also sends `command` in the request body. The server validates it against `SERVER_CHAT_COMMANDS`, narrows `activeTools` to that feature's tool and adds one rule to the prompt. Text replies stay allowed, which is how the model asks back for missing details.
- `/catchup` never reaches the model: it runs the existing Catch-up summary.
- The command applies only to the message it is on: the request body is rebuilt on every send.
