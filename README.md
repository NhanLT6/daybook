# xero-logger

Friendly way to log work in Xero.

## Project Setup

```sh
  yarn
```

## Getting Started

There are two main ways to use this application:

### 1. Run the input logger app Locally

To create a shortcut for the web application:

1. Right-click on `powershell-scripts\setup.ps1` file and select `Run with PowerShell`
2. Once the PowerShell window closes, go to your Desktop
3. Double-click on the `Log work` shortcut to launch the application in your browser

This will start a local web server and open the application in your default browser.

### 2. Log work into Xero

To create a shortcut for the automated Xero logging test:

1. Right-click on `powershell-scripts\run-xero-logger.ps1` and select `Run with PowerShell`
2. Once the PowerShell window closes, go to your Desktop
3. Double-click on the `Log Xero` shortcut to run the automated test

This will launch a browser with Playwright and run the automated Xero logging test.
```