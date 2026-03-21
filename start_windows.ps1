# Write-Host "Compiling all services first to prevent Cargo lock conflicts..."
# Start-Process "cargo" -ArgumentList "build", "--workspace" -Wait -NoNewWindow

Write-Host "Starting microservices..."

$services = @{
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

Write-Host "Starting signapps-identity on port 3001 (Priority for DB Migrations)..."
$env:SERVER_PORT = 3001
Start-Process "cmd.exe" -ArgumentList "/c .\target\debug\signapps-identity.exe > signapps-identity.log 2>&1" -WindowStyle Hidden
Write-Host "Waiting 5 seconds for identity migrations to complete..."
Start-Sleep -Seconds 5

foreach ($service in $services.GetEnumerator()) {
    Write-Host "Starting $($service.Name) on port $($service.Value)..."
    $env:SERVER_PORT = $service.Value
    Start-Process "cmd.exe" -ArgumentList "/c .\target\debug\$($service.Name).exe > $($service.Name).log 2>&1" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Write-Host "Cleaning Next.js Cache to prevent HMR/Turbopack dev bugs..."
if (Test-Path "$PSScriptRoot\client\.next") {
    Remove-Item -Recurse -Force "$PSScriptRoot\client\.next" -ErrorAction Ignore
}

Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "$PSScriptRoot\client" -WindowStyle Minimized

Write-Host "Waiting for Next.js to start..."
Start-Sleep -Seconds 12

Write-Host "Opening application in browser with auto-login..."
Start-Process "http://localhost:3000/login?auto=admin"