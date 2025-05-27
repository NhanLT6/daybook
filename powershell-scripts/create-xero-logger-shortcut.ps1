# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath

$config = @{
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log Xero"
    IconPath = Join-Path $projectRoot "src\assets\progress-pencil.ico"
}

function New-XeroLoggerShortcut {
    $shortcutPath = Join-Path $config.DesktopPath "$($config.ShortcutName).lnk"
    
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$($scriptPath)\run-xero-logger.ps1`" -RunTest"

    if (Test-Path $config.IconPath) {
        $Shortcut.IconLocation = $config.IconPath
    }

    $Shortcut.Save()
    Write-Host "Created new shortcut: $shortcutPath" -ForegroundColor Green
}

# Execute shortcut creation
New-XeroLoggerShortcut