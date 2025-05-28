# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath

$config = @{
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log Work"
    IconPath = Join-Path $projectRoot "src\assets\auto-mode-green.ico"
    AppUrl = "https://xero-logger.vercel.app/"
}

function New-XeroLoggerShortcut {
    $shortcutPath = Join-Path $config.DesktopPath "$($config.ShortcutName).lnk"
    
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    
    # Set the target to directly open the URL in the default browser
    $Shortcut.TargetPath = $config.AppUrl
    
    # Use custom icon if available
    if (Test-Path $config.IconPath) {
        $Shortcut.IconLocation = $config.IconPath
    }

    $Shortcut.Save()
    Write-Host "Created shortcut to $($config.AppUrl)" -ForegroundColor Green
}

# Execute shortcut creation
New-XeroLoggerShortcut