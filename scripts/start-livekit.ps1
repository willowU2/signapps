# Start or create the signapps-livekit container.
# Prerequisites: Docker Desktop running, .env has LIVEKIT_API_KEY and LIVEKIT_API_SECRET.
#
# NOTE: On Windows Docker Desktop, the full 50000-60000/udp range triggers
# "bind: An attempt was made to access a socket in a way forbidden by its
# access permissions" because Hyper-V reserves random ports inside that
# window. We therefore expose a smaller 50000-50050/udp range, which is
# enough for dev-scale concurrent tracks (a handful of participants).
# For production on Linux, bump the range back up to 50000-60000/udp.

param(
  [string]$ApiKey = $env:LIVEKIT_API_KEY,
  [string]$ApiSecret = $env:LIVEKIT_API_SECRET
)

if (-not $ApiKey -or -not $ApiSecret) {
  Write-Host "LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set"
  exit 1
}

$existing = docker ps -a --filter "name=signapps-livekit" --format "{{.Names}}"
if ($existing -eq "signapps-livekit") {
  docker start signapps-livekit | Out-Null
  Write-Host "Container signapps-livekit started (existing)"
} else {
  docker run -d --name signapps-livekit `
    -p 7880:7880 -p 7881:7881 `
    -p 50000-50050:50000-50050/udp `
    -e "LIVEKIT_KEYS=$ApiKey`: $ApiSecret" `
    livekit/livekit-server:latest
  Write-Host "Container signapps-livekit created and started"
}
