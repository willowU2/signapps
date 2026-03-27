#!/usr/bin/env bash
# pg-backup.sh — IDEA-113
# Daily PostgreSQL backup with 7-day retention using pg_dump.
#
# Environment variables (all optional — fall back to .env or defaults):
#   PGHOST       DB host        (default: localhost)
#   PGPORT       DB port        (default: 5432)
#   PGUSER       DB user        (default: signapps)
#   PGPASSWORD   DB password    (no default — set in .env or PGPASSFILE)
#   PGDATABASE   DB name        (default: signapps)
#   BACKUP_DIR   Output dir     (default: <repo>/data/backups/postgres)
#   RETENTION    Days to keep   (default: 7)
#
# Cron example (daily at 02:00):
#   0 2 * * * /path/to/scripts/pg-backup.sh >> /var/log/signapps-pg-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if present (without overriding already-set vars)
ENV_FILE="$PLATFORM_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-signapps}"
PGDATABASE="${PGDATABASE:-signapps}"
BACKUP_DIR="${BACKUP_DIR:-$PLATFORM_ROOT/data/backups/postgres}"
RETENTION="${RETENTION:-7}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/${PGDATABASE}_${TIMESTAMP}.pg_dump"

log() { echo "[pg-backup $(date -u '+%H:%M:%S')] $*"; }

log "Starting backup of ${PGDATABASE} on ${PGHOST}:${PGPORT}..."

pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --format=custom \
    --compress=6 \
    --file="$BACKUP_FILE" \
    "$PGDATABASE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup complete: ${BACKUP_FILE} (${SIZE})"

# ─── Retention: remove backups older than RETENTION days ───────────────────
log "Pruning backups older than ${RETENTION} days in ${BACKUP_DIR}..."
PRUNED=0
while IFS= read -r -d '' old_backup; do
    rm -f "$old_backup"
    log "Removed: $old_backup"
    (( PRUNED++ )) || true
done < <(find "$BACKUP_DIR" -maxdepth 1 -name "*.pg_dump" -mtime "+${RETENTION}" -print0 2>/dev/null)

log "Pruned ${PRUNED} old backup(s). Done."

# ─── Verify backup integrity ───────────────────────────────────────────────
if command -v pg_restore &>/dev/null; then
    pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1 && \
        log "Integrity check passed." || \
        log "WARNING: Integrity check failed for ${BACKUP_FILE}"
fi
