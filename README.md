# Daybook

A Vue.js application for daily task logging to track what you've accomplished. Keep a record of your daily work, projects, and tasks with an intuitive interface and powerful export capabilities.

## ✨ Features

- 📝 **Daily Task Logging** - Log tasks with project, duration, and description
- 📊 **Visual Analytics** - Charts and calendar views to visualize your productivity
- 📁 **Bulk Import/Export** - Import tasks from CSV or export your logs for external use
- 🎯 **Task Management** - Organize work by projects and categories
- 📅 **Calendar Integration** - Visual timeline of your logged activities
- 💾 **Local Storage** - All data stored locally in your browser

## 🚀 Quick Start

### Try the Live App

**No installation required!** Try Daybook instantly at:  
**[https://xero-logger.vercel.app/](https://xero-logger.vercel.app/)**

The deployed version includes all features and your data is stored locally in your browser.

### Local Development

Want to run locally or contribute? Follow these steps:

#### Prerequisites

- **Node.js** (LTS version) - [Download here](https://nodejs.org/en/download/)
- **Yarn** (recommended) - Install with `npm install --global yarn`

#### Setup

```bash
# Clone and install
git clone <repository-url>
cd daybook
yarn install

# Start development server
yarn dev
```

Open your browser to `http://localhost:5173`

#### Available Commands

```bash
yarn dev              # Start development server
yarn build            # Production build
yarn preview          # Preview build locally
yarn type-check       # TypeScript checking
yarn lint             # ESLint with auto-fix
yarn format           # Prettier formatting
yarn test:e2e         # Run E2E tests (requires setup)
```

## 📖 How to Use

### Logging Tasks

Use the main interface to add tasks with:
- Project name
- Task description  
- Duration (in minutes)
- Date

### Viewing Analytics

Check the dashboard for:
- Daily/monthly time summaries
- Project breakdowns
- Visual charts and calendar views

### Exporting Data

Export your logs as CSV files for:
- Backup purposes
- Integration with other tools
- Reporting and analysis

---

## ⚙️ Advanced: Xero Integration

> **Optional Feature**: For users who need to log time in Xero accounting software.

This application provides complete automation workflow to submit logged tasks directly to Xero.

### Additional Setup Required

**Playwright Installation:**
```bash
yarn add --dev @playwright/test
npx playwright install
```

**Environment Configuration:**

Create a `.env` file in the root directory:
```env
VITE_XERO_USERNAME=your-xero-email@example.com
VITE_XERO_PASSWORD=your-xero-password
VITE_XERO_CONTACT_NAME=Your Contact Name in Xero
VITE_XERO_TEMPLATE_PATH=C:\Users\YourName\Downloads
```

**Windows Desktop Shortcuts (Optional):**

Run the PowerShell setup script:
```bash
# Navigate to powershell-scripts folder
# Right-click on setup.ps1 → "Run with PowerShell"
```

This creates desktop shortcuts:
- **Daybook App** - Opens the Vue.js application
- **Xero Logger** - Runs the automation script

### Xero Automation Workflow

The automation process works as follows:

1. **Log your tasks** in the Daybook application
2. **Export to CSV** using the export button
3. **Run Xero automation** using either:
   - Desktop shortcut: "Xero Logger"
   - Manual command: `yarn test:e2e xeroWorkLogger.spec.ts`

The automation will:
- Open Xero in a browser
- Login with your credentials
- Navigate to time tracking
- Import and submit your CSV data
- Close automatically when complete

### Related Files

- `e2e/xeroWorkLogger.spec.ts` - Main automation script
- `powershell-scripts/` - Windows setup and utility scripts
- `templates/` - CSV templates for Xero import

## 🛠️ Tech Stack

- **Frontend:** Vue 3 + TypeScript + Composition API
- **UI Framework:** Vuetify 3 (Material Design)
- **Build Tool:** Vite
- **Package Manager:** Yarn
- **State Management:** Pinia
- **Charts:** Chart.js
- **Testing:** Playwright (E2E)
- **Deployment:** Vercel

## 🤝 Contributing

This is a personal productivity tool. Feel free to fork and customize for your own needs.

---

<div align="center">
  <p>Built with ❤️ for daily productivity tracking</p>
</div>