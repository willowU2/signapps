#!/usr/bin/env bash
# scripts/health-audit.sh — measure /health latency on every SignApps service.
#
# Usage: just audit-health   OR   bash scripts/health-audit.sh
#
# Relies on curl and awk. Each service is pinged with a 1s timeout and
# the result printed as a pipe-separated table. Exit code is 0 even when
# services are DOWN — the script is an audit, not a gate.

set -euo pipefail

# Keep this list in sync with scripts/ports.json (non-staging entries).
PORTS=(
    3001 3002 3003 3004 3005 3006 3007 3008 3009 3010
    3011 3012 3014 3015 3016 3019 3020 3021 3022 3024
    3025 3026 3027 3028 3029 3030 3031 3032 3033 3034
    3099 3700 8095 8096
)

echo "Port | Time (ms) | Status"
echo "-----|-----------|-------"

for port in "${PORTS[@]}"; do
    t=$(curl -o /dev/null -s -w "%{time_total}" -m 1 \
        "http://127.0.0.1:${port}/health" 2>/dev/null || echo "TIMEOUT")

    if [[ "$t" == "TIMEOUT" || -z "$t" ]]; then
        status="DOWN"
        ms="—"
    else
        ms=$(awk -v t="$t" 'BEGIN { printf "%.1f", t * 1000 }')
        status="UP"
    fi
    printf "%4s | %9s | %s\n" "$port" "$ms" "$status"
done
