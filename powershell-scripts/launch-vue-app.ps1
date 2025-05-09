# Get the directory where the script is located
$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

# Change to the dist directory
Set-Location "$scriptPath\dist"

# Check if http-server is already running on port 5000
$existingProcess = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess | 
    ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }

if (-not $existingProcess) {
    # Start http-server hidden only if it's not already running
    Start-Process powershell -WindowStyle Hidden -ArgumentList "http-server -p 5000"
    # Wait 2 seconds for server to start
    Start-Sleep -Seconds 2
}

# Open default browser
Start-Process "http://localhost:5000"
