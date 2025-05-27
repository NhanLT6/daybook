$ErrorActionPreference = 'Stop'
trap {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host -Prompt "Press Enter to exit..."
    exit 1
}

$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$ProjectPath = Split-Path -Parent -Path $scriptPath

function Install-Dependencies {
    try {
        Write-Host "📦 Installing dependencies with yarn..." -ForegroundColor Cyan
        Push-Location $ProjectPath
        try {
            & yarn install
        }
        finally {
            Pop-Location
        }
        Write-Host "Project built successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "Project initialization failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Start-Setup {
    try {
        Write-Host "🚀 Starting setup process..." -ForegroundColor Cyan

        Install-Dependencies

        # Create Log Work shortcut
        & "$scriptPath\create-app-shortcut.ps1"

        # Create Log Xero shortcut
        & "$scriptPath\create-xero-logger-shortcut.ps1"

        Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error during setup: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Start-Setup