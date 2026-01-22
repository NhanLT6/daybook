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
- **UI/UX**: vuetify, @vueuse/core, v-calendar, vue-sonner
- **Charts**: chart.js, chartjs-plugin-datalabels, patternomaly
- **Data Processing**: papaparse, file-saver, dayjs, lodash
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
- **Time Logging**: Individual and bulk time entry
- **Xero Integration**: Automated work logging via Playwright
- **Jira Integration**: Ticket sync with daily auto-cache (Vercel API → jiraApi.ts → useJiraApi.ts)
- **Calendar View**: Visual time tracking overview
- **Data Export**: CSV export functionality
- **Charts**: Visual time tracking with Chart.js
- **Dark Theme**: Toggle in app toolbar, persisted to localStorage

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
- **Theme toggle**: `useTheme()` from Vuetify + `useStorage()` for persistence in `App.vue`
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
