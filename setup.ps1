# Save this as setup.ps1

# Get the project directory (where this script is)
$projectPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = "$desktopPath\Log Xero.lnk"
$launcherPath = "$projectPath\launch-vue-app.ps1"
$iconPath = "$projectPath\src\assets\auto-mode.ico"

# Create the launcher script content (only used if script doesn't exist)
$launcherScript = @"
# Get the directory where the script is located
`$scriptPath = Split-Path -Parent -Path `$MyInvocation.MyCommand.Definition

# Change to the dist directory
Set-Location "`$scriptPath\dist"

# Check if http-server is already running on port 5000
`$existingProcess = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess | 
    ForEach-Object { Get-Process -Id `$_ -ErrorAction SilentlyContinue }

if (-not `$existingProcess) {
    # Start http-server hidden only if it's not already running
    Start-Process powershell -WindowStyle Hidden -ArgumentList "http-server -p 5000"
    # Wait 2 seconds for server to start
    Start-Sleep -Seconds 2
}

# Open default browser
Start-Process "http://localhost:5000"
"@

try {
    # Check and create launcher script if it doesn't exist
    if (-not (Test-Path $launcherPath)) {
        $launcherScript | Out-File -FilePath $launcherPath -Encoding UTF8
        Write-Host "✓ Created new launcher script" -ForegroundColor Green
    } else {
        Write-Host "✓ Using existing launcher script" -ForegroundColor Green
    }

    # Check and create shortcut if it doesn't exist
    if (-not (Test-Path $shortcutPath)) {
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""
        $Shortcut.WorkingDirectory = $projectPath

        # Use custom icon if available
        if (Test-Path $iconPath) {
            $Shortcut.IconLocation = $iconPath
            Write-Host "✓ Using custom icon from $iconPath" -ForegroundColor Green
        } else {
            Write-Host "! Custom icon not found, using default PowerShell icon" -ForegroundColor Yellow
        }

        $Shortcut.Save()
        Write-Host "✓ Created new shortcut" -ForegroundColor Green
    } else {
        Write-Host "✓ Using existing shortcut" -ForegroundColor Green
    }

    # Check if server is already running
    $serverRunning = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
    if ($serverRunning) {
        Write-Host "✓ Server is already running on port 5000" -ForegroundColor Green
    }

    Write-Host "`n✨ Setup complete! You can use the 'Vue App' shortcut on your desktop." -ForegroundColor Cyan
    Write-Host "Note: To update any existing files, delete them first and run setup again." -ForegroundColor Yellow
}
catch {
    Write-Host "❌ Error during setup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}