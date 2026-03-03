# ==============================================================================
# SignApps Platform - E2E Testing Prerequisites Automation
# Automatically starts missing backend services and databases before testing
# ==============================================================================

Write-Host "========================================="
Write-Host "🚀 Checking E2E Testing Prerequisites..."
Write-Host "========================================="

# 1. Check PostgreSQL Database (Docker)
Write-Host "[1/4] Verifying PostgreSQL Database..."
$pgRunning = docker ps --filter "name=signapps-postgres" --filter "status=running" -q
if (-not $pgRunning) {
    Write-Host "⚠️ PostgreSQL container not running. Starting..."
    # Check if container exists but is stopped
    $pgExists = docker ps -a --filter "name=signapps-postgres" -q
    if ($pgExists) {
        docker start signapps-postgres | Out-Null
    }
    else {
        docker run --name signapps-postgres -e POSTGRES_USER=signapps -e POSTGRES_PASSWORD=signapps_dev -e POSTGRES_DB=signapps -p 5432:5432 -d postgres:16 | Out-Null
    }
    Start-Sleep -Seconds 3 # Wait for DB to init
    Write-Host "✅ PostgreSQL started successfully."
}
else {
    Write-Host "✅ PostgreSQL is already running."
}

# 2. Check Next.js Frontend
Write-Host "[2/4] Verifying Next.js Frontend (Port 3000)..."
$frontendUp = $false
try {
    # Check if port is bound locally instead of HTTP ping to avoid Next.js compilation timeouts
    $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
    $frontendUp = $true
}
catch {
    $frontendUp = $false
}

if (-not $frontendUp) {
    Write-Host "⚠️ Next.js not detected on Port 3000. Starting..."
    Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory ".\client" -WindowStyle Minimized
    Write-Host "⏳ Waiting for Next.js to compile and bind PORT 3000 (This may take up to 60s)..."
    
    $ready = $false
    $retries = 0
    while (-not $ready -and $retries -lt 30) {
        try {
            $testConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
            $ready = $true
        }
        catch {
            Start-Sleep -Seconds 2
            $retries++
            Write-Host -NoNewline "."
        }
    }
    Write-Host ""
    if ($ready) {
        Write-Host "✅ Next.js started in background and port 3000 is open."
    }
    else {
        Write-Host "❌ FATAL: Next.js failed to bind port 3000 within 60 seconds."
        exit 1
    }
}
else {
    Write-Host "✅ Next.js is already running on Port 3000."
}

# 3. Check Cargo Backend Services
Write-Host "[3/4] Verifying Cargo Backend APIs..."
$services = @{
    "signapps-identity"   = 3001
    "signapps-containers" = 3002
    "signapps-ai"         = 3005
}

foreach ($service in $services.GetEnumerator()) {
    $serviceUp = $false
    try {
        # Check if port is bound locally
        $connection = Get-NetTCPConnection -LocalPort $service.Value -State Listen -ErrorAction Stop
        $serviceUp = $true
    }
    catch {
        $serviceUp = $false
    }

    if (-not $serviceUp) {
        Write-Host "⚠️ $($service.Name) not running on Port $($service.Value). Starting..."
        $env:SERVER_PORT = $service.Value
        Start-Process "cmd.exe" -ArgumentList "/c start /min `"$($service.Name)`" cargo run -p $($service.Name)" -WindowStyle Hidden
        Start-Sleep -Seconds 5 # Wait for cargo compilation/launch
        Write-Host "✅ $($service.Name) started."
    }
    else {
        Write-Host "✅ $($service.Name) is already running."
    }
}

# 4. Wait for Identity to propagate
Write-Host "[4/4] Validating overall system health..."
Start-Sleep -Seconds 3
$identityHealth = $false
try {
    # 401 Unauthorized is expected for /health if not logged in, but it proves the API is alive!
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    $identityHealth = $true
}
catch {
    # If it's a 4xx error, the service is still physically responding
    if ($_.Exception.Response.StatusCode) {
        $identityHealth = $true
    }
}

if ($identityHealth) {
    Write-Host "✅ Identity API is responsive!"
}
else {
    Write-Host "❌ WARNING: Identity API did not respond. Tests may fail."
}

Write-Host "========================================="
Write-Host "🌐 Environment Ready! Launching Playwright..."
Write-Host "========================================="
Set-Location .\client
npx playwright test

