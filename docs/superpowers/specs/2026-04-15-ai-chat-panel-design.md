# AI Chat Panel — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

## Overview

Add an AI-powered chat panel to Daybook that lets users describe their work in natural language or paste/upload screenshots, then extracts and saves time logs automatically. The panel is always accessible from the Home view, pairs with a secure server-side settings infrastructure, and migrates existing Jira credentials off localStorage in the process.

---

## 1. Layout — Chat Panel Placement

`AiChatPanel.vue` is rendered as a `v-navigation-drawer` with `location="right"` inside `HomeView.vue`.

- **Large screens (`lgAndUp`):** Permanent 4th column alongside Calendar, BulkLogForm, and LogList. Always visible, does not overlay content.
- **Small screens (below `lg`):** Temporary overlay drawer. A toggle button (sparkle icon `mdi-creation`) added to the app bar opens/closes it. The button only renders when the current route is `/` (Home) — since the panel only exists in `HomeView.vue`, it has no meaning on other pages. The existing layout is not displaced.

Responsiveness is handled entirely by Vuetify's `v-navigation-drawer` + `useDisplay()`:

```vue
<v-navigation-drawer
  v-model="chatOpen"
  location="right"
  :temporary="!lgAndUp"
  width="360"
>
```

No custom CSS breakpoint hacks. The drawer manages its own open/close state; on large screens it ignores `v-model` and stays open.

---

## 2. Chat UX

### Message Flow

1. User types text or pastes/uploads an image into the input area.
2. Message appears as a right-aligned user bubble.
3. A loading indicator shows while the AI responds.
4. AI response appears as a left-aligned bubble containing:
   - A short natural-language summary ("Found 3 logs for today")
   - A compact read-only log card for each extracted log, showing: project, task, date, duration
   - A **"Save N logs"** button at the bottom of the bubble
   - A **"Discard"** button
5. User can send a follow-up message to correct the result ("DS-1234 was 1.5h not 2h"). The AI re-responds with an updated set of log cards, with changed fields visually highlighted.
6. Clicking **Save** writes all logs in that bubble directly to the current month's localStorage store (same as BulkLogForm). A toast confirms success.
7. **Only the most recent AI message with logs has an active Save button.** When a new AI response containing logs arrives, the Save button in all prior AI messages is disabled — those logs are now superseded. This prevents accidentally saving stale data from a corrected exchange.

### Input Area

- Multiline text field for natural language input.
- Attach button for file upload (images: PNG, JPG, WebP).
- Paste support: pasting an image directly into the input area attaches it as a file.
- Send on Enter (Shift+Enter for newline), or Send button.

### No History Persistence

Chat messages live in component state only. Closing the panel or reloading the page clears the conversation. This is intentional and expected.

---

## 3. AI Integration

### Serverless Function — `/api/chat`

A Vercel serverless function (Node.js runtime) receives the chat request and proxies it to Gemini.

**Request body:**
```json
{
  "messages": [...],
  "projects": ["DS-1234", "DS-5678"],
  "tasks": [
    { "project": "DS-1234", "title": "Development" },
    { "project": "DS-1234", "title": "Code Review" }
  ],
  "currentDate": "2026-04-15"
}
```

The request is authenticated via the Web Crypto signature scheme (see Section 4). The function looks up the caller's Gemini API key from Vercel KV, then calls `@google/generative-ai`.

**System prompt** (constructed server-side):

~~~
You are a time log assistant for a daily work tracking app.
Today's date is {currentDate}.

The user's known projects are: {projects list}
The user's known tasks per project are: {tasks list}

When the user describes work they did, extract one or more time log entries.
Match project names and task names to the known lists where possible.
If a project or task is not in the list, use whatever the user said.
Resolve relative dates ("yesterday", "this morning", "last Friday") using today's date.
Duration should be in minutes.

Always respond in this format — a short message followed by a JSON block:

<natural language summary>

```json
[
  { "project": "...", "task": "...", "date": "YYYY-MM-DD", "duration": 90, "description": "..." },
  ...
]
```

If you cannot find any logs in the message, respond naturally and ask for clarification.
~~~

The frontend parses the JSON block out of the AI response to render log cards. The natural language part renders as plain text above them.

**Library:** `@google/generative-ai` (Google's official SDK). Supports text and image inputs natively.

### Model Selection

Default model: `gemini-2.5-flash` (free tier, stable, multimodal). User can change via the Settings page. The model name is stored in Vercel KV alongside the API key.

---

## 4. Identity & Authentication — Web Crypto Key Pair

### Key Generation (first visit)

On first app load, if no key pair exists in IndexedDB:

1. Generate an ECDSA P-256 key pair via `window.crypto.subtle.generateKey`.
2. Private key: `extractable: false` — cannot be read by any JavaScript, ever.
3. Both keys stored in IndexedDB under the key `daybook-keypair`.
4. The public key exported as JWK, then SHA-256 hashed → this hash is the **user fingerprint** (analogous to machine ID but derived from the key pair).

### Request Signing

Every call to `/api/settings` or `/api/chat` includes:

- `X-Machine-Id` header: the public key fingerprint (hex string).
- `X-Public-Key` header: the full public key JWK (base64), sent once for registration or re-sent each time (server caches it in KV on first use).
- `X-Signature` header: ECDSA signature over `{machineId}:{timestamp}`.
- `X-Timestamp` header: current Unix timestamp (ms). Server rejects requests older than 60 seconds to prevent replay attacks.

### Server Verification

The serverless function:
1. Reads `X-Machine-Id`, `X-Public-Key`, `X-Signature`, `X-Timestamp`.
2. Checks timestamp freshness.
3. Imports the public key.
4. Verifies the signature. Rejects with 401 if invalid.
5. Uses the machine ID as the KV key to look up or write settings.

**Result:** An attacker who knows the machine ID (public key fingerprint) cannot forge requests without the private key, which is non-extractable from the browser's IndexedDB. Even with full DevTools access, the private key cannot be read.

### Key Loss

If a user clears site data, IndexedDB is wiped → private key is gone → they must re-enter credentials in Settings (treated as a new machine). This is the same event that clears all their local logs and data, so it is expected behavior.

---

## 5. Server-side Settings — Vercel KV

### Storage

Vercel KV (Upstash Redis, free tier: 256MB / 30k req/month) stores settings per machine:

```
Key:   settings:{machineId}
Value: {
  "geminiApiKey": "...",
  "geminiModel":  "gemini-2.0-flash",
  "jiraConfig": {
    "enabled": false,
    "email": "",
    "domain": "",
    "apiToken": "",
    "projectKey": "",
    "statuses": "To Do;In Progress;In Review;Done;QA",
    "defaultCategoryId": null
  }
}
```

### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/settings` | Returns settings for the authenticated machine |
| `PUT`  | `/api/settings` | Upserts settings for the authenticated machine |
| `POST` | `/api/chat`     | Proxies a chat message to Gemini |

All routes require valid Web Crypto signature (Section 4).

### Jira Migration

The Jira config currently stored in localStorage (`jiraConfig`) moves to Vercel KV. The `useSettingsStore` Pinia store is updated to:

- On app load: fetch settings from `/api/settings` and populate the store.
- On settings save: write to `/api/settings` instead of relying on `useStorage` reactivity.
- Existing localStorage `jiraConfig` is read once on first load as a migration fallback, then cleared.

All other settings (date format, first day of week, weekend days, theme, categories, etc.) remain in localStorage — they are not credentials and do not need server-side storage.

---

## 6. Settings Page Changes

### New "AI Assistant" section

Added as a third column card alongside Date & Calendar and Jira Integration.

Fields:
- **Enable AI Assistant** toggle
- **API Key** — masked text field (same style as Jira token), with link to Google AI Studio
- **Model** — combobox listing supported Gemini models (all have free tier):
  - `gemini-2.5-flash` (default — stable, multimodal, generous free tier)
  - `gemini-2.5-flash-lite` (lightest, cheapest)
  - `gemini-2.5-pro` (highest quality, slower)
  - `gemini-3.1-flash-lite-preview` (latest preview, free tier)
  - `gemini-3-flash-preview` (latest flash preview, free tier)
  - (user can type a custom model ID for future models)
- Security warning (same pattern as Jira): key is stored server-side, tied to this browser/device.

### Jira section

UI unchanged. Under the hood, load/save goes through `/api/settings` instead of localStorage reactive binding.

---

## 7. Composables & Component Structure

### Vuetify-first principle

Use Vuetify components wherever they reduce complexity. Custom components are only built when Vuetify has no equivalent. Specific mappings:

- Chat panel wrapper → `v-navigation-drawer`
- Message bubbles → `v-card` (with `rounded` and `color` props for user vs AI styling)
- Log cards inside AI message → `v-card` with `variant="outlined"`
- Save / Discard buttons → `v-btn`
- Loading indicator → `v-progress-circular` or `v-skeleton-loader`
- Text input → `v-textarea` (auto-grow)
- File attach → `v-btn` + `<input type="file" hidden>`
- Settings fields → `v-text-field`, `v-combobox`, `v-switch` (matching existing Settings page style)

All component filenames use PascalCase, matching the existing codebase convention.

### File layout

```
src/
  composables/
    useCrypto.ts          # Key pair generation, signing, fingerprint derivation
    useServerSettings.ts  # GET/PUT /api/settings, populates settingsStore
    useAiChat.ts          # Chat message state, POST /api/chat, log extraction
  components/
    AiChatPanel.vue       # v-navigation-drawer wrapper, input area, message list
    AiChatMessage.vue     # Single message bubble (user or AI variant)
    AiLogCard.vue         # Read-only log card rendered inside an AI message
  stores/
    settings.ts           # Extended: geminiConfig added, jiraConfig load/save updated

api/
  settings.ts             # GET + PUT /api/settings (Vercel serverless)
  chat.ts                 # POST /api/chat (Vercel serverless)
  _lib/
    auth.ts               # Web Crypto signature verification (shared)
    kv.ts                 # Vercel KV helpers
```

---

## 8. Out of Scope

- Chat history persistence (start fresh on reload — by design)
- Server-side storage of logs/projects/tasks (local-first approach kept)
- Multi-provider AI support beyond Gemini (model list is Gemini-only; provider abstraction deferred)
- Custom system prompt editing in Settings
- Clearing/resetting server-side settings from the UI (use Vercel KV dashboard directly)
