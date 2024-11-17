# Configuration
$config = @{
    ProjectPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log work"
    ServerPort = 5000
}
$config.Paths = @{
    Launcher = Join-Path $config.ProjectPath "launch-vue-app.ps1"
    Shortcut = Join-Path $config.DesktopPath "$($config.ShortcutName).lnk"
    Icon = Join-Path $config.ProjectPath "src\assets\auto-mode-green.ico"
}

function Write-StatusMessage {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )

    $colors = @{
        Success = "Green"
        Warning = "Yellow"
        Error = "Red"
        Info = "Cyan"
    }

    $prefix = switch ($Type) {
        "Success" { "✓" }
        "Warning" { "!" }
        "Error" { "❌" }
        "Info" { "✨" }
    }

    Write-Host "$prefix $Message" -ForegroundColor $colors[$Type]
}


function Get-LauncherScript {
    return @"
# Get the directory where the script is located
`$scriptPath = Split-Path -Parent -Path `$MyInvocation.MyCommand.Definition

# Change to the dist directory
Set-Location "`$scriptPath\dist"

# Check if http-server is already running on port $($config.ServerPort)
`$existingProcess = Get-NetTCPConnection -LocalPort $($config.ServerPort) -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess | 
    ForEach-Object { Get-Process -Id `$_ -ErrorAction SilentlyContinue }

if (-not `$existingProcess) {
    # Start http-server hidden only if it's not already running
    Start-Process powershell -WindowStyle Hidden -ArgumentList "http-server -p $($config.ServerPort)"
    # Wait 2 seconds for server to start
    Start-Sleep -Seconds 2
}

# Open default browser
Start-Process "http://localhost:$($config.ServerPort)"
"@
}

function Test-ServerRunning {
    $serverRunning = Get-NetTCPConnection -LocalPort $config.ServerPort -ErrorAction SilentlyContinue
    if ($serverRunning) {
        Write-StatusMessage "Server is already running on port $($config.ServerPort)" -Type "Success"
    }
    return $serverRunning
}

function New-LauncherScript {
    if (-not (Test-Path $config.Paths.Launcher)) {
        Get-LauncherScript | Out-File -FilePath $config.Paths.Launcher -Encoding UTF8
        Write-StatusMessage "Created new launcher script" -Type "Success"
    } else {
        Write-StatusMessage "Using existing launcher script" -Type "Success"
    }
}

function New-AppShortcut {
    if (-not (Test-Path $config.Paths.Shortcut)) {
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($config.Paths.Shortcut)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$($config.Paths.Launcher)`""
        $Shortcut.WorkingDirectory = $config.ProjectPath

        # Use custom icon if available
        if (Test-Path $config.Paths.Icon) {
            $Shortcut.IconLocation = $config.Paths.Icon
            Write-StatusMessage "Using custom icon from $($config.Paths.Icon)" -Type "Success"
        } else {
            Write-StatusMessage "Custom icon not found, using default PowerShell icon" -Type "Warning"
        }

        $Shortcut.Save()
        Write-StatusMessage "Created new shortcut" -Type "Success"
    } else {
        Write-StatusMessage "Using existing shortcut" -Type "Success"
    }
}

function Test-ProjectState {
    $packageJsonPath = Join-Path $config.ProjectPath "package.json"
    $nodeModulesPath = Join-Path $config.ProjectPath "node_modules"
    $distPath = Join-Path $config.ProjectPath "dist"

    # Check if this is first run by looking for node_modules and dist
    $isFirstRun = -not (Test-Path $nodeModulesPath) -or -not (Test-Path $distPath)

    # Verify package.json exists
    if (-not (Test-Path $packageJsonPath)) {
        Write-StatusMessage "package.json not found. Are you in the correct directory?" -Type "Error"
        exit 1
    }

    return $isFirstRun
}

function Initialize-Project {
    Write-StatusMessage "First time setup detected. Initializing project..." -Type "Info"

    # Check if yarn is installed
    if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
        Write-StatusMessage "Yarn is not installed. Please install it first with: npm install -g yarn" -Type "Error"
        exit 1
    }

    try {
        # Install dependencies
        Write-StatusMessage "Installing dependencies with yarn..." -Type "Info"
        
        $process = Start-Process -FilePath "yarn" -WorkingDirectory $config.ProjectPath -NoNewWindow -PassThru -Wait
        if ($process.ExitCode -ne 0) {
            throw "Yarn install failed with exit code $($process.ExitCode)"
        }
        Write-StatusMessage "Dependencies installed" -Type "Success"

        # Build project
        Write-StatusMessage "Building project..." -Type "Info"
        
        $process = Start-Process -FilePath "yarn" -ArgumentList "build" -WorkingDirectory $config.ProjectPath -NoNewWindow -PassThru -Wait
        if ($process.ExitCode -ne 0) {
            throw "Build failed with exit code $($process.ExitCode)"
        }
        
        Write-StatusMessage "Project built successfully" -Type "Success"
    }
    catch {
        Write-StatusMessage "Project initialization failed: $($_.Exception.Message)" -Type "Error"
        exit 1
    }
}

function Start-Setup {
    try {
        Write-StatusMessage "`nStart Setup..." -Type "Info"
        
        # Check project state and initialize if needed
        $isFirstRun = Test-ProjectState
        if ($isFirstRun) {
            Initialize-Project
        }

        New-LauncherScript
        New-AppShortcut
        Test-ServerRunning

        Write-StatusMessage "`nSetup complete! You can use the '$($config.ShortcutName)' shortcut on your desktop." -Type "Info"
        if ($isFirstRun) {
            Write-StatusMessage "First-time setup completed successfully!" -Type "Success"
        }
        Write-StatusMessage "To update any existing files, delete them first and run setup again." -Type "Warning"
    }
    catch {
        Write-StatusMessage "Error during setup: $($_.Exception.Message)" -Type "Error"
        exit 1
    }
}

Start-Setup
