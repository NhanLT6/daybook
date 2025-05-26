# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath
$testFile = "xeroWorkLogger.spec.ts"

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force


function Start-XeroLoggerTest {
    Write-StatusMessage "Running Xero Work Logger test..." -Type "Info"
    
    # Change to project directory
    Set-Location $projectRoot

    # Run the Playwright test
    npx playwright test $testFile --headed
}

# Main execution
Start-XeroLoggerTest
