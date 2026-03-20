Write-Host "Stopping Identity and Storage services..."

Stop-Process -Name signapps-identity -Force -ErrorAction SilentlyContinue
Stop-Process -Name signapps-storage -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

Write-Host "Building Identity and Storage..."
cargo build -p signapps-identity -p signapps-storage

$env:SERVER_PORT = 3001
Start-Process "cmd.exe" -ArgumentList "/c .\target\debug\signapps-identity.exe > signapps-identity.log 2>&1" -WindowStyle Hidden

Write-Host "Waiting 5 seconds for Identity migrations to complete..."
Start-Sleep -Seconds 5

$env:SERVER_PORT = 3004
Start-Process "cmd.exe" -ArgumentList "/c .\target\debug\signapps-storage.exe > signapps-storage.log 2>&1" -WindowStyle Hidden

Write-Host "Services built and restarted successfully!"
