#!/usr/bin/env bash
# rotate-logs.sh — IDEA-112
# Auto-truncate SignApps log files larger than LOG_MAX_MB (default 10 MB).
# Safe to run while services are running (truncates in-place; does NOT unlink).
#
# Usage:
#   ./scripts/rotate-logs.sh              # truncate logs > 10 MB in $PLATFORM_ROOT
#   LOG_MAX_MB=5 ./scripts/rotate-logs.sh # custom threshold
#   DRY_RUN=1 ./scripts/rotate-logs.sh   # preview only

set -euo pipefail

PLATFORM_ROOT="${PLATFORM_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_MAX_MB="${LOG_MAX_MB:-10}"
DRY_RUN="${DRY_RUN:-0}"

MAX_BYTES=$(( LOG_MAX_MB * 1024 * 1024 ))
ROTATED=0
SKIPPED=0

log() { echo "[rotate-logs] $*"; }

log "Scanning ${PLATFORM_ROOT} for log files > ${LOG_MAX_MB} MB..."

while IFS= read -r -d '' logfile; do
    size=$(stat -c%s "$logfile" 2>/dev/null || stat -f%z "$logfile" 2>/dev/null || echo 0)

    if (( size > MAX_BYTES )); then
        size_mb=$(awk "BEGIN { printf \"%.1f\", $size / 1048576 }")
        if [[ "$DRY_RUN" == "1" ]]; then
            log "DRY RUN: would truncate ${logfile} (${size_mb} MB)"
        else
            # Append a rotation marker before truncating so audit trail is clear.
            echo "" >> "$logfile"
            echo "=== LOG ROTATED at $(date -u '+%Y-%m-%dT%H:%M:%SZ') (was ${size_mb} MB) ===" >> "$logfile"
            # Truncate in place — running processes keep their file descriptors.
            truncate -s 0 "$logfile"
            log "Truncated: ${logfile} (was ${size_mb} MB)"
        fi
        (( ROTATED++ )) || true
    else
        (( SKIPPED++ )) || true
    fi
done < <(find "$PLATFORM_ROOT" -maxdepth 2 -name "*.log" -print0 2>/dev/null)

log "Done — rotated: ${ROTATED}, skipped: ${SKIPPED}"
