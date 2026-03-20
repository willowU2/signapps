#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Start all SignApps Windows services.

.DESCRIPTION
    This script starts all SignApps services in dependency order.

.PARAMETER IncludeFrontend
    Also start the frontend service.

.EXAMPLE
    .\start-all.ps1
    Start all backend services.
#>

param(
    [switch]$IncludeFrontend
)

$ErrorActionPreference = "Stop"

# Load configuration
. "$PSScriptRoot\config.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting SignApps Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

# Sort services by dependency count (start services with fewer dependencies first)
$sortedServices = $Services | Sort-Object { $_.Dependencies.Count }

$started = 0
$failed = 0
$skipped = 0

foreach ($svc in $sortedServices) {
    $serviceName = $svc.Name

    Write-Host "Starting $serviceName..." -NoNewline

    # Check if service exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host " NOT INSTALLED" -ForegroundColor Yellow
        $skipped++
        continue
    }

    # Check if already running
    if ($existingService.Status -eq "Running") {
        Write-Host " ALREADY RUNNING" -ForegroundColor Green
        $started++
        continue
    }

    try {
        Start-Service -Name $serviceName
        Write-Host " OK" -ForegroundColor Green
        $started++
    }
    catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

# Start frontend if requested
if ($IncludeFrontend) {
    Write-Host ""
    $serviceName = $FrontendService.Name
    Write-Host "Starting $serviceName..." -NoNewline

    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $existingService) {
        Write-Host " NOT INSTALLED" -ForegroundColor Yellow
        $skipped++
    }
    elseif ($existingService.Status -eq "Running") {
        Write-Host " ALREADY RUNNING" -ForegroundColor Green
        $started++
    }
    else {
        try {
            Start-Service -Name $serviceName
            Write-Host " OK" -ForegroundColor Green
            $started++
        }
        catch {
            Write-Host " FAILED: $_" -ForegroundColor Red
            $failed++
        }
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Start Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Started: $started" -ForegroundColor Green
Write-Host "  Skipped: $skipped" -ForegroundColor Yellow
Write-Host "  Failed:  $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host ""

if ($started -gt 0) {
    Write-Host "Run '.\status.ps1' to check service status." -ForegroundColor Gray
}
