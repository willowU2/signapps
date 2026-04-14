#!/usr/bin/env bash
#
# Orchestrate the OAuth token migration.
#
# Steps:
#   1. Stop services (so no writes happen during migration).
#   2. Backup the DB.
#   3. Apply migration 303 (BYTEA columns) — idempotent if already applied.
#   4. Run oauth-migrate-encrypt to populate ciphertexts.
#   5. Run oauth-migrate-verify to confirm.
#   6. Restart services.
#
# Requires: KEYSTORE_MASTER_KEY + DATABASE_URL in env (sourced from .env).
#
# Usage:
#   bash scripts/migrate-oauth-tokens.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# Source .env to pick up KEYSTORE_MASTER_KEY + DATABASE_URL
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

if [ -z "${KEYSTORE_MASTER_KEY:-}" ]; then
    echo "ERROR: KEYSTORE_MASTER_KEY not set" >&2
    exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL not set" >&2
    exit 1
fi

echo "[1/6] Stopping services..."
if [ -x scripts/stop-all.sh ]; then
    bash scripts/stop-all.sh 2>&1 | tail -5 || true
else
    echo "  (scripts/stop-all.sh not found - skipping. Stop manually if services are running.)"
fi

echo "[2/6] Backing up database..."
mkdir -p backups
backup_file="backups/pre-oauth-encrypt-$(date +%Y%m%d-%H%M%S).sql.gz"
if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" | gzip > "$backup_file"
elif command -v docker >/dev/null 2>&1; then
    docker exec signapps-postgres pg_dump -U signapps signapps | gzip > "$backup_file"
else
    echo "  WARNING: no pg_dump or docker available - skipping backup. THIS IS RISKY."
    backup_file=""
fi
[ -n "$backup_file" ] && [ -f "$backup_file" ] && echo "  backup: $backup_file"

echo "[3/6] Applying migration 303 (idempotent)..."
if command -v just >/dev/null 2>&1; then
    just db-migrate 2>&1 | tail -5 || echo "  (db-migrate may have errored on prior tracking - falling back to direct apply below)"
fi
if command -v docker >/dev/null 2>&1; then
    docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/303_oauth_token_encryption.sql 2>&1 | tail -5 || true
fi

echo "[4/6] Encrypting existing tokens..."
cargo run --release --bin oauth-migrate-encrypt 2>&1 | tail -10

echo "[5/6] Verifying..."
cargo run --release --bin oauth-migrate-verify 2>&1 | tail -10

echo "[6/6] Restarting services..."
if [ -x scripts/start-all.sh ]; then
    bash scripts/start-all.sh 2>&1 | tail -10
else
    echo "  (scripts/start-all.sh not found - start services manually.)"
fi

echo "OK migration complete"
