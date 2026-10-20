# Project Context for Claude

## Project Overview
**daybook** - A Vue.js application for daily task logging to track what you've accomplished. It offers two approaches:
1. Vue app interface for inputting logs
2. Excel template integration for bulk work logging

## Tech Stack
- **Frontend**: Vue 3 + TypeScript + Composition API
- **UI Framework**: Vuetify 3 (Material Design) with dark theme support
- **Build Tool**: Vite (code splitting configured in vite.config.ts)
- **Package Manager**: **Yarn** (always use yarn over npm)
- **State Management**: Pinia
- **Testing**: Playwright (E2E)
- **Deployment**: Vercel (free tier, client-only app)

## Key Dependencies
- **Vue Ecosystem**: vue, vue-router, pinia
- **UI/UX**: vuetify, @vueuse/core, v-calendar, vue-sonner, @formkit/drag-and-drop (notes drag, mouse + touch)
- **Notes editor**: @tiptap (core pinned to starter-kit's exact version, starter-kit, extension-list, extension-image, extension-file-handler)
- **Charts**: chart.js, chartjs-plugin-datalabels, chartjs-plugin-annotation (target line)
- **Data Processing**: papaparse, file-saver, dayjs, lodash, rrule
- **Forms**: vee-validate, yup
- **HTTP**: axios

## Development Commands
```bash
yarn dev              # Start dev server
yarn build            # Production build
yarn type-check       # TypeScript checking
yarn lint             # ESLint with auto-fix
yarn test:e2e         # Run Playwright E2E tests
```

## Environment Setup
Required `.env` variables:
```env
VITE_XERO_USERNAME=    # Xero login email
VITE_XERO_PASSWORD=    # Xero password
VITE_XERO_CONTACT_NAME= # Contact name in Xero
VITE_XERO_TEMPLATE_PATH= # Download folder for Excel templates
```

## Key Features
- **Time Logging**: Individual and bulk time entry; log form has recent Project+Task quick picks and a Remaining chip (see `docs/features/daily-target.md`)
- **Daily Target**: Configurable workday hours (or no limit) — single source `useDailyTarget()`, never hardcode 8h (see `docs/features/daily-target.md`)
- **Xero Integration**: Automated work logging via Playwright
- **Jira Integration**: Ticket sync with daily auto-cache (Vercel API → jiraApi.ts → useJiraApi.ts)
- **Calendar View**: Visual time tracking overview
- **Data Export**: CSV export functionality
- **Charts**: Visual time tracking with Chart.js
- **Navigation**: Desktop (mdAndUp) has no top bar — a floating glass nav rail on the left (`App.vue`: brand, Home/Notes/Tasks/Events, theme toggle, Settings, account); small screens keep a compact top bar with a hamburger menu
- **Home layout**: form | one glass card holding the month chart (header with stats + Insights toggle) and the Logs toolbar/list | collapsible Insights column (see `docs/features/log-list-filters.md`)
- **Dark Theme**: Toggle in the nav rail (hamburger menu on small screens), persisted to localStorage
- **Categories**: Optional project grouping (see `docs/features/categories.md`)
- **Sticky Notes**: Card-based rich-text notes page (`/notes`) with pin (pinned-first), colors, search, drag reorder / drag-to-trash (mouse + touch), pasted images (Blobs in a separate `daybook-images` IndexedDB, corner-drag resize, click to zoom); the chat bar (`ChatBar.vue`, on every page, Ctrl+K) reads notes via the client-side `searchNotes` tool and Catch-up includes open note items (see `docs/features/notes.md`)
- **Chat Bar**: Glass chat bar docked on every page (line of light / bar / open; Ctrl+K, `/` or bottom-edge hover reveals), also the notification surface (toast from the line, pill above the open chat, list in the panel; `NotificationIsland` is gone); history in localStorage (see `docs/features/chat.md`)
- **Events**: Calendar markers (no notifications), optionally repeating via a friendly typed `RepeatRule` (rrule under the hood) with skippable dates, incl. a holiday-aware "last work day of the month"; the Events page pairs a calendar (with a picked-day/today card under it) with the list, selection linked both ways (see `docs/features/events.md`)

## Feature Documentation
Detailed docs for non-trivial features live in `docs/features/`. Read the relevant file before modifying a feature.
- `docs/features/categories.md` — Category grouping for projects, VCombobox grouping pattern, BulkLogForm category rules
- `docs/features/log-list-filters.md` — Home chart + logs card layout, LogList toolbar and filters (project/task/date/search), Insights toggle + width transition, Insights↔chart project sync, panel-expansion coordination
- `docs/features/notes.md` — Note data model + IndexedDB versioning, images (storage, compression, zoom, sweep), HTML sanitization rules, native drag & drop (reorder/trash) design, undo mechanism
- `docs/features/daily-target.md` — Daily target setting + `useDailyTarget()` consumers, Remaining chip rules, quick picks
- `docs/features/chat.md` — Chat tools (extractLogs, searchNotes, addNote, addEvent; which run in the browser), slash commands and how they narrow the model's tools
- `docs/features/events.md` — Event/RepeatRule data model (no migration), `eventRecurrence.ts` date logic, work-day rules (`WorkCalendar`), repeat form rules, Events page calendar selection, skip dates, timezone/UTC-midnight and day-of-month gotchas

## Branches, Deploys & Test Resources
Every pushed branch gets a Vercel preview build, and the Neon integration creates a Neon branch plus branch-scoped env vars for each preview (the free tier runs out fast).
- **One dev branch**: put all in-progress Claude work on a single `claude/dev` branch (reset from `master` when starting new work); don't push a new branch per fix
- **No previews for Claude branches**: `vercel.json` turns off deploys for `claude/*`; keep it that way
- **Push sparingly**: batch fixes, push only when there is something to review or merge
- **Test resources**: any Neon branch, DB connection or env key made for testing is prefixed `claude-test-`, kept minimal, and removed when done
- **Never touch prod** data, env vars or deployments; ask Nhan before deleting any Vercel/Neon resource or remote branch

## Important Notes
- **Type Safety**: Full TypeScript coverage required
- **Windows Focus**: PowerShell scripts preferred for automation
- **ESLint Compliance**: Fix all ESLint errors before completing tasks
- **Library Utilization**: Prioritize existing libraries over custom implementations
- **Clean Up**: Remove unused imports and variables after modifications

## Code Conventions
- Vue 3 Composition API with `<script setup>`
- TypeScript interfaces in `/interfaces`
- Composables for shared logic in `/composables`
- **PascalCase** for component files, camelCase for composables/utilities
- ESLint + Prettier for code quality

### Theming & Colors
- **Use semantic colors**: `primary`, `secondary`, `accent` instead of hardcoded colors like `green-darken-3`
- **Theme config**: Light/dark themes defined in `src/main.ts`
- **Theme toggle**: `useTheme()` from Vuetify + `useStorage()` for persistence in `App.vue` (button in the nav rail)
- **v-calendar**: Uses `is-dark` prop + custom CSS variables (`.vc-primary`) to sync with Vuetify theme
- **Chart.js**: Uses `useTheme()` + computed colors for grid, ticks, and legend

### Reactive State & Watchers
- **Single Source of Truth**: Avoid multiple watchers competing over the same state
- **Prefer `computed` over `watch + ref`**: Use computed properties with getter/setter for prop synchronization
- **Use `defineModel()`**: Leverage Vue 3.4+ `defineModel()` for two-way binding
- **Controlled vs Uncontrolled**: Decide state ownership upfront - parent-controlled (props + events) or self-managed (internal state)

### Comments Guidelines
- Add comments for code blocks when necessary to explain functionality
- Template sections should have comments for layout blocks
- Focus on explaining the "why" not the "what"
- Avoid polluting code with unnecessary comments
