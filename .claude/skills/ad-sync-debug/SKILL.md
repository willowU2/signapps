---
name: ad-sync-debug
description: Use when AD / LDAP sync fails (bind error, TLS mismatch), when `org_ad_sync_log` fills with `failed` rows, when the bidirectional sync ping-pongs between directory and DB, when the 30 s debounce misfires, or when the per-tenant keystore-decrypted bind password fails to materialise. Covers `AdSyncMode`, conflict strategies and the supervisor loop.
---

# ad-sync-debug

Use this skill when the AD sync supervisor misbehaves — either fails silently, ping-pongs, or never fires at all for a tenant.

## Architecture recap

One supervisor task is spawned per platform process (`spawn_ad_sync_workers` in `services/signapps-org/src/lib.rs`). Every 60 seconds it runs a single pass:

1. Query `SELECT tenant_id FROM org_ad_config WHERE mode != 'off'`.
2. For each tenant, call `AdSyncConfig::load` — which reads `org_ad_config` and **decrypts** `bind_password_enc` via `Keystore::dek("org-ad-bind-password-v1")`.
3. Run `ad::sync::run_cycle(pool, cfg, dry_run=false, Some(&event_bus))`.

`AdSyncMode` is an enum: `Off`, `OrgToAd`, `AdToOrg`, `Bidirectional`. Only `AdToOrg` and `Bidirectional` pull changes into Postgres today — `OrgToAd` is a stub (no outbound LDAP modify) and tracked as a follow-up.

Conflict resolution (`ConflictStrategy`): `PreferOrg`, `PreferAd`, `LastWriteWins`. A **30 s debounce window** protects against ping-pong when a write lands in one source and the other source picks it up on the next cycle.

Every cycle appends one row per change (plus a rollup row for the cycle itself) to `org_ad_sync_log` with status `succeeded | partial | failed`. Diff rows carry the `ad_dn`, the `person_id`, the `change_type` (`added`, `updated`, `deleted`) and the conflict flag.

## Common issues

- **`invalid credentials` on bind** — `bind_password_enc` was re-encrypted under a different master key (keystore rotated without re-encrypting). Re-run the AD config create flow to write a fresh blob; the old one is unrecoverable.
- **`unable to verify cert` on LDAPS** — the target LDAP's CA is not in the platform trust store. Either switch to `ldap://` for dev, or add the CA to `SIGNAPPS_EXTRA_CA_BUNDLE` and restart.
- **Supervisor silent for a tenant** — `mode` is still `off` on the row, OR the row is for a different tenant than the UI displayed. Confirm with the SQL command below.
- **Ping-pong: same user flips every minute** — `debounce_window_sec` in `org_ad_config` is under 30 OR the caller's clock skew is > debounce. Expected log line: `skip: debounce window active`. If absent, the `last_synced_at` column on `org_persons_sync_markers` is NULL — reseed it.
- **`partial` status with no diff** — the cycle hit an empty result set from the `user_filter`. The LDAP filter is almost certainly wrong. Log line: `no users matched user_filter=<filter>`.
- **`keystore DEK not found: org-ad-bind-password-v1`** — the service booted before the master key was available. Check `KEYSTORE_MASTER_KEY` (dev) or the keystore backend env (prod) was set when the platform started.

## Commands

```bash
# Where is the supervisor wired?
rtk grep -n "spawn_ad_sync_workers" services/signapps-org/src

# Enum + config types
rtk grep -n "AdSyncMode" services/signapps-org/src
rtk grep -n "ConflictStrategy" crates/signapps-db/src/models/org

# Recent sync log activity
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT tenant_id, status, change_type, ad_dn, created_at FROM org_ad_sync_log ORDER BY created_at DESC LIMIT 20"

# Per-tenant config without leaking the password
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT tenant_id, mode, ldap_url, bind_dn, base_dn, sync_interval_sec, conflict_strategy FROM org_ad_config"

# Markers for debounce decisions
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT person_id, last_synced_at, last_source FROM org_persons_sync_markers ORDER BY last_synced_at DESC NULLS LAST LIMIT 20"

# Force a dry-run cycle (no writes, surfaces what the loop would do)
# from a scratch bin or inside the AdSyncConfig tests:
# cargo test -p signapps-org --test ad_sync -- --nocapture
```

Service-log snippets to look for:

```
org AD sync supervisor started
ad sync cycle ok     tenant_id=... added=... updated=... deleted=...
ad sync cycle failed tenant_id=... err=...
skip: debounce window active tenant_id=... person_id=...
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-s1-org-rbac-refonte.md` (Tasks 16-21 = W3)
- Product spec: `docs/product-specs/53-org-rbac-refonte.md`
- Code: `services/signapps-org/src/ad/{config,sync}.rs`, `services/signapps-org/src/handlers/ad.rs`
- Migrations: `407_org_ad_sync_log.sql`, `408_org_ad_config.sql`, `410_org_persons_sync_markers.sql`
