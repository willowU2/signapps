# SO8 — Catalogue unifié de ressources tangibles — Design Spec

**Scope :** Modèle canonique `org_resources` (IT + véhicules + clés + badges + équipements) · Cycle de vie · Coût/amortissement/garantie · QR code · Dashboard "Mon inventaire"
**Durée :** 5 jours (2 waves)
**Branche :** `feature/so8-resources-catalog`
**Dépendances :** SO1-SO7 mergés

---

## 1. Contexte

Aujourd'hui :
- `it_assets.assets` (module `signapps-it-assets` port 3022) stocke 81 devices (laptops/monitors/phones/tablets) seedés pour Nexus
- Pas de modèle pour **voitures, clés, badges, équipements audio/vidéo, mobilier de valeur**
- Pas de **cycle de vie** (ordered → active → retired), pas d'historique d'état
- Pas de **coût/amortissement/garantie** tracké
- Pas de **QR code / tag** pour scan rapide
- Chaque user ne voit pas ses ressources ("mon inventaire")

SO8 pose les fondations : un modèle canonique `org_resources` qui absorbe l'existant IT et étend à tout type d'asset tangible. SO9 rajoute l'ACL fine, SO10 les données sensibles.

---

## 2. Objectifs

### R1 — Modèle canonique `org_resources`

- Une ligne par ressource physique/logique gérée
- `kind` enum ouvert : `it_device | vehicle | key_physical | badge | av_equipment | furniture | mobile_phone | license_software | other`
- `attributes JSONB` pour champs spécifiques par kind (ex: IT → `{serial, model, os}` ; vehicle → `{plate, mileage, fuel_type}` ; key_physical → `{door_id, copies}`)
- `status` : `ordered | active | loaned | in_maintenance | returned | retired`
- `assigned_to_person_id` + `assigned_to_node_id` (mutuel exclusif) : un asset est soit à une personne soit à une équipe
- `primary_site_id` : où l'asset est basé (réutilise SO7 sites)

### R2 — Cycle de vie + historique

- Nouvelle table `org_resource_status_log(resource_id, from_status, to_status, at, actor_user_id, reason)` — chaque transition loggée
- Transitions valides (state machine) encodées en Rust :
  - `ordered → active | retired`
  - `active → loaned | in_maintenance | retired`
  - `loaned → active | retired`
  - `in_maintenance → active | retired`

### R3 — Coût, garantie, maintenance

- Colonnes `purchase_date, purchase_cost_cents, amortization_months, currency` (défaut EUR)
- Colonnes `warranty_end_date, next_maintenance_date` — prochaine maintenance alerte visuelle si < 30j
- Computed en lecture : `depreciated_value_cents = cost × (1 - months_elapsed / amortization_months)` clamp 0

### R4 — QR code

- Endpoint public `GET /public/resource/:qr_token` → redirect vers `/admin/resources/:id` (admin UI) ou fiche publique lite si non-admin scan
- `qr_token` stocké en colonne, généré via `hex(hmac_sha256(keystore.dek("qr-v1"), resource.id))` 16 chars
- UI détail asset : bouton "Imprimer QR" → PDF A4 avec 10-20 QR (réutilise pattern grants SO1)
- Scan mobile : l'app lit le QR → navigate vers la fiche via le token public

### R5 — Dashboard "Mon inventaire"

- Page `/me/inventory` accessible à tout user authentifié
- Liste ses ressources (via `assigned_to_person_id = self.person_id`) groupées par kind
- Bouton "Déclarer un problème" → ticket IT basique (log dans audit_log)
- Bouton "Rendre" → passe status à `returned`

### R6 — Enrichissement seeds Nexus

- 81 IT devices existants **migrés** vers `org_resources(kind='it_device')`
- **10 véhicules** : 3 utilitaires + 5 berlines executives + 2 voitures service
- **25 clés physiques** : bureaux direction (6), salles réunion Paris HQ (10), coffres (4), véhicules (5)
- **15 badges** : nominatifs + 3 visiteurs template
- **8 équipements audio/vidéo** : 2 projecteurs, 3 écrans portables, 2 caméras, 1 perche micro
- **5 licences logiciels** : Figma Enterprise, Adobe Creative Cloud, 3 autres

---

## 3. Modèle données (migration 506)

```sql
CREATE TABLE org_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  kind VARCHAR(32) NOT NULL CHECK (kind IN (
    'it_device','vehicle','key_physical','badge','av_equipment',
    'furniture','mobile_phone','license_software','other'
  )),
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  serial_or_ref VARCHAR(128),
  attributes JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('ordered','active','loaned','in_maintenance','returned','retired')),
  assigned_to_person_id UUID REFERENCES org_persons(id) ON DELETE SET NULL,
  assigned_to_node_id UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
  primary_site_id UUID REFERENCES org_sites(id) ON DELETE SET NULL,
  purchase_date DATE,
  purchase_cost_cents BIGINT,
  currency VARCHAR(3) DEFAULT 'EUR',
  amortization_months INT,
  warranty_end_date DATE,
  next_maintenance_date DATE,
  qr_token VARCHAR(32) UNIQUE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug),
  CHECK (
    assigned_to_person_id IS NULL OR assigned_to_node_id IS NULL
  )
);
CREATE INDEX idx_resources_tenant ON org_resources(tenant_id) WHERE NOT archived;
CREATE INDEX idx_resources_kind ON org_resources(tenant_id, kind);
CREATE INDEX idx_resources_person ON org_resources(assigned_to_person_id) WHERE assigned_to_person_id IS NOT NULL;
CREATE INDEX idx_resources_node ON org_resources(assigned_to_node_id) WHERE assigned_to_node_id IS NOT NULL;
CREATE INDEX idx_resources_site ON org_resources(primary_site_id);
CREATE INDEX idx_resources_qr ON org_resources(qr_token) WHERE qr_token IS NOT NULL;

CREATE TABLE org_resource_status_log (
  id BIGSERIAL PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES org_resources(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  actor_user_id UUID,
  reason TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_resource_status_log_resource ON org_resource_status_log(resource_id, at DESC);

CREATE TRIGGER org_resources_audit AFTER INSERT OR UPDATE OR DELETE ON org_resources
  FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
```

---

## 4. Architecture

### 4.1 Backend

Nouveaux composants dans `signapps-org` (garder les resources dans le service org, cohérent avec sites/groups/positions) :

- Model `crates/signapps-db/src/models/org/resource.rs`
- Repo `crates/signapps-db/src/repositories/org/resource_repository.rs`
- Handler `services/signapps-org/src/handlers/resources.rs` : CRUD + `/status` transitions + `/qr` token refresh + `/public/:qr_token` redirect + `/me/inventory` lookup
- Seed migration scripts dans `services/signapps-seed/src/seeders/resources.rs`

**API résumée :**
- `GET /org/resources?tenant_id=X&kind=Y&assigned_to=Z&status=W` → liste filtrée
- `GET /org/resources/:id` → détail
- `POST /org/resources` → création (QR token généré auto)
- `PUT /org/resources/:id` → update champs
- `POST /org/resources/:id/status` body `{to, reason?}` → transition (valide state machine)
- `GET /org/resources/:id/history` → status log + audit join
- `POST /org/resources/:id/qr/rotate` → nouveau token
- `GET /me/inventory` → resources assigned_to_person_id = current user.person_id
- `GET /public/resource/:qr_token` → redirect 302 vers UI

### 4.2 Migration IT legacy

Les 81 rows de `it_assets.assets` sont **conservées** (pas de drop) mais un script de migration 506-bis copie vers `org_resources` avec `kind='it_device'` et garde un lien via `attributes.legacy_it_asset_id`. Les nouveaux handlers résolvent les deux (lecture consolidée), les écritures ciblent `org_resources` uniquement.

### 4.3 State machine transitions

```rust
// services/signapps-org/src/resources/state_machine.rs
pub fn valid_transition(from: ResourceStatus, to: ResourceStatus) -> bool {
    use ResourceStatus::*;
    match (from, to) {
        (Ordered, Active) | (Ordered, Retired) => true,
        (Active, Loaned) | (Active, InMaintenance) | (Active, Retired) => true,
        (Loaned, Active) | (Loaned, Retired) => true,
        (InMaintenance, Active) | (InMaintenance, Retired) => true,
        (Returned, Active) | (Returned, Retired) => true,
        _ => false,
    }
}
```

### 4.4 QR code

- Token : 16 chars hex = 64 bits d'entropie (suffisant, non-guessable)
- Stockage column `qr_token` avec UNIQUE + index partial
- Route publique `/public/resource/:token` : lookup → si found, 302 vers `/admin/resources/:id`. Si tenant cookie absent (non-loggé), redirect vers login avec `?return_to=...`.
- Génération PDF : réutilise le pattern existant (vérifier si déjà un `pdf-generator` dans `signapps-docs` ou ailleurs ; sinon générer HTML + `print` CSS)

### 4.5 Frontend

**Pages :**
- `/admin/resources` : liste globale avec filtres kind/status/assigned_to, bulk actions (export CSV, tag)
- `/admin/resources/[id]` : fiche détail (hero + tabs : détails / attribution / historique / QR)
- `/me/inventory` : dashboard utilisateur = ses resources groupées par kind, actions rapides

**Components :**
- `ResourceCard` : avatar kind + nom + status badge + assigné
- `ResourceDetailHero` : grosse tuile avec QR + photo + infos principales
- `ResourceStatusTimeline` : timeline verticale des transitions
- `AssignResourceDialog` : picker person OU node (toggle), date effet, reason
- `LoanWorkflowDialog` : prêt court-terme avec retour prévu

**Integration tabs DetailPanel :**
- Ajouter un tab "Ressources" sur un **node** (resources assignées à ce node ou ses descendants)
- Ajouter un tab "Ressources" sur une **person** (ses resources)

### 4.6 Seed Nexus

- Migration IT legacy : 81 lignes `org_resources(kind='it_device')` copiées depuis `it_assets.assets`
- 10 véhicules Tesla/Renault/Peugeot avec plaques fictives
- 25 clés physiques (bureaux + salles + coffres + véhicules)
- 15 badges (10 nominatifs employés-clés + 5 templates visiteurs)
- 8 équipements AV (Epson projector ×2, écrans portables Samsung ×3, Sony camera ×2, micro)
- 5 licences : Figma Ent, Adobe CC, Notion Ent, Linear, Miro

Total : **~144 resources** seedées. Coûts réalistes (MacBook Pro M3 ≈ 2500€, Tesla Y ≈ 50000€, clé ≈ 20€, badge ≈ 15€).

---

## 5. Waves

### Wave 1 (3j) — Backend + migration + seeds

- W1.T1 Migration 506 + test checksum
- W1.T2 Models + repo `Resource` + `ResourceStatusLog` + state machine Rust
- W1.T3 Handlers CRUD + transitions + QR + `/me/inventory` + `/public/resource/:token`
- W1.T4 Seeds : migration IT legacy + 63 nouvelles resources (véhicules/clés/badges/AV/licences)

### Wave 2 (2j) — Frontend + merge

- W2.T5 Pages `/admin/resources` + `/admin/resources/[id]` + dialogs assign/loan
- W2.T6 Page `/me/inventory` + intégration tab "Ressources" dans DetailPanel (node + person)
- W2.T7 QR PDF printable + E2E Playwright (3 scénarios) + docs + merge

---

## 6. Exit criteria

- [ ] Migration 506 appliquée, 2 tables + trigger
- [ ] State machine en place, transitions invalides refusées avec 400
- [ ] 81 IT + 63 nouveaux = 144 resources seedées
- [ ] QR token + redirect public fonctionnel
- [ ] Page `/me/inventory` retourne les resources de l'user
- [ ] Tabs "Ressources" visibles sur node + person DetailPanel
- [ ] Clippy + TS clean, boot < 5s
- [ ] 3 E2E verts (create/transition/assign)
- [ ] Merge main + push origin

---

**Fin spec SO8.**
