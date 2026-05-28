# Catch Up Widget — Design Spec

**Date:** 2026-05-28  
**Status:** Approved

## Overview

A non-intrusive bottom widget that surfaces an AI-generated summary of recent time logs when the user opens the app. Designed for the morning standup use case — "where I left off" — without expanding the app's core purpose as a time logger.

---

## 1. Trigger & Visibility

The widget mounts in `App.vue` so it is available on any route.

**Show conditions (all must be true):**
- `catchUpEnabled` setting is `true` (default)
- `catchUpDismissedDate` in localStorage ≠ today

**Dismiss:** clicking the close (×) button writes `catchUpDismissedDate = today` and hides the widget for the rest of the day.

**Re-trigger:** if the widget was dismissed because AI was not configured, it re-appears automatically the first time the user saves a Gemini API key. The dismissed date is cleared and the full flow runs again.

There is no time-of-day restriction and no additional settings to configure beyond the single on/off toggle.

---

## 2. Widget States & Loading Flow

The widget starts expanded on mount so the greeting is immediately visible. It then transitions based on config and data availability.

```
[mount — starts expanded]
   ↓
Always show greeting (min 1.5s, random from 5 phrases)
In background simultaneously:
   ├─ check geminiConfig
   │    └─ not configured → after greeting: silently dismiss (widget closes)
   └─ configured
        ├─ catchUpSummary-{today} cached → after greeting: show content
        └─ not cached → start AI call
             ├─ returns during greeting → after greeting: show content
             └─ greeting ends, still loading → show "preparing" (min 1s) → ready / error

[ready or error shown for 3 seconds]
   └─ auto-compact to slim strip (unless pinned)
```

**State table:**

| State | Behaviour |
|---|---|
| `greeting` | Random phrase: "Let's see where you left off...", "Morning! Checking your recent work...", etc. |
| `preparing` | "Gathering your logs..." with spinner |
| `ready` | Rendered markdown summary; auto-compacts after 3s |
| `error` | "Couldn't load summary" + Retry button; auto-compacts after 3s |

**Rules:**
- Greeting minimum: 1.5s — even if content is already cached or AI returns faster
- Preparing minimum: 1s — prevents a flash
- Preparing is skipped entirely if the AI returns before the greeting timer ends
- Cached content: greeting still shows (warm moment), then content fades in
- Not configured: widget greets then silently dismisses — no error message shown
- After ready/error: 3-second display, then auto-compact to the slim strip (unless pinned)

---

## 3. UI & Visual Design

### Container

- `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%)`
- Width: `480px`, not full-width — content is short and centered looks intentional
- Glass effect background: `backdrop-filter: blur(12px)` + semi-transparent surface, consistent with the app's existing glass design system

### Collapsed (compact) state — resting

A slim strip at the bottom. Resting state after content is shown or when mouse leaves.

- Header text: **"Catch up · {Day DD Mon}"** — last logged date the summary covers
- Left icon: `mdi-lightning-bolt` (primary colour)
- Right icon: `mdi-chevron-up` — hints the panel is interactive
- Height: ~20px (compact, unobtrusive)
- Box shadow: subtle upward shadow to visually lift it above other content

### Expanded state (on hover)

Mouse entering the widget expands it; mouse leaving collapses it back to the compact strip.

- **Expand transition:** spring cubic-bezier `(0.34, 1.56, 0.64, 1)` — bouncy, energetic feel
- **Collapse transition:** standard ease-out — calm
- Content area: scrollable if needed, max-height ~360px

### Expanded content layout

```
┌─────────────────────────────────────┐
│ {state content}                     │  ← greeting / preparing / summary / error
└─────────────────────────────────────┘
│ ⚡ Catch up · Mon 26 May  [📌] [×]  │  ← header row (always visible)
```

Header buttons (right side):
- **Pin** (`mdi-pin-outline` / `mdi-pin`): keeps the panel expanded when the mouse leaves. Turns off on close.
- **Chevron/Close** toggle: `mdi-chevron-up` when collapsed ↔ `mdi-close` when expanded — animated fade+scale transition between them. Clicking close dismisses for the day.

No 1-hour auto-dismiss timer. The widget stays as a compact strip until the user explicitly closes it.

---

## 4. AI Prompt & Data

### Data fetch logic (timestamp-based)

Storage key: `catchUpLastFetchedAt` — ISO timestamp of the last successful AI call.

```
if catchUpLastFetchedAt exists:
  fetch all TimeLogs with date >= date(catchUpLastFetchedAt)
else (first time / fallback):
  fetch TimeLogs from yesterday or the most recent date before today that has entries
  (scan backwards up to 14 days)
```

On successful AI response: update `catchUpLastFetchedAt` to now.

**Today's logs:** If there are entries for today, include them. The AI is instructed to place them in a final "Today" group — serving as a "what I'm already working on" section, the closest approximation to a standup "doing" item.

### Prompt

```
You are helping a developer review their recent work for a standup.
Here are their time log entries grouped by date:

{entries grouped by date: "YYYY-MM-DD (DayOfWeek)\n  project / task / Xh Ym — description"}

Summarize in 2-3 groups max. Short past-tense bullets, 1 line each, max 3 bullets per group.
Group by project or theme across dates.
If there are entries for today ({today_date}), put them in a final "Today" group (present tense).
No intro or outro. Return only markdown using: ## Group Name, then - bullet.
```

### Response rendering

- Parse markdown response with `marked` (add as new dependency)
- Sanitize parsed HTML with `DOMPurify` (add as new dependency) before binding to `v-html`
- Rendered inside the widget content area with scoped styles matching the app's typography

---

## 5. Settings & Persistence

### New setting

`catchUpEnabled: boolean = true` in `src/stores/settings.ts`

Rendered as a toggle in `SettingView.vue` near the existing AI Chat settings section. Label: "Catch Up Widget" with a short description: "Show a daily summary of recent logs when you open the app."

### Storage keys (add to `storageKeys.ts`)

| Key | Value | Purpose |
|---|---|---|
| `catchUpSummary-YYYY-MM-DD` | markdown string | Cached AI response for that date |
| `catchUpDismissedDate` | `YYYY-MM-DD` | Last date the widget was dismissed |
| `catchUpLastFetchedAt` | ISO timestamp | Timestamp of last successful AI call; determines data range for next fetch |

Cache expires naturally — `catchUpSummary-YYYY-MM-DD` keys from past dates are never read again (no explicit cleanup needed).

---

## 6. New Files & Modified Files

**New:**
- `src/components/CatchUpWidget.vue` — presentation component (peek bar + expandable panel + state rendering)
- `src/composables/useCatchUpSummary.ts` — all logic: trigger check, cache read/write, data fetch, AI call, state machine, timer

**Modified:**
- `src/stores/settings.ts` — add `catchUpEnabled`
- `src/common/storageKeys.ts` — add `catchUpSummary`, `catchUpDismissedDate`, `catchUpLastFetchedAt`
- `src/App.vue` — mount `<StandupWidget />`
- `src/views/SettingView.vue` — add `catchUpEnabled` toggle

**New dependencies:**
- `marked` — markdown → HTML parser
- `dompurify` — sanitize AI-generated HTML before rendering
