# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath
$testFile = "xeroWorkLogger.spec.ts"

function Start-XeroLoggerTest {
    Write-Host "ℹ️ Running Xero Work Logger test..." -ForegroundColor Cyan
    
    # Change to project directory
    Set-Location $projectRoot

    # Run the Playwright test with headed mode
    npx playwright test $testFile --headed
}

# Main execution
Start-XeroLoggerTest
