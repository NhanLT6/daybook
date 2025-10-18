# Daybook

A Vue.js application for daily task logging to track what you've accomplished. Keep a record of your daily work, projects, and tasks with an intuitive interface and powerful export capabilities.

## ✨ Features

- 📝 **Daily Task Logging**: Log tasks with project, duration, and description
- 📊 **Visual Analytics**: Charts and calendar views to visualize your productivity
- 📁 **Bulk Import/Export**: Import tasks from CSV or export your logs for external use
- 🎯 **Task Management**: Organize work by projects and categories
- 📅 **Calendar Integration**: Visual timeline of your logged activities
- 🔗 **Jira Integration**: Sync tickets from Jira for easier code review logging (optional)
- 💾 **Local Storage**: All data stored locally in your browser

## 🚀 Quick Start

### Try the Live App

**No installation required!** Try Daybook instantly at:  
**[https://daybook-io.vercel.app/](https://daybook-io.vercel.app/)**

The deployed version includes all features, and your data is stored locally in your browser.

### Local Development

Want to run locally or contribute? Follow these steps:

#### Prerequisites

- **Node.js** (LTS version)
- **Yarn** (recommended)

#### Setup

```bash
# Clone and install
git clone <repository-url>
cd daybook
yarn install

# Start development server (for basic usage)
yarn dev

# OR run with Vercel dev (required for Jira integration)
yarn dev:vercel
```

**Important Notes:**
- Basic app features work with `yarn dev` at `http://localhost:5173`
- **Jira integration requires `yarn dev:vercel`** to enable API routes (see Jira Integration section below)
- Vercel CLI automatically detects and serves serverless functions from `/api` directory

## ⚙️ Advanced: Jira Integration

> **Optional Feature**: Connect to Jira to sync tickets and streamline code review logging.

### Setup

1. **Start development server with Vercel:**
   ```bash
   yarn dev:vercel
   ```
   This enables the API routes required for Jira integration (bypasses CORS restrictions).

2. **Configure Jira in Settings:**
   - Navigate to Settings in the app
   - Toggle "Jira Integration" ON
   - Enter your Jira credentials:
     - **Domain**: Your Jira subdomain (e.g., `acme` from `acme.atlassian.net`)
     - **Email**: Your Jira account email
     - **API Token**: Generate at [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
     - **Project Key**: Your project key (e.g., `ABC` from ticket `ABC-123`)
   - Click "Test Connection" to verify

3. **How it works:**
   - Jira tickets are fetched via Vercel serverless functions in `/api/jira`
   - Tickets are stored locally in your browser
   - Team members' tickets appear in code review workflows for easier logging

### API Routes

The following serverless functions handle Jira API communication:
- `api/jira/test-connection.ts` - Validates Jira credentials
- `api/jira/fetch-tickets.ts` - Retrieves tickets from your Jira project

**Note**: These routes only work when running with `yarn dev:vercel` or in production on Vercel.

## ⚙️ Advanced: Xero Integration

> **Optional Feature**: For users who need to log time in Xero accounting software.

This application provides a complete automation workflow to submit logged tasks directly to Xero.

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
- **Daybook App**: Opens daybook-io page in your browser
- **Xero Logger**: Runs the automation script to log tasks in Xero

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