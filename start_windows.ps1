Write-Host "Compiling all services first to prevent Cargo lock conflicts..."
$env:SQLX_OFFLINE = "true"
Start-Process "cargo" -ArgumentList "build", "--workspace" -Wait -NoNewWindow

Write-Host "Starting Identity..."
$env:SERVER_PORT = "3001"
Start-Process ".\target\debug\signapps-identity.exe" -WindowStyle Minimized
Start-Sleep -Seconds 1

Write-Host "Starting Calendar..."
$env:SERVER_PORT = "3011"
Start-Process ".\target\debug\signapps-calendar.exe" -WindowStyle Minimized
Start-Sleep -Seconds 1

Write-Host "Starting Docs..."
$env:SERVER_PORT = "3010"
Start-Process ".\target\debug\signapps-docs.exe" -WindowStyle Minimized
Start-Sleep -Seconds 1

Write-Host "Starting Storage..."
$env:SERVER_PORT = "3004"
Start-Process ".\target\debug\signapps-storage.exe" -WindowStyle Minimized
Start-Sleep -Seconds 1

Write-Host "Starting Mail..."
$env:SERVER_PORT = "3005"
Start-Process ".\target\debug\signapps-mail.exe" -WindowStyle Minimized
Start-Sleep -Seconds 1

Write-Host "Starting Next.js..."
Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "c:\prog\signapps-platform\client" -WindowStyle Minimized
