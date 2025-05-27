# xero-logger

Friendly way to log work in Xero.

## Install required dependencies

Before you dive in, make sure you have the following:

1. **Node.js & npm**  
   Download & install the LTS build from https://nodejs.org/en/download/  
   Verify:
   ```bash
   node --version
   npm --version
   ```

2. **Yarn**  
   If you already have `yarn`, you’re all set. Otherwise:
   ```bash
   npm install --global yarn
   yarn --version
   ```

3. **Playwright**  
   Install the test runner and browsers:
   ```bash
   yarn add --dev @playwright/test
   npx playwright install
   ```

## Getting Started

There are two main ways to use this application:

1. Use Vue app to input logs
2. Use Excel template to log work in Xero

## Usage

### Crate .env file

Create a `.env` file in the root of the project with these variables to configure the application:

```env
VITE_XERO_USERNAME= Email account to log in to Xero
VITE_XERO_PASSWORD= Password for the Xero account
VITE_XERO_CONTACT_NAME= The contact name found after you logged in to Xero
VITE_XERO_TEMPLATE_PATH= Your download folder path where the Excel template file is located
```

### Setup

Goto `powershell-scripts` folder > Right-click on `setup.ps1` file and select `Run with PowerShell`. This script will create two shortcuts:
1. Log work: Vue app to log work and export to Excel
2. Log Xero: Automated test for logging work in Xero

If you don't want to use the Vue app, you can ignore "Log work" shortcut use "Log Xero" only.
