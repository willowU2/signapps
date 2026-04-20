# SO9 — Multi-assignation + ACL universelle + Renouvellements — Design Spec

**Scope :** Refonte UI/UX ressources · Assignation N:N avec rôles (person/node/group/site) · Identifiant typé par kind · ACL universelle type ReBAC · Cycle de renouvellement + alertes · Dashboard dédié
**Durée :** 7 jours (3 waves)
**Branche :** `feature/so9-resources-acl-renewal`
**Dépendances :** SO1-SO8 mergés et pushés

---

## 1. Contexte

SO8 a livré `org_resources` avec assignment simple (`assigned_to_person_id` OU `assigned_to_node_id` mutuel exclusif + `primary_site_id`). Limites :

- Impossible d'avoir une voiture avec un **owner + primary user + plusieurs co-users**
- Impossible d'assigner à un **groupe** (pool Sales EMEA qui partage 3 voitures)
- Pas d'**ACL fine** : les droits sont limités aux roles globaux (admin/manager/viewer) et au middleware SO1-S2 basé sur node assignments
- Pas de suivi des **renouvellements** : garanties, licences, contrôles techniques, validité badges — tout se passe dans les tabulations perdues
- Identifiants faibles : un seul champ `serial_or_ref` générique, alors que chaque kind a son identifiant canonique (plate+VIN, license_key, badge_number+NFC_UID…)

SO9 corrige ces 4 trous et pose une fondation ACL universelle réutilisable ailleurs (SO10+).

---

## 2. Features détaillées

### R1 — Multi-assignation avec rôles (N:N acteurs/ressource)

**Nouvelle table `org_resource_assignments`** remplace les colonnes `assigned_to_*` :

```sql
CREATE TABLE org_resource_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_id UUID NOT NULL REFERENCES org_resources(id) ON DELETE CASCADE,
  subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('person','node','group','site')),
  subject_id UUID NOT NULL,
  role VARCHAR(24) NOT NULL CHECK (role IN ('owner','primary_user','secondary_user','caretaker','maintainer')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  reason TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE INDEX idx_ra_resource_active ON org_resource_assignments(resource_id)
  WHERE end_at IS NULL;
CREATE INDEX idx_ra_subject ON org_resource_assignments(subject_type, subject_id)
  WHERE end_at IS NULL;
CREATE UNIQUE INDEX idx_ra_one_owner ON org_resource_assignments(resource_id)
  WHERE end_at IS NULL AND role = 'owner';
```

**Règles :**
- 1 owner max par ressource active (contrainte via index unique partiel)
- 1 primary_user max si `is_primary = TRUE` (indexé aussi)
- Plusieurs `secondary_user` OK, plusieurs caretakers OK
- **Historique** : update = close row avec `end_at` + insère nouvelle (cf. modèle bi-temporel léger)

**Rôles sémantiques :**
- `owner` : responsable légal/financier (signe le contrat, paie)
- `primary_user` : utilise au quotidien (Marie Dupont avec la Tesla)
- `secondary_user` : co-utilise occasionnellement (stagiaire qui peut prendre la voiture)
- `caretaker` : gère la maintenance et logistique (mécanicien, RSSI pour les badges)
- `maintainer` : fait les mises à jour techniques (DSI pour MacBook, vendor pour licence)

**Migration** : les assignments SO8 sont ré-ingérés en bulk via script de migration 507 qui crée 1 row par asset avec `role='owner'` et `subject_type='person'` ou `'node'` selon l'ancien champ.

### R2 — Identifiant typé par kind

Nouveau champ `primary_identifier_type VARCHAR(20)` sur `org_resources` avec enum :

| Type | Exemple | kind typique |
|------|---------|--------------|
| `serial` | `C02XF1234ABC` | it_device, av_equipment |
| `plate` | `AB-123-CD` | vehicle |
| `vin` | `1HGBH41JXMN109186` | vehicle (secondaire) |
| `license_key` | `XXXX-XXXX-XXXX-XXXX` | license_software |
| `badge_number` | `NEX-0042` | badge |
| `key_number` | `K-15-M` | key_physical |
| `none` | — | furniture basique |

Le champ existant `serial_or_ref` reste (alias de `primary_identifier`). Identifiants secondaires dans `attributes` (ex: VIN pour véhicule, UID NFC pour badge, nom fournisseur pour licence).

### R3 — ACL universelle (ReBAC-style)

**Nouvelle table `org_acl`** :

```sql
CREATE TABLE org_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('person','group','role','everyone','auth_user')),
  subject_id UUID,                        -- NULL pour role/everyone/auth_user
  subject_ref VARCHAR(64),                -- role name quand subject_type='role'
  action VARCHAR(32) NOT NULL,            -- 'create','read','update','delete','list','assign','unassign','transition','renew'
  resource_type VARCHAR(32) NOT NULL,     -- 'resource','site','group','person','node','document', ... | '*' wildcard
  resource_id UUID,                       -- NULL = wildcard (all of type)
  effect VARCHAR(8) NOT NULL CHECK (effect IN ('allow','deny')),
  reason TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (subject_type IN ('role','everyone','auth_user') AND subject_id IS NULL)
    OR (subject_type IN ('person','group') AND subject_id IS NOT NULL)
  )
);

CREATE INDEX idx_acl_lookup ON org_acl(tenant_id, resource_type, action, subject_type);
CREATE INDEX idx_acl_subject ON org_acl(subject_type, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX idx_acl_role ON org_acl(subject_ref) WHERE subject_type = 'role';
```

**Résolution (côté `signapps-common::rbac`) :**

1. Collecter toutes les ACLs applicables au couple (user, action, resource) :
   - `subject_type='auth_user'` → s'applique si user loggé
   - `subject_type='everyone'` → toujours
   - `subject_type='role'` → si user a le role
   - `subject_type='person'` + subject_id = user.person_id → s'applique
   - `subject_type='group'` + subject_id ∈ groupes de user.person_id → s'applique
2. Pour chaque ACL, check resource match : `resource_type IN (exact, '*')` AND `resource_id IN (exact, NULL-wildcard)`
3. Check validité temporelle : `valid_from <= now <= valid_until` (nullables OK)
4. **Deny wins** : si une seule ACL `deny` match, refuser. Sinon, au moins un `allow` → autoriser. Sinon, implicit deny.

**Héritage implicite (rules hardcodées, pas stockées en DB)** :

- Un `owner` actif d'une resource a automatiquement `allow read+update+assign+unassign+transition+renew` sur cette resource
- Un `caretaker` a `allow read+update+transition+renew`
- Un `primary_user`/`secondary_user` a `allow read`
- Un admin global a `allow *` sur tout (shortcut)
- Un user loggé a `allow read` sur les resources publiques (`attributes.visibility = 'public'`, future extension)

**Action cache** : résolution coûteuse → cache moka 60s par `(user_id, action, resource_type, resource_id)` avec invalidation sur events `org.acl.updated` et `org.resource.assigned`.

### R4 — Renouvellements

**Nouvelle table `org_resource_renewals`** :

```sql
CREATE TABLE org_resource_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_id UUID NOT NULL REFERENCES org_resources(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL CHECK (kind IN (
    'warranty_end','license_expiry','badge_validity','insurance_expiry',
    'technical_inspection','maintenance_due','battery_replacement',
    'key_rotation','custom'
  )),
  due_date DATE NOT NULL,
  grace_period_days INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','snoozed','renewed','escalated','cancelled')),
  last_reminded_at TIMESTAMPTZ,
  snoozed_until DATE,
  renewed_at TIMESTAMPTZ,
  renewed_by_user_id UUID,
  renewal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_renewals_due ON org_resource_renewals(due_date, status)
  WHERE status IN ('pending','snoozed','escalated');
CREATE INDEX idx_renewals_resource ON org_resource_renewals(resource_id);
```

**Cron job** (`signapps-scheduler` existant) : `resource_renewals_daily` tick 24h à 8h UTC :

1. `SELECT` rows où `status IN ('pending','snoozed') AND due_date - NOW() <= 60 days`
2. Classer par proximité :
   - J-60 → `last_reminded_at = now` + event `org.resource.renewal.due.j60`
   - J-30 → idem `.j30`
   - J-7 → `.j7` + email escalade aux assignees + caretaker
   - J-0 / passé → `status='escalated'` + event `.overdue`
3. Event bus PgEventBus → consumers dans `signapps-notifications`

**UI dédiée** `/admin/resources/renewals` :

- Liste avec filtres (kind, due_date range, status, resource_type)
- Colonnes : Resource, Kind, Due date, J-X, Status, Assigned owner, Actions
- Bouton par row : `Renouveler` (ouvre dialog avec `renewed_at` date picker + notes → `status='renewed'`), `Reporter` (date picker → `status='snoozed', snoozed_until=...`), `Annuler`
- Export ICS calendar pour sync avec Outlook/Google Cal

### R5 — UI/UX refonte ressources

**Page `/admin/resources` refonte :**

- **Toggle vue** : Table dense (default) · Grid cards (photo-forward) · Timeline renewals · Calendar réservations
- **Filtres avancés sidebar** : kind (multi-select), status, assigned_to (person picker), échéance renouvellement (slider J-30 / J-60), site, valeur (range slider), balance textuelle omnibox
- **Bulk actions** : sélection multi (checkboxes) + footer sticky "N sélectionnés · Assigner · Transition status · Exporter CSV · Définir échéance"

**Fiche `/admin/resources/[id]` refonte :**

- **Hero** : image/photo upload (nouveau, colonne `photo_url` sur `org_resources`) + QR code imprimable + statut badge + alerte renouvellement si < 60j
- **Tabs** : Détails | Assignations (multi-role) | Historique (status + assignments) | Renouvellements | ACL | Maintenance | Fichiers liés

**Dialog "Assigner" :**

- Toggle subject type (person / node / group / site) → picker correspondant
- Role select (owner/primary_user/secondary_user/caretaker/maintainer)
- Toggle `is_primary`
- Dates validité (from / until)
- Raison (textarea optionnel)

**Dialog "ACL" (sur fiche ressource) :**

- Table des permissions actuelles avec résolution live "Qui peut quoi ?"
- Bouton "Tester" : picker user + action → affiche "Allow/Deny + chain de raisons"
- Bouton "Ajouter règle" : subject picker (person/group/role/everyone) + action multi-select + effect allow/deny + validité temporelle

**Mobile `/me/inventory` enrichi :**

- Card par ressource avec bouton "Renouveler" si échéance proche
- Pull-to-refresh + push notifications (via Serwist) pour renewals J-7

### R6 — Seeds Nexus SO9

- **30 renouvellements** répartis : 5 licences 2027, 10 garanties IT 2026-2027, 10 CT véhicules 12 mois, 5 badges validity 12 mois. 3 déjà escalated (`status='escalated'`) pour montrer le flow visuel.
- **25 ACLs** :
  - 3 role-based : `role=vehicle_manager` allow * on resource_type=vehicle ; `role=badge_manager` allow * on badge ; `role=it_manager` allow * on it_device+license_software
  - 5 person-based : admin users allow * on *
  - 5 group-based : `group=ethics-committee` allow read on resource_type=document (future SO10)
  - 12 resource-specific : Tesla Y → owner=Marie + primary_user=Marie + caretaker=flotte_pool ; MacBook Marie → owner=Marie + caretaker=DSI
- **Ré-ingestion assignments** : les 144 resources SO8 migrées vers `org_resource_assignments` en mode mix (10 avec multi-role owner+primary+secondary, reste avec single owner)

---

## 3. Architecture

### 3.1 Backend

- Migration 507 : 3 nouvelles tables + migration data script
- Models dans `crates/signapps-db/src/models/org/` : `resource_assignment.rs`, `acl.rs`, `resource_renewal.rs`
- Repos dans `crates/signapps-db/src/repositories/org/`
- Nouveau module `crates/signapps-common/src/rbac/acl.rs` : struct `AclEntry`, trait `AclResolver`, enum `AclAction`, enum `AclSubjectKind`, fonction `resolve(pool, user, action, resource) -> Effect` avec cache moka
- Handlers `services/signapps-org/src/handlers/`:
  - `resource_assignments.rs` : CRUD
  - `acl.rs` : CRUD + test endpoint `POST /acl/test {user_id, action, resource_type, resource_id}`
  - `resource_renewals.rs` : CRUD + transition
- Cron job `signapps-scheduler/src/jobs/resource_renewals_daily.rs`
- Events PgEventBus nouveaux : `org.resource.assigned`, `org.resource.renewal.due.{j60,j30,j7,overdue}`, `org.acl.updated`

### 3.2 Migration legacy SO8

Script SQL dans migration 507 :

```sql
INSERT INTO org_resource_assignments
  (tenant_id, resource_id, subject_type, subject_id, role, is_primary, start_at)
SELECT tenant_id, id,
  CASE WHEN assigned_to_person_id IS NOT NULL THEN 'person'
       WHEN assigned_to_node_id IS NOT NULL THEN 'node'
       ELSE NULL END,
  COALESCE(assigned_to_person_id, assigned_to_node_id),
  'owner', TRUE, created_at
FROM org_resources
WHERE (assigned_to_person_id IS NOT NULL OR assigned_to_node_id IS NOT NULL)
  AND NOT archived;
```

Les colonnes `assigned_to_*` de `org_resources` restent pour compat descendante en lecture, mais les writes passent désormais par `org_resource_assignments`.

### 3.3 Frontend

Extensions `client/src/lib/api/org.ts` :
- `orgApi.resources.assignments` : list/add/end
- `orgApi.acl` : list/create/delete/test
- `orgApi.resources.renewals` : list/create/renew/snooze/cancel

Nouveaux composants :
- `client/src/app/admin/resources/page.tsx` refonte avec toggle vues
- `client/src/app/admin/resources/[id]/page.tsx` refonte avec tabs
- `client/src/app/admin/resources/renewals/page.tsx` (nouveau)
- `client/src/components/resources/assign-dialog.tsx`
- `client/src/components/resources/acl-table.tsx`
- `client/src/components/resources/acl-test-dialog.tsx`
- `client/src/components/resources/renewal-timeline.tsx`
- `client/src/components/resources/resource-card.tsx` (vue grid)

---

## 4. Waves

### Wave 1 (3j) — Backend ACL + multi-assign + renouvellements

- W1.T1 Migration 507 + test checksum + migration data script SO8 → multi-assign
- W1.T2 Models + repos : `ResourceAssignment`, `Acl`, `ResourceRenewal`
- W1.T3 `AclResolver` dans `signapps-common` + cache moka + tests unitaires 15+ scénarios
- W1.T4 Handlers CRUD + endpoint `/acl/test` + cron `resource_renewals_daily`

### Wave 2 (3j) — UI refonte + dashboard renewals

- W2.T5 Page `/admin/resources` refonte avec toggle vues + bulk actions
- W2.T6 Page `/admin/resources/[id]` refonte avec tabs + assign dialog multi-role
- W2.T7 Page `/admin/resources/renewals` + timeline + filter + export ICS
- W2.T8 Dialog ACL + test live + résolution visuelle

### Wave 3 (1j) — Seeds + polish + merge

- W3.T9 Seeds SO9 : 30 renewals + 25 ACLs + migration assignments
- W3.T10 E2E Playwright (3 scénarios) + docs + merge

---

## 5. Exit criteria

- [ ] Migration 507 appliquée, 3 tables + indexes + constraints
- [ ] 144 resources ré-ingérées dans `org_resource_assignments` (1 owner chacune)
- [ ] `AclResolver` middleware actif sur tous les handlers resources + tests 15+ scénarios verts
- [ ] Cron `resource_renewals_daily` configuré et trigger 8h
- [ ] Page `/admin/resources/renewals` fonctionnelle avec 30 entrées seedées
- [ ] Dialog ACL avec test live retourne allow/deny correct
- [ ] Page `/admin/resources` avec 3 vues (table/grid/calendar) et bulk actions
- [ ] Clippy + TS clean, boot < 5s
- [ ] 3 E2E verts (assign multi-role / ACL test / renewal workflow)
- [ ] Merge main + push origin

---

**Fin spec SO9.**
