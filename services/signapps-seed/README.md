# signapps-seed

Idempotent Rust binary that seeds a SignApps instance with the
"Acme Corp" demo data set — ~280 rows cohérent across 15 services.
Replaces the legacy bash script `scripts/seed-demo-data.sh`.

## Usage

```bash
# Full seed (creates everything, skips rows that already exist)
just db-seed

# Reset Acme Corp data then seed from scratch
just db-seed-reset

# Dry-run (connectivity / validation only — no writes)
just db-seed-dry

# Run only one seeder (name matches `Seeder::name()`)
just db-seed-only calendar
```

## Contenu seeded

| Seeder     | Items                                                   |
|------------|---------------------------------------------------------|
| org        | 1 tenant + root node + 4 OUs + 15 persons + 15 assignments |
| identity   | 15 users (password = `Demo1234!`)                       |
| ad         | 1 unbound AD config (`mode='off'`)                      |
| calendar   | 4 shared calendars + 20 events (current week)           |
| mail       | 15 mail accounts + 30 inter-user emails                 |
| chat       | 5 public channels + 40 messages                         |
| docs       | 10 quick notes + 10 Tiptap documents                    |
| drive      | 15 storage.files across 3 virtual buckets               |
| forms      | 5 forms (candidacy, satisfaction, demo, leave, expense) |
| contacts   | 10 external contacts (stored as crm.leads)              |
| meet       | 4 persistent rooms                                      |
| tasks      | 12 Kanban tasks on the engineering calendar             |
| it-assets  | 20 IT CIs (laptops, monitors, phones, desktop)          |
| vault      | 8 placeholder secrets                                   |
| pxe        | 5 boot profiles + 3 enrolled assets (aa:bb:cc:00:00:0x) |

## Accès utilisateurs

- `admin` / `admin` (pre-existing)
- `marie.dupont` / `Demo1234!` — plus 14 autres Acme users

## Design

- **UUIDs** : namespace v5 `00000000-acbe-5000-...` (see `src/uuid.rs`).
  Deterministic, reproducible — same input always produces the same UUID.
- **Idempotent** : every `INSERT` uses `ON CONFLICT DO NOTHING`.
  Second run creates 0 rows.
- **Best-effort** : each seeder is run in isolation; missing tables or
  columns are logged as warnings and do not abort the whole seed.
- **Safety gate** : refuses non-localhost `DATABASE_URL` unless
  `SEED_ALLOW_PROD=1` is set.
- **Tenant resolution** : reuses an existing `acme-corp` tenant id if
  present, otherwise inserts the deterministic one. This lets the seed
  cohabit with legacy data.

## Tests

```bash
# Run all unit + integration tests
DATABASE_URL=postgres://signapps:signapps_dev@localhost/signapps \
  cargo test -p signapps-seed

# Idempotence only (runs full pipeline twice, asserts row counts unchanged)
DATABASE_URL=... cargo test -p signapps-seed --test test_idempotent
```

Typical full seed completes in under 5 seconds on a warm DB.
