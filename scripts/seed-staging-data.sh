#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# seed-staging-data.sh — Populate signapps_staging with demo/anonymized data
#
# Targets the signapps_staging DB (created by init-staging-db.sh).
# Prefers the Rust seed binary (tools/signapps-seed) if available,
# falls back to the shell script scripts/seed-demo-data.sh.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export DATABASE_URL="${STAGING_DATABASE_URL:-postgres://signapps:signapps_dev@127.0.0.1:5432/signapps_staging}"
export SIGNAPPS_ENV="dev"

# Mode passed to the Rust seed binary (minimal | acme | startup | chaos | full)
SEED_MODE="${SEED_MODE:-full}"

echo "==> Seeding $DATABASE_URL"
echo "==> SIGNAPPS_ENV=$SIGNAPPS_ENV  SEED_MODE=$SEED_MODE"

# Discover available seed tools. The Rust crate is preferred.
SEED_CRATE=""
if [ -d "$BASE_DIR/tools/signapps-seed" ]; then
    SEED_CRATE="signapps-seed"
elif [ -d "$BASE_DIR/tools/signapps-test-seed" ]; then
    SEED_CRATE="signapps-test-seed"
elif [ -d "$BASE_DIR/crates/signapps-seed" ]; then
    SEED_CRATE="signapps-seed"
fi

if [ -n "$SEED_CRATE" ]; then
    echo "==> Using Rust seed binary: $SEED_CRATE (mode=$SEED_MODE)"
    # NOTE: The signapps-seed CLI uses --mode/--database-url/--reset/--verify,
    # not --env. DATABASE_URL env var is picked up automatically by clap.
    if ! cargo run --release -q -p "$SEED_CRATE" -- --mode "$SEED_MODE" --verify 2>&1; then
        echo "WARN: Rust seed failed, falling back to shell script"
        SEED_CRATE=""
    fi
fi

if [ -z "$SEED_CRATE" ]; then
    if [ -x "$BASE_DIR/scripts/seed-demo-data.sh" ] || [ -f "$BASE_DIR/scripts/seed-demo-data.sh" ]; then
        echo "==> Using shell seed script scripts/seed-demo-data.sh"
        bash "$BASE_DIR/scripts/seed-demo-data.sh"
    else
        echo "ERROR: no seed tool available — neither Rust crate nor seed-demo-data.sh"
        exit 1
    fi
fi

echo "==> Staging seed complete"
