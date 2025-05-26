# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force

$config = @{
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log Xero"
    IconPath = Join-Path $projectRoot "src\assets\progress-pencil.ico"
}

function New-XeroLoggerShortcut {
    $shortcutPath = Join-Path $config.DesktopPath "$($config.ShortcutName).lnk"
    
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$($scriptPath)\run-xero-logger.ps1`" -RunTest"

    # Use custom icon if available
    if (Test-Path $config.IconPath) {
        $Shortcut.IconLocation = $config.IconPath
    }

    $Shortcut.Save()
    Write-StatusMessage "Created new shortcut: $shortcutPath" -Type "Success"
}

# Execute shortcut creation
New-XeroLoggerShortcut