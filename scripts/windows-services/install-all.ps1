#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Install all SignApps services as Windows services.

.DESCRIPTION
    This script installs all SignApps backend services as Windows services.
    It requires administrator privileges and the release binaries to be built.

.PARAMETER BuildFirst
    Build the release binaries before installing.

.PARAMETER IncludeFrontend
    Also install the frontend as a Windows service using NSSM.

.EXAMPLE
    .\install-all.ps1
    Install all backend services.

.EXAMPLE
    .\install-all.ps1 -BuildFirst
    Build and then install all services.

.EXAMPLE
    .\install-all.ps1 -IncludeFrontend
    Install all services including the frontend.
#>

param(
    [switch]$BuildFirst,
    [switch]$IncludeFrontend
)

$ErrorActionPreference = "Stop"

# Load configuration
. "$PSScriptRoot\config.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SignApps Services Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

# Build if requested
if ($BuildFirst) {
    Write-Host "Building release binaries..." -ForegroundColor Yellow
    Push-Location $BaseDir
    try {
        cargo build --release --workspace
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Build failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host "Build completed successfully." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
    Write-Host ""
}

# Check if binaries exist
if (-not (Test-Path $BinDir)) {
    Write-Host "ERROR: Release binaries not found at $BinDir" -ForegroundColor Red
    Write-Host "Run with -BuildFirst to build the binaries first." -ForegroundColor Yellow
    exit 1
}

# Load environment variables from .env file
$envVars = @{}
if (Test-Path $EnvFile) {
    Write-Host "Loading environment from $EnvFile" -ForegroundColor Gray
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            $envVars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
}

# Install each service
$installed = 0
$failed = 0

foreach ($svc in $Services) {
    $serviceName = $svc.Name
    $binaryPath = Join-Path $BinDir $svc.Binary
    $displayName = $svc.DisplayName
    $description = $svc.Description

    Write-Host "Installing $serviceName..." -NoNewline

    # Check if binary exists
    if (-not (Test-Path $binaryPath)) {
        Write-Host " SKIPPED (binary not found)" -ForegroundColor Yellow
        continue
    }

    # Check if service already exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host " EXISTS" -ForegroundColor Yellow
        continue
    }

    # Build dependencies string for sc.exe
    $depString = ""
    if ($svc.Dependencies.Count -gt 0) {
        $depString = $svc.Dependencies -join "/"
    }

    # Create the service using sc.exe
    try {
        # Build environment variables for the service
        $envString = ""
        foreach ($key in $envVars.Keys) {
            $envString += "$key=$($envVars[$key])`n"
        }

        # Create service
        $scArgs = @(
            "create", $serviceName,
            "binPath=", "`"$binaryPath`"",
            "start=", "auto",
            "DisplayName=", "`"$displayName`""
        )

        if ($depString) {
            $scArgs += "depend=", $depString
        }

        $result = & sc.exe @scArgs 2>&1

        if ($LASTEXITCODE -ne 0) {
            throw "sc.exe create failed: $result"
        }

        # Set description
        & sc.exe description $serviceName "$description" | Out-Null

        # Configure recovery options (restart on failure)
        & sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

        # Set environment variables via registry
        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
        if ($envVars.Count -gt 0) {
            $envArray = @()
            foreach ($key in $envVars.Keys) {
                $envArray += "$key=$($envVars[$key])"
            }
            Set-ItemProperty -Path $regPath -Name "Environment" -Value $envArray -Type MultiString
        }

        Write-Host " OK" -ForegroundColor Green
        $installed++
    }
    catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

# Install frontend if requested
if ($IncludeFrontend) {
    Write-Host ""
    Write-Host "Installing frontend service..." -ForegroundColor Yellow

    # Check for NSSM
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $nssm) {
        Write-Host "WARNING: NSSM not found. Install NSSM to run the frontend as a service." -ForegroundColor Yellow
        Write-Host "  Download from: https://nssm.cc/download" -ForegroundColor Gray
    }
    else {
        $frontendDir = $FrontendService.Directory
        $serviceName = $FrontendService.Name

        # Check if service exists
        $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-Host "Frontend service already exists." -ForegroundColor Yellow
        }
        else {
            try {
                # Install with NSSM
                & nssm install $serviceName "npm.cmd"
                & nssm set $serviceName AppDirectory "$frontendDir"
                & nssm set $serviceName AppParameters "run start"
                & nssm set $serviceName DisplayName $FrontendService.DisplayName
                & nssm set $serviceName Description $FrontendService.Description
                & nssm set $serviceName Start SERVICE_AUTO_START

                # Set dependencies
                & nssm set $serviceName DependOnService $FrontendService.Dependencies

                Write-Host "Frontend service installed successfully." -ForegroundColor Green
                $installed++
            }
            catch {
                Write-Host "Failed to install frontend service: $_" -ForegroundColor Red
                $failed++
            }
        }
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installed: $installed" -ForegroundColor Green
Write-Host "  Failed:    $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host ""

if ($installed -gt 0) {
    Write-Host "Run '.\start-all.ps1' to start the services." -ForegroundColor Yellow
}
