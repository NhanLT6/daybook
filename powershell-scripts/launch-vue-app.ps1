# Path of this script
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent -Path $scriptPath
$distDir    = Join-Path $projectRoot 'dist'

# Change to the dist directory
Set-Location $distDir

# Check if http-server is already running on port 5000
$isServerRunning = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess |
        ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }

if (-not $isServerRunning) {
    # Start http-server hidden only if it's not already running
    Start-Process powershell -WindowStyle Hidden -ArgumentList "http-server -p 5000 -o"
}

# Open default browser
Start-Process "http://localhost:5000"
