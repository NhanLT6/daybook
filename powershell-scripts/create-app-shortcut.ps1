# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath
$distPath   = Join-Path $projectRoot 'dist'

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force

Write-StatusMessage $scriptPath -Type "Info"
Write-StatusMessage $projectRoot -Type "Info"
Write-StatusMessage $distPath -Type "Info"

$Launcher = Join-Path $scriptPath "launch-vue-app.ps1"
Write-StatusMessage $Launcher -Type "Info"


$config = @{
    Paths = @{
        Launcher = Join-Path $scriptPath "launch-vue-app.ps1"
        Shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "Log work.lnk"
        Icon = Join-Path $projectRoot "src\assets\auto-mode-green.ico"
    }
}

function New-AppShortcut {
    $WshShell = New-Object -comObject WScript.Shell
   
    $Shortcut = $WshShell.CreateShortcut($config.Paths.Shortcut)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$($config.Paths.Launcher)`""
    $Shortcut.WorkingDirectory = $distPath

    # Shortcut icon
    if (Test-Path $config.Paths.Icon) {
        $Shortcut.IconLocation = $config.Paths.Icon
    }

    $Shortcut.Save()
    Write-StatusMessage "Created new shortcut" -Type "Success"
}

# Execute shortcut creation
New-AppShortcut