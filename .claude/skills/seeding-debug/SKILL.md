# Seeding Demo Debug Skill

Use this skill when the user asks about `signapps-seed` failures, missing
or duplicated Acme Corp demo data, cross-service inconsistencies, or
when the idempotence contract is violated.

## Quick diagnosis flow

1. **Check `DATABASE_URL`** — must be localhost / 127.0.0.1 or
   `SEED_ALLOW_PROD=1` must be set.
   ```bash
   echo $DATABASE_URL
   ```
   If the URL is remote and `SEED_ALLOW_PROD` is unset, `run_seed`
   aborts with a descriptive error — this is intended.

2. **Check migrations are applied** — seeders assume S1 migrations
   (`org_nodes`, `org_persons`, `org_ad_config`, `pxe.*`) ran.
   ```bash
   just db-migrate
   rtk docker exec signapps-postgres psql -U signapps -d signapps \
       -c "\dt org_*"
   ```
   If a table is missing, the seeder logs a warning and skips — the
   pipeline continues. The missing table is the root cause.

3. **Verbose run**
   ```bash
   RUST_LOG=info,signapps_seed=debug,sqlx=warn just db-seed
   ```
   Every seeder logs `created=N skipped=M errors=K`. Non-zero `errors`
   point at FK violations or column mismatches.

4. **Dry run** (no writes, just connects and validates)
   ```bash
   just db-seed-dry
   ```

5. **Re-run idempotence check**
   ```bash
   cargo test -p signapps-seed --test test_idempotent
   ```
   Expected: `1 passed`. Fails if any seeder adds rows on the second
   run (broken `ON CONFLICT` or missing deterministic UUID).

## Common issues

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `relation "org_nodes" does not exist` | S1 migrations not applied | `just db-migrate` first |
| `duplicate key value violates unique constraint "tenants_slug_key"` | Legacy tenant row with different UUID | lib.rs `resolve_or_create_tenant` now handles this — pull latest |
| `org_nodes created under one tenant_id, users under another` | Mismatch between deterministic UUID and pre-existing slug row | Run `just db-seed-reset` (drops Acme data then reseeds) |
| `second run creates rows` | Seeder missing `ON CONFLICT DO NOTHING` or using `gen_random_uuid()` | Replace with `acme_uuid(kind, key)` + explicit `id` column in INSERT |
| PXE wizard demo asset not found | PxeSeeder runs after identity — FK ok. Check `pxe.assets` directly | `psql -c "SELECT mac_address, hostname FROM pxe.assets"` |
| `docs.documents.doc_binary` constraint violation | Insert needs at least 1 byte of Yjs state | We insert `vec![0u8]` — any modification must keep it non-NULL |
| `marie.dupont` password doesn't work | User expects `admin`, but seeded users use `Demo1234!` | Log in as `admin`/`admin` OR `marie.dupont`/`Demo1234!` |
| Seed takes > 15s | DB pool contention / slow connection | Check `DB_MAX_CONNECTIONS` env; warm DB usually seeds in < 300ms |

## Reseed from scratch

```bash
# Drop Acme rows and reseed
just db-seed-reset

# Nuclear option — rarely needed
rtk docker exec signapps-postgres psql -U signapps -d signapps -c "
DELETE FROM org_assignments WHERE tenant_id = (SELECT id FROM identity.tenants WHERE slug='acme-corp');
DELETE FROM org_persons     WHERE tenant_id = (SELECT id FROM identity.tenants WHERE slug='acme-corp');
DELETE FROM org_nodes       WHERE tenant_id = (SELECT id FROM identity.tenants WHERE slug='acme-corp');
DELETE FROM org_ad_config   WHERE tenant_id = (SELECT id FROM identity.tenants WHERE slug='acme-corp');
DELETE FROM identity.users  WHERE email LIKE '%@acme.corp';
"
just db-seed
```

## Verify seed state

```bash
rtk docker exec signapps-postgres psql -U signapps -d signapps -c "
SELECT 'nodes'      as t, COUNT(*) FROM org_nodes       WHERE tenant_id=(SELECT id FROM identity.tenants WHERE slug='acme-corp')
UNION ALL SELECT 'persons', COUNT(*) FROM org_persons   WHERE tenant_id=(SELECT id FROM identity.tenants WHERE slug='acme-corp')
UNION ALL SELECT 'users',   COUNT(*) FROM identity.users WHERE email LIKE '%@acme.corp'
UNION ALL SELECT 'events',  COUNT(*) FROM calendar.events WHERE tenant_id=(SELECT id FROM identity.tenants WHERE slug='acme-corp')
UNION ALL SELECT 'chats',   COUNT(*) FROM chat.channels WHERE name IN ('Général','Engineering','Sales','Support','Random')
UNION ALL SELECT 'pxe',     COUNT(*) FROM pxe.assets WHERE mac_address LIKE 'aa:bb:cc:00:00:0%';
"
```

Expected (after a clean seed): nodes=5, persons=15, users>=15, events=20,
chats=5, pxe=3.

## Adding a new seeder

1. Create `services/signapps-seed/src/seeders/<name>.rs` with:
   - `pub struct <Name>Seeder;`
   - `impl Seeder for <Name>Seeder` with `name() -> "<name>"`
   - `run()` using `acme_uuid(kind, key)` for IDs and `ON CONFLICT DO NOTHING`
   - Optionally `dependencies()` listing seeders that must run first
2. Wire it in `services/signapps-seed/src/seeders/mod.rs` (add to `pub mod`
   and the `all()` vec).
3. Re-run `just db-seed` twice — second run must report `created=0` for
   your new seeder.
4. Add an assertion to `tests/test_idempotent.rs` if your seeder writes
   to a distinct table.

## Related files

- `services/signapps-seed/` — the crate
- `services/signapps-seed/README.md` — user-facing docs
- `justfile` — `db-seed`, `db-seed-reset`, `db-seed-dry`, `db-seed-only`
- `docs/product-specs/65-seeding-demo.md` — product spec
