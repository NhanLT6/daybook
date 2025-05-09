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

    # Use simple text prefixes to avoid encoding issues
    $prefix = switch ($Type) {
        "Success" { "[OK] " }
        "Warning" { "[!] " }
        "Error" { "[ERROR] " }
        "Info" { "[INFO] " }
    }

    Write-Host "$prefix$Message" -ForegroundColor $colors[$Type]
}

# Export the function so it can be imported by other scripts
Export-ModuleMember -Function Write-StatusMessage