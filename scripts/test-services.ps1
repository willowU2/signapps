<#
.SYNOPSIS
    Test all SignApps services before a push.

.DESCRIPTION
    This script builds the project, starts all services, and verifies they are healthy.
    It's designed to be called by the pre-push hook.

.PARAMETER SkipBuild
    Skip the cargo build step (useful if already built).

.PARAMETER SkipFrontend
    Skip starting the frontend.

.PARAMETER Timeout
    Timeout in seconds to wait for services to start (default: 60).

.EXAMPLE
    .\test-services.ps1
    Build and test all services.

.EXAMPLE
    .\test-services.ps1 -SkipBuild
    Test services without rebuilding.
#>

param(
    [switch]$SkipBuild,
    [switch]$SkipFrontend,
    [int]$Timeout = 60
)

$ErrorActionPreference = "Continue"
$BaseDir = (Get-Item $PSScriptRoot).Parent.FullName

# Colors for output
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[..] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[!!] $msg" -ForegroundColor Yellow }

# Service definitions with ports
$Services = @(
    @{ Name = "signapps-identity"; Port = 3001; Required = $true },
    @{ Name = "signapps-containers"; Port = 3002; Required = $false },
    @{ Name = "signapps-proxy"; Port = 3003; Required = $false },
    @{ Name = "signapps-storage"; Port = 3004; Required = $false },
    @{ Name = "signapps-ai"; Port = 3005; Required = $false },
    @{ Name = "signapps-securelink"; Port = 3006; Required = $false },
    @{ Name = "signapps-scheduler"; Port = 3007; Required = $false },
    @{ Name = "signapps-metrics"; Port = 3008; Required = $false },
    @{ Name = "signapps-media"; Port = 3009; Required = $false },
    @{ Name = "signapps-docs"; Port = 3010; Required = $false },
    @{ Name = "signapps-calendar"; Port = 3011; Required = $false },
    @{ Name = "signapps-collab"; Port = 3012; Required = $false }
)

$FrontendPort = 3000

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  SignApps Pre-Push Test" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Step 1: Build (optional)
if (-not $SkipBuild) {
    Write-Info "Building workspace..."
    Push-Location $BaseDir
    $buildOutput = cargo build --workspace 2>&1
    $buildExitCode = $LASTEXITCODE
    Pop-Location

    if ($buildExitCode -ne 0) {
        Write-Fail "Build failed!"
        Write-Host $buildOutput -ForegroundColor Red
        exit 1
    }
    Write-Success "Build completed"
} else {
    Write-Warn "Skipping build"
}

# Step 2: Check if PostgreSQL is running
Write-Info "Checking PostgreSQL..."
$pgRunning = $false
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("127.0.0.1", 5432)
    $tcpClient.Close()
    $pgRunning = $true
    Write-Success "PostgreSQL is running"
} catch {
    Write-Fail "PostgreSQL is not running on port 5432"
    Write-Warn "Some services may fail to start"
}

# Step 3: Kill any existing service processes
Write-Info "Stopping existing services..."
$Services | ForEach-Object {
    $procName = $_.Name -replace "-", "_"
    Get-Process -Name $procName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Step 4: Start services
Write-Info "Starting services..."
$processes = @{}
$logDir = Join-Path $BaseDir "data\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

foreach ($svc in $Services) {
    $binPath = Join-Path $BaseDir "target\debug\$($svc.Name).exe"

    if (-not (Test-Path $binPath)) {
        Write-Warn "Binary not found: $($svc.Name)"
        continue
    }

    $logFile = Join-Path $logDir "$($svc.Name).log"

    try {
        $proc = Start-Process -FilePath $binPath `
            -WorkingDirectory $BaseDir `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError "$logFile.err" `
            -PassThru `
            -WindowStyle Hidden

        $processes[$svc.Name] = @{
            Process = $proc
            Port = $svc.Port
            Required = $svc.Required
        }
        Write-Host "  Started $($svc.Name) (PID: $($proc.Id))" -ForegroundColor Gray
    } catch {
        Write-Warn "Failed to start $($svc.Name): $_"
    }
}

# Step 5: Start frontend (optional)
if (-not $SkipFrontend) {
    Write-Info "Starting frontend..."
    $clientDir = Join-Path $BaseDir "client"

    if (Test-Path $clientDir) {
        $frontendLog = Join-Path $logDir "frontend.log"
        $frontendProc = Start-Process -FilePath "npm" `
            -ArgumentList "run", "dev" `
            -WorkingDirectory $clientDir `
            -RedirectStandardOutput $frontendLog `
            -RedirectStandardError "$frontendLog.err" `
            -PassThru `
            -WindowStyle Hidden

        $processes["frontend"] = @{
            Process = $frontendProc
            Port = $FrontendPort
            Required = $false
        }
        Write-Host "  Started frontend (PID: $($frontendProc.Id))" -ForegroundColor Gray
    }
}

# Step 6: Wait for services to be healthy
Write-Host ""
Write-Info "Waiting for services to be healthy (timeout: ${Timeout}s)..."

$startTime = Get-Date
$healthy = @{}
$failed = @{}

while (((Get-Date) - $startTime).TotalSeconds -lt $Timeout) {
    foreach ($svcName in $processes.Keys) {
        if ($healthy.ContainsKey($svcName) -or $failed.ContainsKey($svcName)) {
            continue
        }

        $svc = $processes[$svcName]
        $port = $svc.Port

        # Check if process is still running
        if ($svc.Process.HasExited) {
            $failed[$svcName] = "Process exited with code $($svc.Process.ExitCode)"
            continue
        }

        # Try to connect to the port
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.Connect("127.0.0.1", $port)
            $tcpClient.Close()
            $healthy[$svcName] = $port
        } catch {
            # Not ready yet
        }
    }

    # Check if all required services are healthy
    $allRequiredHealthy = $true
    foreach ($svc in $Services) {
        if ($svc.Required -and -not $healthy.ContainsKey($svc.Name)) {
            $allRequiredHealthy = $false
            break
        }
    }

    if ($healthy.Count -eq $processes.Count -or $allRequiredHealthy) {
        break
    }

    Start-Sleep -Milliseconds 500
    Write-Host "." -NoNewline
}

Write-Host ""
Write-Host ""

# Step 7: Report results
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$successCount = 0
$failCount = 0

foreach ($svcName in $processes.Keys | Sort-Object) {
    $svc = $processes[$svcName]
    $port = $svc.Port

    if ($healthy.ContainsKey($svcName)) {
        Write-Success "$svcName -> :$port"
        $successCount++
    } elseif ($failed.ContainsKey($svcName)) {
        Write-Fail "$svcName -> $($failed[$svcName])"
        $failCount++
    } else {
        Write-Warn "$svcName -> timeout (port $port)"
        $failCount++
    }
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray

if ($failCount -eq 0) {
    Write-Host "Healthy: $successCount  |  Failed: $failCount" -ForegroundColor Green
} else {
    Write-Host "Healthy: $successCount  |  Failed: $failCount" -ForegroundColor Yellow
}

Write-Host ""

# Step 8: Health check endpoints
if ($healthy.Count -gt 0) {
    Write-Info "Checking health endpoints..."

    foreach ($svcName in $healthy.Keys) {
        $port = $healthy[$svcName]
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "  $svcName /health -> 200 OK" -ForegroundColor Green
            }
        } catch {
            Write-Host "  $svcName /health -> N/A" -ForegroundColor Gray
        }
    }
}

Write-Host ""

# Return exit code
if ($failCount -gt 0) {
    $requiredFailed = $Services | Where-Object { $_.Required -and -not $healthy.ContainsKey($_.Name) }
    if ($requiredFailed) {
        Write-Fail "Required services failed to start!"
        exit 1
    }
}

Write-Success "All required services are healthy!"
exit 0
