# Project Context for Claude

## Project Overview
**daybook** - A Vue.js application for daily task logging to track what you've accomplished. It offers two approaches:
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
- **Jira Integration**: Ticket sync with daily auto-cache (3-layer architecture: Vercel API for CORS bypass → jiraApi.ts for HTTP client → useJiraApi.ts for business logic)
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
- **PascalCase** for component files and component names in templates
- camelCase for composables and utilities

### Comments Guidelines
- **Add comments for each block of code when necessary** to explain functionality
- **Template sections should have comments** for each layout block to identify structure faster
- Keep comments concise and focused on explaining the "why" not the "what"
- Use block comments for major sections, inline comments for complex logic

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

# Important Instruction Reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
**Update documentation or README files only when needed** - create or modify documentation when explicitly requested or when significant architectural changes require documentation updates.