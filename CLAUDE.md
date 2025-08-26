# Project Context for Claude

## Project Overview
**auto-xero** - A Vue.js application that provides a friendly way to log work in Xero. It offers two approaches:
1. Vue app interface for inputting logs
2. Excel template integration for bulk work logging

## Tech Stack
- **Frontend**: Vue 3 + TypeScript + Composition API
- **UI Framework**: Vuetify 3 (Material Design)
- **Build Tool**: Vite
- **Package Manager**: **Yarn** (prioritized)
- **State Management**: Pinia
- **Testing**: Playwright (E2E)
- **Deployment**: Vercel (free tier - optimized)

## Key Dependencies
- **Vue Ecosystem**: vue, vue-router, pinia
- **UI/UX**: vuetify, @vueuse/core, v-calendar, vue-sonner
- **Charts**: chart.js, chartjs-plugin-datalabels, patternomaly
- **Data Processing**: papaparse, file-saver, dayjs, lodash
- **Forms**: vee-validate, yup
- **HTTP**: axios

## Project Structure
```
/src
  /components         # Reusable Vue components
    - BulkLogForm.vue # Bulk time logging
    - LogForm.vue     # Individual log entry
    - LogList.vue     # Display logged entries
    - Calendar*.vue   # Calendar-related components
  /views             # Page components
    - HomeView.vue   # Main dashboard
    - SettingView.vue # Configuration
    - TaskView.vue   # Task management
  /apis             # API integrations
  /common           # Shared utilities
  /composables      # Vue composables
  /interfaces       # TypeScript interfaces
  /stores           # Pinia state stores
/e2e              # Playwright E2E tests
/powershell-scripts # Windows automation scripts
/templates        # CSV templates for Xero
```

## Development Commands (Yarn Priority)
```bash
# Development
yarn dev              # Start dev server
yarn build            # Production build
yarn preview          # Preview build locally

# Quality Assurance
yarn type-check       # TypeScript checking
yarn lint             # ESLint with auto-fix
yarn format           # Prettier formatting

# Testing
yarn test:e2e         # Run Playwright E2E tests
```

## Vercel Optimization Features
- **Code Splitting**: Configured in vite.config.ts with manual chunks:
  - `vue-vendor`: Core Vue ecosystem
  - `vuetify`: UI framework
  - `chart`: Chart.js libraries
  - `utils`: Utility libraries
  - `forms`: Form validation
  - `data`: File processing
  - `calendar`: Calendar components
- **Modern Compiler**: Uses Sass modern compiler API
- **Tree Shaking**: Enabled via ES modules

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
- **Calendar View**: Visual time tracking overview
- **Data Export**: CSV export functionality
- **Charts**: Visual time tracking with Chart.js
- **Task Management**: Project and task organization
- **File Processing**: CSV template handling

## Important Notes
- **Package Manager**: Always use `yarn` over `npm`
- **Type Safety**: Full TypeScript coverage required
- **E2E Testing**: Playwright tests for Xero integration
- **Windows Focus**: PowerShell scripts for Windows automation
- **File Handling**: Local file system integration for templates
- **Performance**: Optimized for Vercel free tier limits
- **State**: Pinia for centralized state management
- **Styling**: Vuetify + custom CSS, SCSS support enabled

## Code Conventions
- Vue 3 Composition API with `<script setup>`
- TypeScript interfaces in `/interfaces`
- Composables for shared logic
- Vuetify design system
- ESLint + Prettier for code quality
- Kebab-case for component files
- camelCase for composables and utilities

## Deployment Considerations (Vercel Free Tier)
- Build output optimized with chunk splitting
- Environment variables configured in Vercel dashboard
- Static file serving from `/public`
- Client-side routing with Vue Router
- No server-side dependencies (client-only app)

## Development Best Practices
- **Code Optimization**: Always optimize new code for performance and maintainability
- **Clean Up**: Clean up code after modifications (remove unused imports, variables, etc.)
- **ESLint Compliance**: Fix all ESLint errors before completing tasks
- **Library Utilization**: Prioritize existing libraries over custom implementations
- **Command Execution**: 
  - Prefer PowerShell scripts over bash commands (Windows development environment)
  - Always explain why a command is needed and what it will accomplish
  - Apply explanations when asking for user permission to run commands