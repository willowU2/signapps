<#
.SYNOPSIS
    Stop all SignApps test services.

.DESCRIPTION
    This script stops all running SignApps services that were started by the test script.
#>

$ErrorActionPreference = "Continue"

Write-Host "Stopping SignApps test services..." -ForegroundColor Cyan

# Service process names (with underscore instead of dash)
$processNames = @(
    "signapps_identity",
    "signapps_containers",
    "signapps_proxy",
    "signapps_storage",
    "signapps_ai",
    "signapps_securelink",
    "signapps_scheduler",
    "signapps_metrics",
    "signapps_media",
    "signapps_docs",
    "signapps_calendar",
    "signapps_collab",
    "signapps_mail",
    "signapps_pxe",
    "signapps_it_assets",
    "signapps_remote",
    "signapps_meet",
    "signapps_office",
    "signapps_workforce"
)

$stopped = 0

foreach ($name in $processNames) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        $procs | Stop-Process -Force
        Write-Host "  Stopped $name" -ForegroundColor Green
        $stopped++
    }
}

# Also try with dashes (exe names)
foreach ($name in $processNames) {
    $dashName = $name -replace "_", "-"
    $procs = Get-Process -Name $dashName -ErrorAction SilentlyContinue
    if ($procs) {
        $procs | Stop-Process -Force
        Write-Host "  Stopped $dashName" -ForegroundColor Green
        $stopped++
    }
}

# Stop Node.js processes that might be the frontend
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*next*" -or $_.CommandLine -like "*client*"
}
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force
    Write-Host "  Stopped frontend (node)" -ForegroundColor Green
    $stopped++
}

if ($stopped -eq 0) {
    Write-Host "No services were running." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Stopped $stopped service(s)." -ForegroundColor Green
}
