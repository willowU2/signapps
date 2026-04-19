# Product Spec 65 — Seeding démo "Acme Corp"

**Status:** Livré S2 (W3)
**Owner:** Track C
**Related:** 15-hr-workforce.md, 53-org-rbac-refonte.md (S1), 64-pxe-operational.md (S2 W1/W2)

## Résumé

Binary Rust `signapps-seed` (crate `services/signapps-seed`) qui peuple une
instance SignApps avec les données "Acme Corp" cohérentes cross-services en
moins de 5 secondes. Remplace l'ancien script bash `scripts/seed-demo-data.sh`.

## Contenu seeded

- **Tenant** : Acme Corp (slug `acme-corp`, domain `acme.corp`)
- **Structure org** : 1 racine + 4 OUs (Direction, Engineering, Sales, Support)
- **15 personnes** avec emails `@acme.corp` + attributes JSONB (title)
- **15 assignations** primaires axis=hierarchy
- **15 users** identity.users (pwd = `Demo1234!` via Argon2)
- **1 config AD** unbound (`mode='off'`)
- **4 calendriers** + **20 events** de la semaine en cours (Mon-Fri)
- **15 mail accounts** + **30 mails** inter-users
- **5 canaux chat** + **40 messages**
- **10 quick notes** + **10 documents** Tiptap (Yjs vide)
- **15 fichiers** storage.files dans 3 buckets virtuels
- **5 formulaires** (candidature, satisfaction, démo, congé, frais)
- **10 contacts** externes (via crm.leads)
- **4 salles** Meet (direction-weekly, eng-standup, all-hands, client-calls)
- **12 tâches** calendar.tasks (mixed statuses + priorities)
- **20 IT assets** (it.configuration_items : laptops, phones...)
- **8 secrets** vault.items (placeholders)
- **5 profils PXE** (ubuntu, debian, winpe, clonezilla, memtest) + **3 assets enrôlés**

Total : **~280 rows** sur 15 services.

## Usage

```bash
just db-seed                 # Full seed
just db-seed-reset           # Reset + reseed
just db-seed-dry             # Connectivity + validation, no writes
just db-seed-only calendar   # Un seul seeder
```

## Accès utilisateurs

- `admin` / `admin` (existant)
- `marie.dupont` / `Demo1234!` (+14 autres Acme users)

## Design

- **UUIDs déterministes** : namespace v5 `00000000-acbe-5000-…`
  via `signapps_seed::uuid::acme_uuid(kind, key)`. Même entrée →
  même UUID, donc idempotent et cross-références stables.
- **Idempotent** : chaque `INSERT` a `ON CONFLICT DO NOTHING`.
  Second run = 0 nouvelles rows.
- **Best-effort** : si une table n'existe pas, le seeder log un warning
  et passe au suivant (ne bloque jamais le pipeline global).
- **Safety gate** : `run_seed` refuse si `DATABASE_URL` pas localhost
  sans `SEED_ALLOW_PROD=1`.
- **Tenant resolution** : réutilise un tenant `acme-corp` existant
  au lieu de dupliquer (cohabite avec données legacy).
- **Tolérance aux schémas** : le plan initial supposait des schémas
  `org.*`, `docs.*` etc. Les vraies tables sont dans `public.*` et
  `docs.quick_notes`. Le seeder s'adapte au schéma réel.

## Tests

- `cargo test -p signapps-seed` (unit) — acme_uuid × 3 tests
- `cargo test -p signapps-seed --test test_org_identity` (intégration
  org + identity + ad)
- `cargo test -p signapps-seed --test test_idempotent` (full pipeline
  exécuté 2× avec assertions sur 11 snapshots de counts)
- `client/e2e/s2-seeding.spec.ts` (2 scénarios Playwright)

## Architecture

```
services/signapps-seed/
├── Cargo.toml            # bin + lib
├── README.md
└── src/
    ├── main.rs           # CLI entry
    ├── lib.rs            # run_seed + safety gate + tenant resolver
    ├── uuid.rs           # acme_uuid namespace v5
    ├── context.rs        # SeedContext (tenant_id + users/nodes maps)
    ├── seeder.rs         # trait Seeder + SeedReport
    └── seeders/
        ├── mod.rs        # ordered list of seeders
        ├── org.rs        # shared PERSONS + OUS constants
        ├── identity.rs
        ├── ad.rs
        ├── calendar.rs
        ├── mail.rs
        ├── chat.rs
        ├── docs.rs
        ├── drive.rs
        ├── forms.rs
        ├── contacts.rs
        ├── meet.rs
        ├── tasks.rs
        ├── it_assets.rs
        ├── vault.rs
        └── pxe.rs
```
