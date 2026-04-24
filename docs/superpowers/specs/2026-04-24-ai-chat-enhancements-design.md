# AI Chat Enhancements — Design Spec

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Three targeted improvements to the existing AI chat panel:

1. Hover action buttons on user messages (copy, retry on error)
2. Save → Undo state machine for AI log messages
3. Discarded chip indicator when logs are dismissed

---

## 1. User Message Hover Actions

### Behaviour

When hovering a user message bubble, a small row of icon buttons appears below/beside the card:

- **Copy** — always shown; copies `message.content` to clipboard via `navigator.clipboard.writeText`
- **Retry** — shown only when this is the last user message AND `error` is set; re-sends the same text

Retry is text-only — the original `File` reference is gone after send, so image re-attachment is not supported.

### Implementation

Wrap the user message `VCard` in a `v-hover` component. Use the `isHovering` slot prop to conditionally render an action row beneath the card:

```vue
<v-hover v-if="message.role === 'user'" v-slot="{ isHovering, props: hoverProps }">
  <div v-bind="hoverProps">
    <VCard ...>...</VCard>
    <div v-if="isHovering" class="d-flex justify-end ga-1 mt-1">
      <VBtn icon="mdi-content-copy" size="x-small" variant="text" @click="copyMessage" />
      <VBtn v-if="canRetry" icon="mdi-refresh" size="x-small" variant="text" @click="emit('retry')" />
    </div>
  </div>
</v-hover>
```

New props on `AiChatMessage.vue`:

- `canRetry: boolean` — passed from `AiChatPanel` as `isLastUserMessage && !!error`

New emits on `AiChatMessage.vue`:

- `retry` — bubbles up to `AiChatPanel`, which calls `sendMessage` with the message's text

`AiChatPanel` tracks the last user message ID to compute `canRetry` per message:

```ts
const lastUserMessageId = computed(() => [...messages.value].reverse().find((m) => m.role === 'user')?.id ?? null);
```

---

## 2. AI Log Message Save/Undo State Machine

### States

| State                                        | Button area shows      |
| -------------------------------------------- | ---------------------- |
| `pending` (saveable)                         | Save + Discard buttons |
| `saved` (undoable)                           | Undo button (active)   |
| `saved` (committed — new message sent after) | Undo button (disabled) |
| `discarded`                                  | "Discarded" chip       |

### ChatMessage interface change

Add `saveState` field:

```ts
interface ChatMessage {
  // ...existing fields...
  saveState?: 'pending' | 'saved' | 'discarded'; // assistant messages with logs only
}
```

### useAiChat changes

Add `savedLogsMessageId` ref — the ID of the one message whose save can still be undone:

```ts
const savedLogsMessageId = ref<string | null>(null);
```

New exported functions:

- `markSaved(id)` — sets `message.saveState = 'saved'`, sets `savedLogsMessageId`
- `markUndone()` — sets `message.saveState = 'pending'`, clears `savedLogsMessageId`
- `markDiscarded(id)` — sets `message.saveState = 'discarded'`

In `sendMessage`, before pushing the user message: if `savedLogsMessageId` is set, clear it (freezes that message's Undo — it stays `saved` but is no longer undoable).

Expose `savedLogsMessageId` from the composable.

### AiChatMessage props/emits

New props:

- `isUndoable: boolean` — `message.saveState === 'saved' && message.id === savedLogsMessageId`

New emits:

- `discard: []`
- `undo: [logs: ExtractedLog[]]`

`AiChatPanel` handles these and calls the composable functions + emits `undoLogs` to `HomeView`.

### Discard chip

When `saveState === 'discarded'`, replace the button row with:

```vue
<VChip size="small" prepend-icon="mdi-close-circle-outline" variant="tonal">Discarded</VChip>
```

---

## 3. Undo — Removing Saved Logs

`AiChatPanel` emits a new `undoLogs` event (in addition to the existing `saveLogs`):

```ts
const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]];
  undoLogs: [logs: ExtractedLog[]];
}>();
```

`HomeView` handles `undoLogs` by removing the matching logs from the store. The exact removal logic depends on the store's log structure (match by project + task + date + duration).

---

## 4. Out of Scope

- Copy button on AI messages (text-only responses)
- Editing a message before retry
- Persisting save/discard state across page reloads
