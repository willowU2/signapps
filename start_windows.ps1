Write-Host "Arrêt de tous les microservices avant recompilation..."
Get-Process "signapps-*" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Compiling all services first to prevent Cargo lock conflicts..."
Start-Process "cargo" -ArgumentList "build", "--workspace" -Wait -NoNewWindow

Write-Host "Starting microservices..."

Write-Host "Auto-discovery of microservices..."
$portsFile = "$PSScriptRoot\.service_ports.json"
$portMap = @{}
if (Test-Path $portsFile) {
    try {
        $json = Get-Content $portsFile -Raw | ConvertFrom-Json
        $json.psobject.properties | ForEach-Object { $portMap[$_.name] = $_.value }
    } catch {
        Write-Host "Warning: Could not parse $portsFile, creating a new mapping."
    }
} else {
    # Initialize with default legacy ports to ensure smooth transition
    $portMap["signapps-identity"]   = 3001
    $portMap["signapps-containers"] = 3002
    $portMap["signapps-proxy"]      = 3003
    $portMap["signapps-storage"]    = 3004
    $portMap["signapps-ai"]         = 3005
    $portMap["signapps-securelink"] = 3006
    $portMap["signapps-scheduler"]  = 3007
    $portMap["signapps-metrics"]    = 3008
    $portMap["signapps-media"]      = 3009
    $portMap["signapps-docs"]       = 3010
    $portMap["signapps-calendar"]   = 3011
    $portMap["signapps-mail"]       = 3012
    $portMap["signapps-meet"]       = 3013
    $portMap["signapps-collab"]     = 3014
    $portMap["signapps-forms"]      = 3015
    $portMap["signapps-pxe"]        = 3016
    $portMap["signapps-remote"]     = 3017
    $portMap["signapps-office"]     = 3018
    $portMap["signapps-workforce"]  = 3019
    $portMap["signapps-chat"]       = 3020
    $portMap["signapps-contacts"]   = 3021
    $portMap["signapps-it-assets"]  = 3022
}

$nextPort = 3023
if ($portMap.Count -gt 0) {
    $portsCount = ($portMap.Values | Measure-Object -Maximum).Maximum
    if ($portsCount -ge $nextPort) {
        $nextPort = $portsCount + 1
    }
}

$servicesDirs = Get-ChildItem -Path "$PSScriptRoot\services" -Directory | Where-Object { $_.Name -like "signapps-*" }
$envLocalData = ""

$services = @{}

foreach ($dir in $servicesDirs) {
    $name = $dir.Name
    if (-not $portMap.ContainsKey($name)) {
        $portMap[$name] = $nextPort
        Write-Host "New service discovered: $name -> Assigned to port $nextPort"
        $nextPort++
    }
    
    $port = $portMap[$name]
    $services[$name] = $port

    # Compute NEXT_PUBLIC_XXX_URL
    $envNamePart = $name.Replace("signapps-", "").Replace("-", "_").ToUpper()
    $envVarName = "NEXT_PUBLIC_" + $envNamePart + "_URL"
    $envLocalData += "$envVarName=http://localhost:$port/api/v1`r`n"
}

# Save port map safely
$portMap | ConvertTo-Json | Set-Content $portsFile

# Write out the env.local for the Next.js app
Write-Host "Updating Next.js environment variables (client/.env.local)..."
Set-Content "$PSScriptRoot\client\.env.local" $envLocalData

Write-Host "Starting signapps-identity on port 3001 (Priority for DB Migrations)..."
$env:SERVER_PORT = 3001
Start-Process "cmd.exe" -ArgumentList "/c .\target\debug\signapps-identity.exe > signapps-identity.log 2>&1" -WindowStyle Hidden
Write-Host "Waiting 20 seconds for identity migrations to complete..."
Start-Sleep -Seconds 20

foreach ($service in $services.GetEnumerator()) {
    if ($service.Name -eq "signapps-identity") { continue }
    Write-Host "Starting $($service.Name) on port $($service.Value)..."
    $env:SERVER_PORT = $service.Value
    Start-Process "cmd.exe" -ArgumentList "/c .\target\debug\$($service.Name).exe > $($service.Name).log 2>&1" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Write-Host "Vérification si le front-end Next.js est déjà lancé..."
$portListening = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portListening) {
    Write-Host "Le front-end (port 3000) tourne. Arrêt immédiat de Node.js avant de le relancer..."
    taskkill /F /IM "node.exe" /T 2>$null
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