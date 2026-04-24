# Component & Composable Overview

## Views
- `src/views/HomeView.vue` — main view: BulkLogForm + AiChatPanel tabs, handles saveLogs event
- `src/views/EventView.vue` — events list page

## Key Components
- `src/components/AiChatPanel.vue` — AI chat panel (see features/ai-chat)
- `src/components/AiChatMessage.vue` — chat message bubble
- `src/components/AiLogCard.vue` — log card inside AI messages

## Composables
- `src/composables/useAiChat.ts` — AI chat state and API calls
- `src/composables/useCrypto.ts` — ECDSA key pair, request signing (buildAuthHeaders)

## Stores (Pinia)
- `src/stores/settings.ts` — app settings incl. geminiConfig, jiraConfig

## Interfaces
- `src/interfaces/AiChat.ts` — ChatMessage, ExtractedLog
- `src/interfaces/Task.ts` — Task
- `src/interfaces/Project.ts` — Project

## API Routes (Vercel serverless, /api/)
- `/api/chat` — proxies to Gemini
- `/api/settings` — GET/PUT user settings from Vercel KV

## Docs
- `docs/superpowers/specs/` — approved design specs
- `docs/superpowers/plans/` — implementation plans
- `docs/features/` — feature-level docs (categories, etc.)
