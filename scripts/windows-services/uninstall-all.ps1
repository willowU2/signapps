#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Uninstall all SignApps Windows services.

.DESCRIPTION
    This script removes all SignApps services from Windows.
    It will stop running services before removing them.

.PARAMETER IncludeFrontend
    Also uninstall the frontend service.

.EXAMPLE
    .\uninstall-all.ps1
    Uninstall all backend services.
#>

param(
    [switch]$IncludeFrontend
)

$ErrorActionPreference = "Stop"

# Load configuration
. "$PSScriptRoot\config.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SignApps Services Uninstaller" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

# Confirm
$confirm = Read-Host "Are you sure you want to uninstall all SignApps services? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Uninstall each service
$removed = 0
$failed = 0

# Stop all services first (in reverse dependency order)
Write-Host "Stopping services..." -ForegroundColor Yellow
foreach ($svc in ($Services | Sort-Object { $_.Dependencies.Count } -Descending)) {
    $serviceName = $svc.Name
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService -and $existingService.Status -eq "Running") {
        Write-Host "  Stopping $serviceName..." -NoNewline
        try {
            Stop-Service -Name $serviceName -Force -NoWait
            Write-Host " OK" -ForegroundColor Green
        }
        catch {
            Write-Host " FAILED" -ForegroundColor Red
        }
    }
}

# Wait for services to stop
Start-Sleep -Seconds 3

# Remove services
Write-Host ""
Write-Host "Removing services..." -ForegroundColor Yellow

foreach ($svc in $Services) {
    $serviceName = $svc.Name

    Write-Host "  Removing $serviceName..." -NoNewline

    # Check if service exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host " NOT FOUND" -ForegroundColor Gray
        continue
    }

    try {
        # Remove the service using sc.exe
        $result = & sc.exe delete $serviceName 2>&1

        if ($LASTEXITCODE -ne 0) {
            throw "sc.exe delete failed: $result"
        }

        Write-Host " OK" -ForegroundColor Green
        $removed++
    }
    catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

# Uninstall frontend if requested
if ($IncludeFrontend) {
    Write-Host ""
    Write-Host "Removing frontend service..." -ForegroundColor Yellow

    $serviceName = $FrontendService.Name
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (-not $existingService) {
        Write-Host "  Frontend service not found." -ForegroundColor Gray
    }
    else {
        # Check for NSSM
        $nssm = Get-Command nssm -ErrorAction SilentlyContinue
        if ($nssm) {
            try {
                & nssm stop $serviceName confirm 2>$null
                & nssm remove $serviceName confirm
                Write-Host "  Frontend service removed." -ForegroundColor Green
                $removed++
            }
            catch {
                Write-Host "  Failed to remove frontend service: $_" -ForegroundColor Red
                $failed++
            }
        }
        else {
            # Try with sc.exe
            try {
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                & sc.exe delete $serviceName | Out-Null
                Write-Host "  Frontend service removed." -ForegroundColor Green
                $removed++
            }
            catch {
                Write-Host "  Failed to remove frontend service: $_" -ForegroundColor Red
                $failed++
            }
        }
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Uninstall Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Removed: $removed" -ForegroundColor Green
Write-Host "  Failed:  $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host ""
