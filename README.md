# Daybook

A Vue.js application for daily task logging to track what you've accomplished. Keep a record of your daily work, projects, and tasks with an intuitive interface and powerful export capabilities.

## Features

- 📝 **Daily Task Logging**: Log tasks with project, duration, and description
- 📊 **Visual Analytics**: Charts and calendar views to visualize your productivity
- 📁 **Bulk Import/Export**: Import tasks from CSV or export your logs for external use
- 🎯 **Task Management**: Organize work by projects and categories
- 📅 **Calendar Integration**: Visual timeline of your logged activities
- 💾 **Local Storage**: All data stored locally in your browser

## Quick Start

### Try the Live App

🚀 **No installation required!** Try Daybook instantly at:  
**[https://xero-logger.vercel.app/](https://xero-logger.vercel.app/)**

The deployed version includes all features and your data is stored locally in your browser.

### Local Development Setup

If you want to run the application locally or contribute to development:

#### Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js (LTS version)**  
   Download from [nodejs.org](https://nodejs.org/en/download/)
   ```bash
   node --version
   npm --version
   ```

2. **Yarn (recommended)**  
   ```bash
   npm install --global yarn
   yarn --version
   ```

#### Installation & Local Development

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd daybook
   yarn install
   ```

2. **Start development server**:
   ```bash
   yarn dev
   ```

3. **Open in browser**:
   Navigate to `http://localhost:5173` (or the port shown in terminal)

#### Build for Production

```bash
# Type check and build
yarn build

# Preview production build locally
yarn preview
```

#### Development Commands

```bash
yarn dev              # Start development server
yarn build            # Production build
yarn preview          # Preview build locally
yarn type-check       # TypeScript checking
yarn lint             # ESLint with auto-fix
yarn format           # Prettier formatting
yarn test:e2e         # Run E2E tests (requires setup)
```

## Basic Usage

1. **Log Daily Tasks**: Use the main interface to add tasks with:
   - Project name
   - Task description
   - Duration (in minutes)
   - Date

2. **View Analytics**: Check the dashboard for:
   - Daily/monthly time summaries
   - Project breakdowns
   - Visual charts and calendar views

3. **Export Data**: Export your logs as CSV files for:
   - Backup purposes
   - Integration with other tools
   - Reporting and analysis

---

## Advanced: Xero Integration Workflow

> **Note**: This is an optional advanced feature for users who need to log time in Xero accounting software.

If you need to automatically submit your logged tasks to Xero, this application provides a complete automation workflow:

### Prerequisites for Xero Integration

3. **Playwright** (for Xero automation):
   ```bash
   yarn add --dev @playwright/test
   npx playwright install
   ```

### Xero Integration Setup

1. **Create environment file**:
   Create a `.env` file in the root directory:
   ```env
   VITE_XERO_USERNAME=your-xero-email@example.com
   VITE_XERO_PASSWORD=your-xero-password
   VITE_XERO_CONTACT_NAME=Your Contact Name in Xero
   VITE_XERO_TEMPLATE_PATH=C:\Users\YourName\Downloads
   ```

2. **Run PowerShell setup** (Windows only):
   ```bash
   # Navigate to powershell-scripts folder
   # Right-click on setup.ps1 → "Run with PowerShell"
   ```

   This creates two desktop shortcuts:
   - **Daybook App**: Opens the Vue.js application
   - **Xero Logger**: Runs the automation script

### Xero Automation Workflow

1. **Log tasks** in the Daybook application
2. **Export to CSV** using the export button
3. **Run Xero automation**:
   - Use the "Xero Logger" desktop shortcut, or
   - Run manually: `yarn test:e2e xeroWorkLogger.spec.ts`

The automation will:
- Open Xero in a browser
- Login with your credentials
- Navigate to time tracking
- Import and submit your CSV data
- Close automatically when complete

### Xero Integration Files

- `e2e/xeroWorkLogger.spec.ts` - Main automation script
- `powershell-scripts/` - Windows setup and utility scripts
- `templates/` - CSV templates for Xero import

## Contributing

This is a personal productivity tool. Feel free to fork and customize for your own needs.

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Composition API
- **UI**: Vuetify 3 (Material Design)
- **Build**: Vite
- **State**: Pinia
- **Charts**: Chart.js
- **Testing**: Playwright (E2E)