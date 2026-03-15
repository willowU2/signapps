#!/usr/bin/env pwsh
# SignApps Platform — Stop All Services

Write-Host "Stopping all SignApps services..." -ForegroundColor Yellow

# Stop backend services
Get-Process | Where-Object { $_.ProcessName -like "signapps-*" } | ForEach-Object {
    Write-Host "  Stopping $($_.ProcessName) (PID $($_.Id))..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Stop Next.js dev server
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*next*" -or $_.CommandLine -like "*3000*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2
Write-Host "All services stopped." -ForegroundColor Green
