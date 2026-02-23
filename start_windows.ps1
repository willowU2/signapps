Write-Host "Starting Identity..."
Start-Process "cargo" -ArgumentList "run", "-p", "signapps-identity" -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host "Starting Calendar..."
Start-Process "cargo" -ArgumentList "run", "-p", "signapps-calendar" -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host "Starting Docs..."
Start-Process "cargo" -ArgumentList "run", "-p", "signapps-docs" -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host "Starting Storage..."
Start-Process "cargo" -ArgumentList "run", "-p", "signapps-storage" -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host "Starting Mail..."
Start-Process "cargo" -ArgumentList "run", "-p", "signapps-mail" -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host "Starting Next.js..."
Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "c:\prog\signapps-platform\client" -WindowStyle Minimized
