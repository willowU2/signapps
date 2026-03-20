#!/usr/bin/env pwsh
# SignApps Platform — Stop All Services

Write-Host "Stopping all SignApps services..." -ForegroundColor Yellow

# Stop backend services
Get-Process | Where-Object { $_.ProcessName -like "signapps-*" } | ForEach-Object {
    Write-Host "  Stopping $($_.ProcessName) (PID $($_.Id))..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Stop Next.js dev server on port 3000
$tcpconns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
foreach ($conn in $tcpconns) {
    if ($conn.State -eq "Listen") {
        Write-Host "  Stopping process on port 3000 (PID $($conn.OwningProcess))..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2
Write-Host "All services stopped." -ForegroundColor Green
