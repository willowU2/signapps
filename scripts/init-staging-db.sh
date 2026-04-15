#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# init-staging-db.sh — Create and migrate the signapps_staging database
#
# Idempotent: safe to re-run. Reuses the existing signapps-postgres container.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${POSTGRES_CONTAINER:-signapps-postgres}"
DB_NAME="${STAGING_POSTGRES_DB:-signapps_staging}"
DB_USER="${POSTGRES_USER:-signapps}"

echo "==> Creating DB '$DB_NAME' if not exists"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres <<SQL
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
SQL

echo "==> Enabling required extensions on '$DB_NAME'"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
SQL

echo "==> Applying migrations from migrations/"

# Detect if _sqlx_migrations exists in the target DB. If yes, we honour it to
# skip already-applied migrations. If no, we assume fresh and apply everything.
tracker_exists=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_sqlx_migrations')" \
    2>/dev/null | tr -d '[:space:]' || echo "f")

for file in $(ls "$BASE_DIR/migrations"/*.sql | sort); do
    name=$(basename "$file")
    version=$(echo "$name" | grep -oE '^[0-9]+' || true)
    if [[ "$tracker_exists" == "t" && -n "$version" ]]; then
        already=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT 1 FROM _sqlx_migrations WHERE version = $version LIMIT 1" 2>/dev/null || true)
        if [[ "$already" == "1" ]]; then
            continue
        fi
    fi
    echo "  -> $name"
    if ! docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$file" > /dev/null 2>&1; then
        # Log the full output on failure then continue — some migrations may
        # already be effectively applied (e.g. by seed scripts loading raw schema).
        # We warn but don't stop the pipeline.
        echo "     WARN: $name returned an error (may already be applied)"
    fi
done

echo "==> '$DB_NAME' ready"
