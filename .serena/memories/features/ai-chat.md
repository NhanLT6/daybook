# AI Chat Feature

## Files
- `src/components/AiChatPanel.vue` — outer panel: message list, input area, drag/drop, error display
- `src/components/AiChatMessage.vue` — single message bubble (user or assistant variant)
- `src/components/AiLogCard.vue` — read-only log card rendered inside AI messages
- `src/composables/useAiChat.ts` — all chat state: messages, loading, error, sendMessage, clearMessages
- `src/interfaces/AiChat.ts` — `ChatMessage` and `ExtractedLog` interfaces

## ChatMessage interface
```ts
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageBase64?: string       // data URL for display (user messages)
  extractedLogs?: ExtractedLog[]  // parsed from AI response (assistant only)
  timestamp: number
}
```

## ExtractedLog interface
```ts
interface ExtractedLog {
  project: string
  task: string
  date: string       // 'YYYY-MM-DD'
  duration: number   // minutes
  description?: string
}
```

## useAiChat composable (key state)
- `messages` — ref<ChatMessage[]>
- `isLoading` — ref<boolean>
- `error` — ref<string | null>
- `latestLogsMessageId` — ref<string | null>: ID of last AI message with logs (only that one is saveable)
- `sendMessage(text, file, projects, tasks)` — sends to /api/chat, parses logs from JSON block in response
- `clearMessages()` — resets all state

## AiChatPanel → AiChatMessage communication
- `:is-saveable="msg.id === latestLogsMessageId"` prop
- `@save-logs="handleSaveLogs"` → emits up to HomeView as `saveLogs`

## Current gaps / known issues
- Discard button has NO @click handler — currently a visual placeholder that does nothing
- No hover actions on user messages (copy, retry)
- No save/undo state machine for log messages

## AI backend
- Vercel serverless function at `/api/chat`
- Uses Google Gemini via `@google/generative-ai`
- Auth via Web Crypto ECDSA key pair (see features/auth-crypto)
- AI response format: natural language text + ```json [...] ``` block
- `parseLogsFromText()` and `stripJsonBlock()` are exported pure helpers in useAiChat.ts

## Design spec
Full original design: `docs/superpowers/specs/2026-04-15-ai-chat-panel-design.md`
