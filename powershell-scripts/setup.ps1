# Configuration
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath  # Go up one level to the project root

# Import common functions
Import-Module "$scriptPath\common.psm1" -Force

# Single unified config
$config = @{
    ProjectPath = $projectRoot
    DesktopPath = [Environment]::GetFolderPath('Desktop')
    ShortcutName = "Log work"
    ServerPort = 5000
    Launcher = Join-Path $projectRoot "launch-vue-app.ps1"
    Shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "Log work.lnk"
    Icon = Join-Path $projectRoot "src\assets\auto-mode-green.ico"
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
        Write-StatusMessage "Start Setup..." -Type "Info"
        
        # Check project state and initialize if needed
        $isFirstRun = Test-ProjectState
        if ($isFirstRun) {
            Initialize-Project
        }
        
        # Call the external shortcut creation script
        Write-StatusMessage "Creating desktop shortcut..." -Type "Info"
        & "$scriptPath\create-app-shortcut.ps1"

        Write-StatusMessage "Setup complete! You can use the '$($config.ShortcutName)' shortcut on your desktop." -Type "Info"
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