---
name: backups-debug
description: Debug skill for the Backups module. Uses signapps-containers port 3002 for backup orchestration. Covers database backups, file backups, scheduled backups, and restore operations.
---

# Backups — Debug Skill

## Source of truth

**`docs/product-specs/35-backups.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-containers/` — port **3002** (backup orchestration via Docker/bollard)
- **Handlers**: `services/signapps-containers/src/handlers/backup*`
- **Storage**: backups stored via `signapps-storage` (3004) — local FS or S3
- **Scheduling**: cron-based via internal scheduler or OS crontab

### Frontend (Next.js)
- **Pages**: `client/src/app/backups/` (backup list, schedule, restore)
- **Components**: `client/src/components/backups/`
- **API client**: `client/src/lib/api/backups.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `backups-root` | Backups page container |
| `backup-{id}` | Backup entry row |
| `backup-create-btn` | Trigger manual backup |
| `backup-restore-{id}` | Restore button |
| `backup-schedule-form` | Schedule configuration |
| `backup-status-{id}` | Backup status badge |

## Key E2E journeys

1. **Manual backup** — trigger backup, verify appears in list with "completed" status
2. **Scheduled backup** — configure daily schedule, verify next run time displayed
3. **Restore from backup** — select backup, restore, verify data integrity
4. **Download backup** — download backup file, verify non-empty archive

## Common bug patterns

1. **Backup timeout** — large databases exceed request timeout; needs async job with polling
2. **Disk space exhaustion** — no retention policy deleting old backups
3. **Restore overwrites** — restore operation replaces current data without confirmation prompt

## Dependencies (license check)

- **bollard** (Docker API) — Apache-2.0
- **Backend**: axum, sqlx — MIT/Apache-2.0
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
