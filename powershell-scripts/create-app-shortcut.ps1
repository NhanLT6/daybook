# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force

$config = @{
    ProjectPath = $projectRoot
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log work"
    Paths = @{
        Launcher = Join-Path $projectRoot "launch-vue-app.ps1"
        Shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "Log work.lnk"
        Icon = Join-Path $projectRoot "src\assets\auto-mode-green.ico"
    }
}

function New-AppShortcut {
    if (-not (Test-Path $config.Paths.Shortcut)) {
        $WshShell = New-Object -comObject WScript.Shell
       
        $Shortcut = $WshShell.CreateShortcut($config.Paths.Shortcut)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$($config.Paths.Launcher)`""
        $Shortcut.WorkingDirectory = $config.ProjectPath

        # Shortcut icon
        if (Test-Path $config.Paths.Icon) {
            $Shortcut.IconLocation = $config.Paths.Icon
        }

        $Shortcut.Save()
        Write-StatusMessage "Created new shortcut" -Type "Success"
    } else {
        Write-StatusMessage "Using existing shortcut" -Type "Success"
    }
}

# Execute shortcut creation
New-AppShortcut