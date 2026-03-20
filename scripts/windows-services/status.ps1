<#
.SYNOPSIS
    Display status of all SignApps Windows services.

.DESCRIPTION
    This script shows the status of all SignApps services.

.PARAMETER IncludeFrontend
    Also show the frontend service status.

.EXAMPLE
    .\status.ps1
    Show status of all services.
#>

param(
    [switch]$IncludeFrontend
)

# Load configuration
. "$PSScriptRoot\config.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SignApps Services Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Table header
$format = "{0,-25} {1,-12} {2,-6} {3}"
Write-Host ($format -f "SERVICE", "STATUS", "PORT", "PID") -ForegroundColor Gray
Write-Host ("-" * 60) -ForegroundColor Gray

$running = 0
$stopped = 0
$notInstalled = 0

foreach ($svc in $Services) {
    $serviceName = $svc.Name
    $port = $svc.Port

    # Check service status
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (-not $existingService) {
        Write-Host ($format -f $serviceName, "NOT INSTALLED", $port, "-") -ForegroundColor Yellow
        $notInstalled++
        continue
    }

    $status = $existingService.Status
    $pid = "-"

    if ($status -eq "Running") {
        # Try to get PID
        $wmiService = Get-WmiObject -Class Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        if ($wmiService -and $wmiService.ProcessId) {
            $pid = $wmiService.ProcessId
        }

        Write-Host ($format -f $serviceName, "RUNNING", $port, $pid) -ForegroundColor Green
        $running++
    }
    elseif ($status -eq "Stopped") {
        Write-Host ($format -f $serviceName, "STOPPED", $port, "-") -ForegroundColor Red
        $stopped++
    }
    else {
        Write-Host ($format -f $serviceName, $status, $port, "-") -ForegroundColor Yellow
    }
}

# Frontend status
if ($IncludeFrontend) {
    Write-Host ""
    $serviceName = $FrontendService.Name
    $port = $FrontendService.Port

    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (-not $existingService) {
        Write-Host ($format -f $serviceName, "NOT INSTALLED", $port, "-") -ForegroundColor Yellow
        $notInstalled++
    }
    else {
        $status = $existingService.Status
        $pid = "-"

        if ($status -eq "Running") {
            $wmiService = Get-WmiObject -Class Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
            if ($wmiService -and $wmiService.ProcessId) {
                $pid = $wmiService.ProcessId
            }
            Write-Host ($format -f $serviceName, "RUNNING", $port, $pid) -ForegroundColor Green
            $running++
        }
        elseif ($status -eq "Stopped") {
            Write-Host ($format -f $serviceName, "STOPPED", $port, "-") -ForegroundColor Red
            $stopped++
        }
        else {
            Write-Host ($format -f $serviceName, $status, $port, "-") -ForegroundColor Yellow
        }
    }
}

# Summary
Write-Host ""
Write-Host ("-" * 60) -ForegroundColor Gray
Write-Host "Running: $running  |  Stopped: $stopped  |  Not Installed: $notInstalled" -ForegroundColor Gray
Write-Host ""

# Show PostgreSQL status
Write-Host "PostgreSQL Status:" -ForegroundColor Cyan
$pgService = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
if (-not $pgService) {
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($pgService) {
    if ($pgService.Status -eq "Running") {
        Write-Host "  $($pgService.Name): RUNNING" -ForegroundColor Green
    }
    else {
        Write-Host "  $($pgService.Name): $($pgService.Status)" -ForegroundColor Red
    }
}
else {
    Write-Host "  PostgreSQL service not found" -ForegroundColor Yellow
}
Write-Host ""
