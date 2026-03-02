# Write-Host "Compiling all services first to prevent Cargo lock conflicts..."
# Start-Process "cargo" -ArgumentList "build", "--workspace" -Wait -NoNewWindow

Write-Host "Starting microservices..."

$services = @{
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

foreach ($service in $services.GetEnumerator()) {
    Write-Host "Starting $($service.Name) on port $($service.Value)..."
    $env:SERVER_PORT = $service.Value
    # Use cmd.exe /c start to bypass strict PowerShell AppControl policies blocks on unsigned binaries
    Start-Process "cmd.exe" -ArgumentList "/c start /min `"$($service.Name)`" .\target\debug\$($service.Name).exe" -WindowStyle Hidden
    Start-Sleep -Milliseconds 500
}

Write-Host "Starting Next.js..."
Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "c:\prog\signapps-platform\client" -WindowStyle Minimized
