Write-Host "Compiling all services first to prevent Cargo lock conflicts..."
$env:SQLX_OFFLINE = "true"
Start-Process "cargo" -ArgumentList "build", "--workspace" -Wait -NoNewWindow

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
    "signapps-collab"     = 3013
}

foreach ($service in $services.GetEnumerator()) {
    Write-Host "Starting $($service.Name) on port $($service.Value)..."
    $env:SERVER_PORT = $service.Value
    Start-Process ".\target\debug\$($service.Name).exe" -WindowStyle Minimized
    Start-Sleep -Milliseconds 500
}

Write-Host "Starting Next.js..."
Start-Process "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "c:\prog\signapps-platform\client" -WindowStyle Minimized
