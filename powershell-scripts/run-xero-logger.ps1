# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath
$testFile = "e2e/xeroWorkLogger.spec.ts"

function Start-XeroLoggerTest {
    Write-Host "Running Xero Work Logger test..." -ForegroundColor Cyan
    
    try {
        # Change to project directory
        if (!(Test-Path $projectRoot)) {
            throw "Project directory not found: $projectRoot"
        }
        Set-Location $projectRoot

        # Check if test file exists
        if (!(Test-Path $testFile)) {
            throw "Test file not found: $testFile"
        }

        # Run the Playwright test with headed mode
        Write-Host "Starting Playwright test..." -ForegroundColor Green
        npx playwright test $testFile --headed
        
        # Check if the test command succeeded
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Playwright test failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        } else {
            Write-Host "Test completed successfully!" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Press any key to continue..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Main execution
Start-XeroLoggerTest

# Keep terminal open for a few seconds to see final status
Write-Host "Script completed. Terminal will close in 5 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
