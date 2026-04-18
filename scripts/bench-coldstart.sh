#!/usr/bin/env bash
# Benchmark the cold-start time of the SignApps single-binary.
#
# Requires Postgres running on localhost:5432 and the env vars
# DATABASE_URL, JWT_SECRET, KEYSTORE_MASTER_KEY set.
#
# Exit code 0 if boot < 3s; non-zero otherwise.

set -euo pipefail

echo "[stop] killing leftover signapps-* processes"
powershell.exe -Command "Get-Process signapps-* -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.Id -Force }" 2>/dev/null || true
sleep 1

BIN="target/debug/signapps-platform.exe"
if [ ! -x "$BIN" ]; then
    echo "[build] cargo build -p signapps-platform"
    cargo build -p signapps-platform
fi

# Test-mode env toggles (off = skip privileged / external deps)
export PROXY_ENABLED=${PROXY_ENABLED:-false}
export PXE_ENABLE_TFTP=${PXE_ENABLE_TFTP:-false}
export PXE_ENABLE_PROXY_DHCP=${PXE_ENABLE_PROXY_DHCP:-false}
export PXE_ENABLE_DC=${PXE_ENABLE_DC:-false}
export MAIL_PROTOCOLS_ENABLED=${MAIL_PROTOCOLS_ENABLED:-false}
export CONTAINERS_ENABLED=${CONTAINERS_ENABLED:-false}
export DEPLOY_API_ENABLED=${DEPLOY_API_ENABLED:-false}
export SCHEDULER_TICK_ENABLED=${SCHEDULER_TICK_ENABLED:-false}

echo "[start] single-binary cold"
start=$(date +%s%3N)
"$BIN" >/tmp/platform.log 2>&1 &
pid=$!

# Wait for gateway /health to respond
deadline=$(($(date +%s) + 30))
while ! curl -fsS http://localhost:3099/health >/dev/null 2>&1; do
    if [ "$(date +%s)" -gt "$deadline" ]; then
        echo "[fail] timed out waiting for :3099/health" >&2
        kill "$pid" 2>/dev/null || true
        exit 1
    fi
    sleep 0.05
done
end=$(date +%s%3N)
elapsed=$((end - start))
kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true

echo "[result] ready in ${elapsed} ms"
if [ "$elapsed" -lt 3000 ]; then
    echo "[pass] < 3s target met"
else
    echo "[fail] expected < 3000 ms, got $elapsed ms" >&2
    exit 1
fi
