# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force

$config = @{
    ProjectPath = $projectRoot
    TestFile = "e2e\xeroWorkLogger.spec.ts"
    ShortcutName = "Log Xero Work"
}

function Start-XeroLoggerTest {
    Write-StatusMessage "Running Xero Work Logger test..." -Type "Info"
    
    # Change to project directory
    Set-Location $config.ProjectPath
    
    # Run the Playwright test
    npx playwright test $config.TestFile --headed
}

# Main execution
if ($args -contains "-RunTest") {
    # When launched from shortcut, run the test
    Start-XeroLoggerTest
} else {
    # When run directly, create the shortcut
    Write-StatusMessage "Setting up Xero Work Logger shortcut..." -Type "Info"
    & "$scriptPath\create-xero-logger-shortcut.ps1"
    Write-StatusMessage "Setup complete! You can use the '$($config.ShortcutName)' shortcut on your desktop." -Type "Success"
}