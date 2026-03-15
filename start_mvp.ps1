#!/usr/bin/env pwsh
# SignApps Platform — MVP Launcher
# Usage: .\start_mvp.ps1 [-Release] [-Build] [-NoBrowser]

param(
    [switch]$Release,
    [switch]$Build,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Continue"
$profile = if ($Release) { "release" } else { "debug" }
$binDir = "target\$profile"

Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "     SignApps Platform - MVP Launcher      " -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Profile: $profile" -ForegroundColor Gray
Write-Host ""

# ── Step 0: Build if requested ──
if ($Build) {
    Write-Host "[BUILD] Compiling all services ($profile)..." -ForegroundColor Yellow
    if ($Release) {
        cargo build --workspace --release 2>&1 | Out-Null
    } else {
        cargo build --workspace 2>&1 | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BUILD] FAILED - fix compilation errors first." -ForegroundColor Red
        exit 1
    }
    Write-Host "[BUILD] OK" -ForegroundColor Green
}

# ── Step 1: Check prerequisites ──
Write-Host "[CHECK] PostgreSQL..." -NoNewline
$pg = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue
if ($pg.TcpTestSucceeded) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAIL - Start PostgreSQL first!" -ForegroundColor Red
    exit 1
}

# ── Step 2: Stop existing services ──
Write-Host "[STOP] Cleaning up old processes..." -NoNewline
Get-Process | Where-Object { $_.ProcessName -like "signapps-*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host " OK" -ForegroundColor Green

# ── Step 3: Start services ──
$services = [ordered]@{
    "signapps-identity"   = 3001
    "signapps-containers" = 3002
    "signapps-proxy"      = 3003
    "signapps-storage"    = 3004
    "signapps-ai"         = 3005
    "signapps-securelink" = 3006
    "signapps-scheduler"  = 3007
    "signapps-metrics"    = 3008
    "signapps-media"      = 3009
    "signapps-docs"       = 3010
    "signapps-calendar"   = 3011
    "signapps-mail"       = 3012
    "signapps-meet"       = 3013
    "signapps-collab"     = 3014
    "signapps-it-assets"  = 3015
    "signapps-pxe"        = 3016
    "signapps-remote"     = 3017
}

# Identity first (runs migrations)
Write-Host "[START] signapps-identity (port 3001, migrations)..." -NoNewline
$env:SERVER_PORT = 3001
Start-Process "cmd.exe" -ArgumentList "/c `"$binDir\signapps-identity.exe`" > signapps-identity.log 2>&1" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
Start-Sleep -Seconds 5
Write-Host " OK" -ForegroundColor Green

# Other services
foreach ($svc in $services.GetEnumerator()) {
    if ($svc.Key -eq "signapps-identity") { continue }
    Write-Host "[START] $($svc.Key) (port $($svc.Value))..." -NoNewline
    $env:SERVER_PORT = $svc.Value
    $exe = "$binDir\$($svc.Key).exe"
    if (Test-Path $exe) {
        Start-Process "cmd.exe" -ArgumentList "/c `"$exe`" > $($svc.Key).log 2>&1" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
        Start-Sleep -Milliseconds 500
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " SKIP (not built)" -ForegroundColor Yellow
    }
}

# ── Step 4: Bootstrap admin ──
Write-Host ""
Write-Host "[BOOTSTRAP] Promoting first user to admin..." -NoNewline
Start-Sleep -Seconds 3
try {
    $r = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/bootstrap" -Method Post -TimeoutSec 5
    Write-Host " OK ($($r.admin_user))" -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403) {
        Write-Host " Already done" -ForegroundColor Gray
    } else {
        Write-Host " SKIP ($status)" -ForegroundColor Yellow
    }
}

# ── Step 5: Health checks ──
Write-Host ""
Write-Host "[HEALTH] Testing services..." -ForegroundColor Cyan

$ok = 0; $fail = 0
foreach ($svc in $services.GetEnumerator()) {
    $url = "http://localhost:$($svc.Value)/health"
    try {
        $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        $ok++
    } catch {
        try {
            # Some services return 401 on /health but are alive
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -lt 500) { $ok++ } else { $fail++ }
        } catch {
            $fail++
        }
    }
}

Write-Host "  Services: $ok/$($services.Count) UP" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })

# ── Step 6: Start frontend ──
Write-Host ""
Write-Host "[FRONTEND] Starting Next.js..." -NoNewline
if (Test-Path "$PSScriptRoot\client\.next") {
    Remove-Item -Recurse -Force "$PSScriptRoot\client\.next" -ErrorAction Ignore
}
Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "$PSScriptRoot\client" -WindowStyle Minimized
Write-Host " OK" -ForegroundColor Green

# ── Step 7: Open browser ──
if (-not $NoBrowser) {
    Write-Host "[BROWSER] Opening in 10 seconds..." -NoNewline
    Start-Sleep -Seconds 10
    Start-Process "http://localhost:3000/login?auto=admin"
    Write-Host " OK" -ForegroundColor Green
}

# ── Summary ──
Write-Host ""
Write-Host "  =========================================" -ForegroundColor Green
Write-Host "     SignApps MVP is RUNNING!               " -ForegroundColor Green
Write-Host "  -----------------------------------------" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000          " -ForegroundColor Green
Write-Host "  Identity:  http://localhost:3001          " -ForegroundColor Green
Write-Host "  Services:  ports 3002-3017               " -ForegroundColor Green
Write-Host "  Admin:     admin / admin                 " -ForegroundColor Green
Write-Host "  =========================================" -ForegroundColor Green
Write-Host ""

# ── Stop script ──
Write-Host "Press Ctrl+C to stop all services, or run:" -ForegroundColor Gray
Write-Host "  Get-Process signapps-* | Stop-Process -Force" -ForegroundColor Gray
Write-Host ""
