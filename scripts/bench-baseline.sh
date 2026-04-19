#!/usr/bin/env bash
# scripts/bench-baseline.sh — record boot time + seed time + login latency.
#
# Usage: bash scripts/bench-baseline.sh
#
# Prints a small report to stdout. Intended to be run after S1+S2+S3 on
# a fresh checkout to capture a reference baseline for future tracks.

set -euo pipefail

echo "=== SignApps Baseline Benchmark ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

# 1) Boot time (runs the dedicated boot test harness).
echo "--- Boot ---"
start=$(date +%s)
cargo test -p signapps-platform --test boot -- --ignored 2>&1 | grep -E "boot elapsed|test result" || true
end=$(date +%s)
echo "Boot (wall): $((end - start))s"
echo

# 2) Seed timing (reset then insert Acme Corp).
echo "--- Seed ---"
start=$(date +%s)
cargo run --bin signapps-seed --release -- --reset >/dev/null 2>&1 || true
end=$(date +%s)
echo "Seed (reset+full): $((end - start))s"
echo

# 3) Login round-trip.
echo "--- Login round-trip (5 samples) ---"
for i in 1 2 3 4 5; do
    t=$(curl -s -w "%{time_total}" -o /dev/null \
        -X POST http://127.0.0.1:3001/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin"}' 2>/dev/null || echo "timeout")
    echo "Login ${i}: ${t}s"
done
