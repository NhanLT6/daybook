# xero-logger

Friendly way to log work in Xero.

## Project Setup

```sh
  yarn
```

## Getting Started

There are two main ways to use this application:

1. Use Vue app to input logs
2. Use Excel template to log work in Xero

## Usage

### Crate .env file

Create a `.env` file in the root of the project and set the following variables:

```env
VITE_XERO_USERNAME= Email account to log in to Xero
VITE_XERO_PASSWORD= Password for the Xero account
VITE_XERO_CONTACT_NAME= The contact name found after you logged in to Xero
VITE_XERO_TEMPLATE_PATH= Your download folder path where the Excel template file is located
```

### 1. Use Vue app

Follow these steps to create a shortcut to access the Vue app and run the automated test for logging work in Xero:

1. Goto `powershell-scripts` folder > Right-click on `setup.ps1` file and select `Run with PowerShell`. This script will create two shortcuts:
   1. Log work: Vue app to log work and export to Excel
   2. Log Xero: Automated test for logging work in Xero
2. Once the PowerShell window closes, go to your Desktop
3. Double-click on the `Log work` shortcut to launch the application in your browser
4. Input your logs and export to Excel by clicking on the `Export to CSV` button in the Vue app
5. Double-click on the `Log Xero` shortcut to run the automated test for logging work in Xero

Note: An exported CSV file will be saved in your Download folder with the name `XeroLog-YYYY-MM.csv`, where `YYYY-MM` is the current year and month.

### 2. Use Excel template

Use these steps to create a shortcut for the automated Xero logging test:

1. Goto `powershell-scripts` folder > Right-click on `create-xero-logger-shortcut.ps1` and select `Run with PowerShell` to create a shortcut for the automated test
2. Once the PowerShell window closes, go to your Desktop
3. Double-click on the `Log Xero` shortcut to run the automated test

You need to configure where to find the Excel template file. Open the `.env` from the project root and set the `VITE_XERO_TEMPLATE_PATH` variable to the path of your Excel template file, for example, C:\Users\UserName\Downloads
```