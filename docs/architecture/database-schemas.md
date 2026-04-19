# Database schemas — notes de cohérence

## Convention générale

La plupart des tables vivent dans des schémas PostgreSQL nommés par domaine :

- `identity` : users, tenants, roles, MFA, sessions.
- `pxe` : profiles, assets, images, deployments, dhcp_requests.
- `calendar` : calendars, events, time_items, tasks.
- `mail` : mailboxes, messages, folders.
- `chat` : conversations, messages, members.
- `docs` : documents, revisions, blocks.
- `storage` : objects, buckets, shares.
- `forms` : forms, submissions.
- `vault` : secrets, items.
- `it_assets` : assets, licenses, inventory.
- `meet` : rooms, participants, recordings.

## Exception 1 — `org.*` vit dans `public.*`

Les tables du domaine org (S1) vivent dans le schéma `public` et non
dans un schéma `org` dédié :

- `org_nodes` (arbre LTREE)
- `org_persons`
- `org_assignments` (3 axes : org / project / focus)
- `org_policies`
- `org_boards`
- `org_access_grants`
- `org_ad_config`
- `org_ad_sync_log`
- `org_provisioning_log`

**Raison historique** : les migrations S1 (400–426) ont été écrites en
supposant le schéma par défaut. Migrer vers `org.*` imposerait de
toucher une cinquantaine d'occurrences SQL et casserait les requêtes
existantes dans les services consommateurs.

**Décision S3** : statu quo. La convention de nommage `org_*` suffit à
identifier le domaine, même si le schéma physique est `public`. Les
tests d'intégration (`services/signapps-integration-tests`) s'adaptent
en conséquence.

## Exception 2 — Contacts externes en `crm.leads`

La table des contacts externes pour `signapps-contacts` vit en
`crm.leads`, pas dans un schéma `contacts` dédié. Le seed Acme Corp y
insère 10 rows.

**Raison** : historique — `crm` couvre à la fois les leads sales et les
contacts externes. Pas de migration prévue.

## Recommandation pour les futurs services

1. Créer un schéma dédié : `CREATE SCHEMA IF NOT EXISTS <service>;` dans
   la première migration du service.
2. Nommer les tables SANS préfixe redondant : `<schema>.events` plutôt
   que `<schema>.calendar_events`.
3. Documenter les choix dans `docs/product-specs/<NN>-<service>.md` et
   référencer ce fichier pour les exceptions.

## Conventions transverses

- Clefs primaires : `uuid` (v4 pour generées, v5 namespace pour les
  seeds déterministes).
- Horodatage : `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- Multitenant : chaque table porte `tenant_id UUID NOT NULL REFERENCES
  identity.tenants(id)` sauf les tables globales (ex. `identity.tenants`
  elle-même, `pxe.images`).
- Encryption at rest : colonnes sensibles utilisent le trait
  `signapps_common::crypto::EncryptedField` (AES-256-GCM via keystore).
