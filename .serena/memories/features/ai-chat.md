# AI Chat Feature

## Files
- `src/components/AiChatPanel.vue` — outer panel: message list, input area, drag/drop, floating "Catch up" button, error display
- `src/components/AiChatMessage.vue` — single message bubble; renders by `metadata.tool` discriminator (text / `extractLogs` cards / `catchUp` list)
- `src/components/AiLogCard.vue` — read-only log card rendered inside AI messages (shows `duration` min, or `Plan` when duration is absent)
- `src/composables/useAiChat.ts` — all chat state + the pure `extractLogsFromMessage()` reader
- `src/interfaces/AiChat.ts` — `DaybookMessageMetadata`, `DaybookUITools`, `DaybookUIMessage`; re-exports `ExtractedLog`
- `src/interfaces/aiTools.ts` — **single source of truth** for the `extractLogs` tool contract (zod schema), imported by BOTH client and `api/chat.ts`
- `api/chat.ts` — Vercel serverless chat endpoint (streamText + extractLogs / searchNotes tools)

## Architecture (Vercel AI SDK v6)
- Client uses the `Chat` class from `@ai-sdk/vue` with `DefaultChatTransport` (auth headers via `buildAuthHeaders`).
- `DaybookUIMessage = UIMessage<DaybookMessageMetadata, UIDataTypes, DaybookUITools>` — the tools generic types `tool-extractLogs` parts so `part.input` is `ExtractLogsInput`.
- Server streams via `result.pipeUIMessageStreamToResponse(res)`.

## The `extractLogs` tool contract (single source)
`src/interfaces/aiTools.ts` (zod-only, dependency-light so it bundles into the serverless fn):
```ts
export const extractLogsInputSchema = z.object({ logs: z.array(extractedLogSchema) });
export type ExtractedLog = z.infer<typeof extractedLogSchema>;   // duration is OPTIONAL → plan entries
```
- Client imports it via `@/interfaces/aiTools`; `api/chat.ts` imports it via relative `../src/interfaces/aiTools.js` (validated under api/tsconfig).

## CRITICAL gotcha — static tool parts, not `dynamic-tool`
A statically-registered tool (`tools: { extractLogs }`) streams as a `tool-extractLogs` message part, NOT `dynamic-tool` (that type is only for `dynamicTool()`). Detect it with `isToolUIPart(p) && getToolName(p) === 'extractLogs'` — never `p.type === 'dynamic-tool'`. This exact mismatch once broke all custom-UI rendering.
- The reader lives in ONE place: `extractLogsFromMessage(message)` in `useAiChat.ts` (unit-tested in `__tests__/useAiChat.test.ts`).

## useAiChat composable (key state)
- `messages` — computed; extractLogs metadata is **derived from message parts** (not duplicated). Only `saveState` + client-injected `catchUp` live in the side `metadataMap`.
- `isLoading`, `error`, `latestLogsMessageId` (only that message is saveable), `savedLogsMessageId` (undo window)
- `sendMessage(text, file, projects, tasks)`, `markSaved/markUndone/markDiscarded`, `injectCatchUp`, `clearMessages`
- `onFinish` only records `latestLogsMessageId`; it does not copy logs into metadata.

## Message metadata (`DaybookMessageMetadata`)
`tool?: 'extractLogs' | 'catchUp'`, `extractedLogs?`, `saveState?: 'saved' | 'discarded'`, `catchUpItems?`. (No `timestamp` — removed as unused.)

## catchUp (manual only)
- The chat's floating "Catch up" button calls `fetchCatchUpItems()` (`useCatchUpSummary.ts`) and `injectCatchUp` adds a client-injected assistant message with `tool: 'catchUp'` + bullet-list text (kept for AI follow-up context; hidden in the UI).
- There is no automatic catch-up notification any more (removed): nothing runs at startup or on tab focus. Results are cached in localStorage keyed by a stamp of logs + open note items.

## AI backend (`api/chat.ts`)
- `streamText({ model: requireAiModel(aiConfig), tools: { extractLogs }, ... })`; `extractLogs` uses `inputSchema: extractLogsInputSchema`.
- Model selection lives in `api/_lib/ai.ts` (`resolveAi(aiConfig)`): default is the **Vercel AI Gateway** (`AI_GATEWAY_MODEL` or `google/gemini-2.5-flash`, always with `disallowPromptTraining` + `zeroDataRetention` routing options); a user who switches on "Use my own key" in Settings (`aiConfig.enabled` + `apiKey`) runs on their own Gemini key instead. Setup and env vars: `docs/vercel-ai-setup-checklist.md`.
- `api/chat.ts` / `api/standup.ts` spread `resolveAi(...)` into `streamText` / `generateText` and map failures with `aiErrorMessage` (quota used up, rate limit, no provider meets privacy options).
- Auth: Neon Auth bearer token (`requireUser`).
- **Backend changes require a Vercel redeploy** to take effect.

## Design spec
Original panel spec: `docs/superpowers/specs/2026-04-15-ai-chat-panel-design.md`. Tool-system rework: `docs/superpowers/plans/2026-06-15-unified-chat-tool-system.md`.
