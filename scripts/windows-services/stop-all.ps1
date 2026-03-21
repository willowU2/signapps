#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Stop all SignApps Windows services.

.DESCRIPTION
    This script stops all SignApps services in reverse dependency order
    to ensure graceful shutdown.

.PARAMETER IncludeFrontend
    Also stop the frontend service.

.PARAMETER Force
    Force stop without waiting for graceful shutdown.

.EXAMPLE
    .\stop-all.ps1
    Stop all backend services gracefully.

.EXAMPLE
    .\stop-all.ps1 -Force
    Force stop all services immediately.
#>

param(
    [switch]$IncludeFrontend,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Load configuration
. "$PSScriptRoot\config.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stopping SignApps Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

# Stop frontend first if included
if ($IncludeFrontend) {
    $serviceName = $FrontendService.Name
    Write-Host "Stopping $serviceName..." -NoNewline

    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host " NOT INSTALLED" -ForegroundColor Gray
    }
    elseif ($existingService.Status -eq "Stopped") {
        Write-Host " ALREADY STOPPED" -ForegroundColor Gray
    }
    else {
        try {
            if ($Force) {
                Stop-Service -Name $serviceName -Force -NoWait
            }
            else {
                Stop-Service -Name $serviceName
            }
            Write-Host " OK" -ForegroundColor Green
        }
        catch {
            Write-Host " FAILED: $_" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Sort services by dependency count (stop services with more dependencies first)
$sortedServices = $Services | Sort-Object { $_.Dependencies.Count } -Descending

$stopped = 0
$failed = 0
$skipped = 0

foreach ($svc in $sortedServices) {
    $serviceName = $svc.Name

    Write-Host "Stopping $serviceName..." -NoNewline

    # Check if service exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host " NOT INSTALLED" -ForegroundColor Gray
        $skipped++
        continue
    }

    # Check if already stopped
    if ($existingService.Status -eq "Stopped") {
        Write-Host " ALREADY STOPPED" -ForegroundColor Gray
        $stopped++
        continue
    }

    try {
        if ($Force) {
            Stop-Service -Name $serviceName -Force -NoWait
        }
        else {
            Stop-Service -Name $serviceName
        }
        Write-Host " OK" -ForegroundColor Green
        $stopped++
    }
    catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stop Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stopped: $stopped" -ForegroundColor Green
Write-Host "  Skipped: $skipped" -ForegroundColor Gray
Write-Host "  Failed:  $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host ""
