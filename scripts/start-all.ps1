<#
.SYNOPSIS
    Start all SignApps services for development.

.DESCRIPTION
    This script starts all SignApps backend services and the frontend in dev mode.
    It checks PostgreSQL connectivity first, starts services in background,
    monitors their health, and handles graceful shutdown on Ctrl+C.

    Unlike windows-services/start-all.ps1 which manages Windows Services (requires
    Admin + install), this script runs binaries directly -€” ideal for development.

.PARAMETER SkipFrontend
    Do not start the Next.js frontend.

.PARAMETER SkipBuild
    Do not rebuild Rust workspace before starting.

.PARAMETER Release
    Use release binaries (target\release) instead of debug (target\debug).

.PARAMETER Only
    Comma-separated list of service short names to start (e.g. "identity,storage,ai").

.EXAMPLE
    .\start-all.ps1
    Start everything (debug binaries + frontend).

.EXAMPLE
    .\start-all.ps1 -Release -Only "identity,storage,ai"
    Start only selected services using release binaries.
#>

param(
    [switch]$SkipFrontend,
    [switch]$SkipBuild,
    [switch]$Release,
    [string]$Only
)

$ErrorActionPreference = "Continue"
$BaseDir = (Get-Item $PSScriptRoot).Parent.FullName
$BinDir = if ($Release) { Join-Path $BaseDir "target\release" } else { Join-Path $BaseDir "target\debug" }
$LogDir = Join-Path $BaseDir "data\logs"

# -”€-”€ Service registry (port = default from source code) -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
$AllServices = @(
    @{ Short = "identity";      Port = 3001;  Desc = "Auth, LDAP/AD, MFA, RBAC" },
    @{ Short = "containers";    Port = 3002;  Desc = "Docker container lifecycle" },
    @{ Short = "proxy";         Port = 3003;  Desc = "Reverse proxy, TLS/ACME" },
    @{ Short = "storage";       Port = 3004;  Desc = "File storage (OpenDAL)" },
    @{ Short = "ai";            Port = 3005;  Desc = "AI Gateway (RAG, LLM, Vision)" },
    @{ Short = "securelink";    Port = 3006;  Desc = "Web tunnels, DNS" },
    @{ Short = "scheduler";     Port = 3007;  Desc = "CRON job management" },
    @{ Short = "metrics";       Port = 3008;  Desc = "System monitoring, Prometheus" },
    @{ Short = "media";         Port = 3009;  Desc = "STT/TTS/OCR processing" },
    @{ Short = "docs";          Port = 3010;  Desc = "Document editing (Tiptap)" },
    @{ Short = "calendar";      Port = 3011;  Desc = "Calendar & scheduling" },
    @{ Short = "mail";          Port = 3012;  Desc = "Email service" },
    @{ Short = "collab";        Port = 3013;  Desc = "Real-time collaboration" },
    @{ Short = "meet";          Port = 3014;  Desc = "Video conferencing" },
    @{ Short = "forms";         Port = 3015;  Desc = "Form builder & submissions" },
    @{ Short = "pxe";           Port = 3016;  Desc = "PXE network boot" },
    @{ Short = "remote";        Port = 3017;  Desc = "Remote desktop access" },
    @{ Short = "office";        Port = 3018;  Desc = "Office suite (import/export)" },
    @{ Short = "social";        Port = 3019;  Desc = "Social media management" },
    @{ Short = "chat";          Port = 3020;  Desc = "Team messaging & channels" },
    @{ Short = "workforce";     Port = 3019;  Desc = "HR & workforce management" },
    @{ Short = "it-assets";     Port = 3015;  Desc = "IT asset management" },
    @{ Short = "contacts";      Port = 3014;  Desc = "Contact management" },
    @{ Short = "backup";        Port = 3031;  Desc = "Database & file backup management" },
    @{ Short = "notifications"; Port = 8095;  Desc = "Push notifications" },
    @{ Short = "billing";       Port = 8096;  Desc = "Billing & invoicing" },
    @{ Short = "gateway";       Port = 3099;  Desc = "API gateway (aggregator)" }
)

# -”€-”€ Filter services if --Only is set -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
if ($Only) {
    $selected = $Only -split "," | ForEach-Object { $_.Trim() }
    $Services = $AllServices | Where-Object { $selected -contains $_.Short }
    if ($Services.Count -eq 0) {
        Write-Host "ERROR: No services matched '$Only'" -ForegroundColor Red
        Write-Host "Available: $($AllServices | ForEach-Object { $_.Short } | Join-String -Separator ', ')" -ForegroundColor Yellow
        exit 1
    }
} else {
    # Default: start core services (skip those that share ports by default)
    $Services = $AllServices | Where-Object {
        $_.Short -notin @("it-assets", "workforce", "contacts")
    }
}

# -”€-”€ Helpers -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
function Write-Ok    { param($msg) Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "  [..]   $msg" -ForegroundColor Cyan }
function Write-Warn  { param($msg) Write-Host "  [!!]   $msg" -ForegroundColor Yellow }

function Test-TcpPort {
    param([int]$Port, [int]$TimeoutMs = 1000)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $result = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($success) { $tcp.EndConnect($result) }
        $tcp.Close()
        return $success
    } catch { return $false }
}

# -”€-”€ Banner -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
Write-Host ""
Write-Host "  -•”-•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•—" -ForegroundColor Magenta
Write-Host "  -•‘       SignApps Platform -€” Start All      -•‘" -ForegroundColor Magenta
Write-Host "  -•š-•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•-" -ForegroundColor Magenta
Write-Host ""

# -”€-”€ Step 1: Check PostgreSQL -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
Write-Host "  Checking prerequisites..." -ForegroundColor White
if (Test-TcpPort -Port 5432) {
    Write-Ok "PostgreSQL is running on port 5432"
} else {
    Write-Fail "PostgreSQL is NOT running on port 5432"
    Write-Warn "Services that need a database will fail to start."
    Write-Host ""
}

# -”€-”€ Step 2: Build (optional) -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "  Building workspace..." -ForegroundColor White
    $buildArgs = if ($Release) { "build --workspace --release" } else { "build --workspace" }
    $buildResult = Start-Process -FilePath "cargo" -ArgumentList $buildArgs -WorkingDirectory $BaseDir -Wait -NoNewWindow -PassThru
    if ($buildResult.ExitCode -ne 0) {
        Write-Fail "Build failed (exit code $($buildResult.ExitCode))"
        exit 1
    }
    Write-Ok "Build succeeded"
}

# -”€-”€ Step 3: Ensure log directory -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

# -”€-”€ Step 4: Register Ctrl+C handler -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
$script:ChildProcesses = @()
$script:Stopping = $false

function Stop-AllServices {
    if ($script:Stopping) { return }
    $script:Stopping = $true
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow

    foreach ($p in $script:ChildProcesses) {
        if (-not $p.HasExited) {
            try {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }

    # Also kill any leftover node (frontend)
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try { $_.MainModule.FileName -like "*client*" } catch { $false }
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "  All services stopped." -ForegroundColor Green
}

# Trap Ctrl+C
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Stop-AllServices }

# -”€-”€ Step 5: Start backend services -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
Write-Host ""
Write-Host "  Starting services..." -ForegroundColor White
Write-Host "  -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€" -ForegroundColor DarkGray

$startedServices = @()

foreach ($svc in $Services) {
    $exeName = "signapps-$($svc.Short).exe"
    $exePath = Join-Path $BinDir $exeName

    if (-not (Test-Path $exePath)) {
        Write-Warn "$($svc.Short) -€” binary not found ($exeName)"
        continue
    }

    # Check if port is already in use
    if (Test-TcpPort -Port $svc.Port -TimeoutMs 300) {
        Write-Warn "$($svc.Short) -€” port $($svc.Port) already in use, skipping"
        continue
    }

    $logFile = Join-Path $LogDir "signapps-$($svc.Short).log"
    $errFile = Join-Path $LogDir "signapps-$($svc.Short).err.log"

    try {
        $proc = Start-Process -FilePath $exePath -WorkingDirectory $BaseDir -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru -WindowStyle Hidden

        $script:ChildProcesses += $proc
        $startedServices += @{ Short = $svc.Short; Port = $svc.Port; Desc = $svc.Desc; Proc = $proc }
        Write-Host "  Started " -NoNewline -ForegroundColor DarkGray
        Write-Host "signapps-$($svc.Short)" -NoNewline -ForegroundColor Cyan
        Write-Host " (PID $($proc.Id), port $($svc.Port))" -ForegroundColor DarkGray
    } catch {
        Write-Fail "$($svc.Short) -€” failed to start: $_"
    }
}

# -”€-”€ Step 6: Start frontend -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
if (-not $SkipFrontend) {
    Write-Host ""
    Write-Host "  Starting frontend..." -ForegroundColor White

    $clientDir = Join-Path $BaseDir "client"
    if (Test-Path $clientDir) {
        $frontLog = Join-Path $LogDir "frontend.log"
        $frontErr = Join-Path $LogDir "frontend.err.log"

        $frontProc = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $clientDir -RedirectStandardOutput $frontLog -RedirectStandardError $frontErr -PassThru -WindowStyle Hidden

        $script:ChildProcesses += $frontProc
        Write-Host "  Started " -NoNewline -ForegroundColor DarkGray
        Write-Host "frontend" -NoNewline -ForegroundColor Cyan
        Write-Host " (PID $($frontProc.Id), port 3000)" -ForegroundColor DarkGray
    } else {
        Write-Warn "client/ directory not found"
    }
}

# -”€-”€ Step 7: Wait for services to become healthy -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
Write-Host ""
Write-Host "  Waiting for services to become healthy..." -ForegroundColor White

$timeout = 30
$startTime = Get-Date
$healthy = @{}

while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
    foreach ($svc in $startedServices) {
        if ($healthy.ContainsKey($svc.Short)) { continue }
        if ($svc.Proc.HasExited) { continue }
        if (Test-TcpPort -Port $svc.Port -TimeoutMs 300) {
            $healthy[$svc.Short] = $true
        }
    }

    # Also check frontend
    if (-not $SkipFrontend -and -not $healthy.ContainsKey("frontend")) {
        if (Test-TcpPort -Port 3000 -TimeoutMs 300) {
            $healthy["frontend"] = $true
        }
    }

    $totalExpected = $startedServices.Count + $(if ($SkipFrontend) { 0 } else { 1 })
    if ($healthy.Count -ge $totalExpected) { break }

    Start-Sleep -Milliseconds 500
    Write-Host "." -NoNewline -ForegroundColor DarkGray
}

Write-Host ""

# -”€-”€ Step 8: Status report -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
Write-Host ""
Write-Host "  -•”-•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•—" -ForegroundColor Cyan
Write-Host "  -•‘           Service Status                 -•‘" -ForegroundColor Cyan
Write-Host "  -•š-•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•--•-" -ForegroundColor Cyan
Write-Host ""

$okCount = 0
$failCount = 0

foreach ($svc in $startedServices) {
    $status = if ($svc.Proc.HasExited) {
        $failCount++
        "EXITED (code $($svc.Proc.ExitCode))"
    } elseif ($healthy.ContainsKey($svc.Short)) {
        $okCount++
        "OK"
    } else {
        $failCount++
        "TIMEOUT"
    }

    $color = if ($status -eq "OK") { "Green" } else { "Red" }
    $portStr = ":$($svc.Port)"
    Write-Host ("  {0,-22} {1,-8} {2,-10} {3}" -f "signapps-$($svc.Short)", $portStr, $status, $svc.Desc) -ForegroundColor $color
}

if (-not $SkipFrontend) {
    $frontStatus = if ($healthy.ContainsKey("frontend")) { $okCount++; "OK" } else { $failCount++; "TIMEOUT" }
    $color = if ($frontStatus -eq "OK") { "Green" } else { "Red" }
    Write-Host ("  {0,-22} {1,-8} {2,-10} {3}" -f "frontend", ":3000", $frontStatus, "Next.js dev server") -ForegroundColor $color
}

Write-Host ""
Write-Host "  -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€" -ForegroundColor DarkGray
Write-Host "  Healthy: $okCount  |  Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($okCount -gt 0) {
    Write-Host "  Open http://localhost:3000 to access SignApps" -ForegroundColor Green
    Write-Host "  Logs: $LogDir" -ForegroundColor DarkGray
    Write-Host ""
}

# -”€-”€ Step 9: Keep alive until Ctrl+C -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€
Write-Host "  Press Ctrl+C to stop all services..." -ForegroundColor DarkGray
Write-Host ""

while (-not $script:Stopping) {
    Start-Sleep -Seconds 2

    # Check if any critical service crashed
    foreach ($svc in $startedServices) {
        if ($svc.Proc.HasExited -and $healthy.ContainsKey($svc.Short)) {
            Write-Warn "signapps-$($svc.Short) crashed (exit code $($svc.Proc.ExitCode))"
            $healthy.Remove($svc.Short)
        }
    }
}

# -”€-”€ End Keep alive -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€


