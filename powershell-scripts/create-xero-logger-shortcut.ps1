# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force

$config = @{
    ProjectPath = $projectRoot
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log Xero"
    IconPath = Join-Path $projectRoot "src\assets\progress-pencil.ico"
}

function New-XeroLoggerShortcut {
    $shortcutPath = Join-Path $config.DesktopPath "$($config.ShortcutName).lnk"
    
    if (-not (Test-Path $shortcutPath)) {
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$($config.ProjectPath)\run-xero-logger.ps1`" -RunTest"
        $Shortcut.WorkingDirectory = $config.ProjectPath

        # Use custom icon if available
        if (Test-Path $config.IconPath) {
            $Shortcut.IconLocation = $config.IconPath
        }

        $Shortcut.Save()
        Write-StatusMessage "Created new shortcut: $shortcutPath" -Type "Success"
    } else {
        Write-StatusMessage "Shortcut already exists: $shortcutPath" -Type "Success"
    }
}

# Execute shortcut creation
New-XeroLoggerShortcut