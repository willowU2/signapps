# SO7 — Groupes transverses & Sites physiques — Design Spec

**Scope :** Groupes (static + dynamic + hybrid + derived) · Sites hiérarchiques (building > floor > room) · Capacité + équipements · Réservation / hot-desk / planning d'occupation
**Durée :** 8 jours (3 waves)
**Branche :** `feature/so7-groups-sites`
**Dépendances :** SO1-SO6 mergés

---

## 1. Contexte

La hiérarchie `org_nodes` (LTREE) couvre la structure **formelle** : Direction → Engineering → Platform Team. Elle ne couvre PAS :
- Les **groupes transverses** : "Développeurs Python", "Comité d'éthique", "All Engineering" (cross-team), communautés de pratique
- Les **lieux physiques** : bureau Paris, salle Alpha, bureau individuel, hot-desk libre

SO7 ajoute ces 2 dimensions, orthogonales à la hiérarchie, avec intégration tabs/UI dans l'existant. Les 2 tabs `Groupes` et `Sites` dans le DetailPanel deviennent fonctionnels (aujourd'hui stub).

---

## 2. Features

### G1 — Groupes : 4 types

**Type `static`** — membership explicite admin-géré.
- Exemple : "Comité d'éthique" avec 5 personnes nommées.
- Un admin ajoute/retire manuellement via UI.

**Type `dynamic`** — règle de sélection en JSON.
- Exemple : `{"skills": ["python"], "level_min": 3}` → "Développeurs Python niveau avancé+".
- Règle évaluée côté backend à la volée (avec cache moka 5 min). Pas de membership dénormalisé ; si on liste les membres on évalue la règle.

**Type `hybrid`** — règle dynamique + exceptions manuelles.
- Exemple : règle "primary_node IN (eng-*)" mais + Marie (qui est CEO) + Paul (qui est CFO invité).
- Stockage : règle + liste `inclusions` + liste `exclusions`. Résolution = (match règle OR in inclusions) AND NOT in exclusions.

**Type `derived`** — reflète un node org entier.
- Exemple : "Tous Engineering" = groupe qui suit le sous-arbre Engineering (node + descendants structure axis).
- Stockage : juste `source_node_id`. Résolution = query récursive sur assignments structure.
- Use case : créer une mailing liste qui suit automatiquement les moves d'équipes.

**Endpoints communs :**
- `GET /org/groups?tenant_id=X&type=static|dynamic|hybrid|derived` → list
- `GET /org/groups/:id` → détails + type + règle + metadata
- `GET /org/groups/:id/members` → membres résolus (pour dynamic/hybrid/derived c'est évalué, pour static c'est la table)
- `POST /org/groups` → create
- `PUT /org/groups/:id` → update (règle + exceptions)
- `DELETE /org/groups/:id` → soft-delete (`archived=true`)
- `POST /org/groups/:id/members` (static/hybrid only) → add exception/membre
- `DELETE /org/groups/:id/members/:person_id` → remove

**DSL règle dynamique (JSON) :**

```json
{
  "and": [
    {"skill": {"slug": "python", "level_min": 3}},
    {"node_path_startswith": "nexus_industries.engineering"}
  ]
}
```

Opérateurs initiaux : `and`, `or`, `not`, `skill`, `node_id`, `node_path_startswith`, `role`, `site_id`, `title_contains`, `email_domain`. Évaluation côté Rust via un pattern-matcher simple sur `serde_json::Value`.

### S1 — Sites : hiérarchie building > floor > room

**Modèle :** un site est un node de type building/floor/room avec un `parent_id` pointant vers le parent immédiat. Adresse+GPS au niveau building uniquement, hérité logiquement.

**Types :**
- `building` : immeuble (Paris HQ, Lyon annexe)
- `floor` : étage
- `room` : salle, bureau fermé, open space
- `desk` : bureau individuel nommé (hot-desk)

**Attributs riches :**
- `capacity` : nb personnes max
- `equipment JSONB` : `{"screen": true, "videoconf": "Poly G7500", "whiteboard": 2, "kitchen": false}`
- `gps` : `{"lat": 48.85, "lng": 2.35}` (pour les buildings)
- `timezone` : IANA tz (`Europe/Paris`)
- `bookable` : boolean (une salle est bookable, un open-space généralement pas)

**Rattachement personnes :**
- Table `org_site_persons(person_id, site_id, role CHECK IN ('primary','secondary'), desk_id?, valid_from, valid_until)`.
- Une personne peut avoir un site primaire + N sites secondaires.
- `desk_id` : référence un `desk` node (pour les postes assignés vs hot-desks libres).

**Endpoints :**
- `GET /org/sites?tenant_id=X&kind=building|floor|room|desk` → list
- `GET /org/sites/:id` → détails + descendants immédiats
- `GET /org/sites/:id/tree` → sous-arbre complet (comme /nodes/:id/subtree)
- CRUD standard
- `GET /org/sites/:id/persons` → personnes rattachées (+ resolved site_persons)
- `POST /org/sites/:id/persons` → rattacher person (primary ou secondary)

### S2 — Réservation / hot-desk / planning d'occupation

**Table `org_site_bookings(id, site_id, person_id, start_at, end_at, purpose, status CHECK IN ('confirmed','tentative','cancelled'))`.**

**Endpoints :**
- `GET /org/site-bookings?site_id=X&since=Y&until=Z` → liste créneaux
- `POST /org/site-bookings` → book (vérif conflict avec status='confirmed' sur plage)
- `PATCH /org/site-bookings/:id/cancel` → annuler
- `GET /org/sites/:id/availability?day=YYYY-MM-DD` → créneaux libres par heure

**Integration Meet :** une room bookable avec `equipment.videoconf` crée automatiquement une room Meet associée. Bookings réutilisent le workflow existant `signapps-meet` si `link_meet=true`.

**Hot-desk :** une table `desk` non assignée (desk_persons empty) est "libre". Réservation via UI `/sites/<building>/floor/<floor>/hot-desk`.

**Occupancy heatmap :** endpoint `GET /org/sites/:id/occupancy?since=Y&until=Z&granularity=day|hour` → `{buckets: [{key, count, capacity, ratio}]}`. Consumed par une vue heatmap admin.

### UI — intégration DetailPanel

- **Tab "Groupes"** (sur un Node) : liste des groupes liés à ce node via leur règle (ex: un node Engineering affiche les groupes dynamiques qui matchent ses descendants). Bouton "Nouveau groupe" ouvre dialog avec type picker (static/dynamic/hybrid/derived) + éditeur de règle visuel.
- **Tab "Sites"** (sur un Node) : sites rattachés aux personnes du node (agrégé). Fréquence d'utilisation + taux d'occupation.
- **Tab "Groupes"** (sur une Person) : groupes dont la person est membre (résolu).
- **Tab "Sites"** (sur une Person) : site primaire + secondaires + bookings à venir.
- **Page dédiée `/admin/sites`** : navigateur hiérarchique building>floor>room, clic sur une salle = panneau détail avec booking calendar, heatmap occupancy.
- **Page dédiée `/admin/groups`** : liste + filtres par type, création, visualisation membres résolus avec refresh temps-réel.

---

## 3. Modèle données (migration 505)

```sql
-- ─── Groupes ─────────────────────────────────────────────────────────────
CREATE TABLE org_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('static','dynamic','hybrid','derived')),
  rule_json JSONB,                     -- NULL pour static; règle DSL pour dynamic/hybrid
  source_node_id UUID REFERENCES org_nodes(id) ON DELETE SET NULL,  -- derived seulement
  attributes JSONB NOT NULL DEFAULT '{}',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_groups_tenant ON org_groups(tenant_id) WHERE NOT archived;
CREATE INDEX idx_groups_source_node ON org_groups(source_node_id) WHERE source_node_id IS NOT NULL;

-- Membership : inclusions + exclusions pour static et hybrid
CREATE TABLE org_group_members (
  group_id UUID NOT NULL REFERENCES org_groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('include','exclude')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, person_id)
);
CREATE INDEX idx_group_members_person ON org_group_members(person_id);

-- ─── Sites (hiérarchie building > floor > room > desk) ────────────────────
CREATE TABLE org_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  parent_id UUID REFERENCES org_sites(id) ON DELETE CASCADE,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('building','floor','room','desk')),
  address TEXT,                         -- building only
  gps JSONB,                            -- building only, {lat, lng}
  timezone VARCHAR(64) DEFAULT 'Europe/Paris',
  capacity INT,
  equipment JSONB NOT NULL DEFAULT '{}',
  bookable BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  attributes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_sites_parent ON org_sites(parent_id);
CREATE INDEX idx_sites_kind ON org_sites(tenant_id, kind);

-- Personnes rattachées à un site
CREATE TABLE org_site_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES org_sites(id) ON DELETE CASCADE,
  desk_id UUID REFERENCES org_sites(id) ON DELETE SET NULL,  -- ref desk node si poste assigné
  role VARCHAR(16) NOT NULL DEFAULT 'secondary' CHECK (role IN ('primary','secondary')),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_site_persons_primary ON org_site_persons(person_id) WHERE role = 'primary';
CREATE INDEX idx_site_persons_site ON org_site_persons(site_id);

-- Bookings
CREATE TABLE org_site_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES org_sites(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  purpose VARCHAR(255),
  status VARCHAR(16) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','tentative','cancelled')),
  meet_room_id UUID,                    -- lien vers meet.rooms si link_meet=true
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);
CREATE INDEX idx_bookings_site_time ON org_site_bookings(site_id, start_at, end_at) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_person ON org_site_bookings(person_id, start_at);

-- Audit triggers
CREATE TRIGGER org_groups_audit AFTER INSERT OR UPDATE OR DELETE ON org_groups
  FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_sites_audit AFTER INSERT OR UPDATE OR DELETE ON org_sites
  FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_site_bookings_audit AFTER INSERT OR UPDATE OR DELETE ON org_site_bookings
  FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
```

---

## 4. Architecture backend

### 4.1 Repos

- `GroupRepository` : CRUD + `resolve_members(group_id)` qui dispatch selon `kind` :
  - `static` : SELECT depuis `org_group_members` WHERE kind='include'
  - `dynamic` : évalue rule_json → SELECT persons WHERE matching (compilation rule → SQL dans repo)
  - `hybrid` : résolution dynamic + union avec includes + minus excludes
  - `derived` : récursif depuis `source_node_id` via `org_assignments` axis='structure'
  - Cache moka 5 min par group_id + invalidation via events `org.assignment.*`, `org.group.*`
- `SiteRepository` : CRUD hiérarchique, `list_tree(root_id)` récursif, `list_persons(site_id)` avec filtre primary/secondary
- `BookingRepository` : CRUD + `availability(site_id, day)` calcul slots 15min, `conflicts(site_id, start, end)` pour validation

### 4.2 Handlers signapps-org

- `groups.rs` : CRUD + `/:id/members` GET (résolu) / POST (include) / DELETE
- `sites.rs` : CRUD + `/tree` + `/persons`
- `bookings.rs` : CRUD + `/availability`
- `occupancy.rs` : `GET /sites/:id/occupancy` → heatmap aggregated

### 4.3 Group rule matcher

Dans `services/signapps-org/src/groups/matcher.rs`, petit interpreter récursif :

```rust
pub enum Rule {
    And(Vec<Rule>),
    Or(Vec<Rule>),
    Not(Box<Rule>),
    Skill { slug: String, level_min: Option<i16> },
    NodePathStartswith(String),
    SiteId(Uuid),
    EmailDomain(String),
    TitleContains(String),
    Role(String),
}

impl Rule {
    pub fn to_sql_where(&self) -> (String, Vec<Box<dyn ToSql + Send + Sync>>) { ... }
}
```

Translate le DSL JSON → clause WHERE SQL composite, pour évaluation efficace. L'éval se fait en une seule requête (pas de load-all-in-memory).

---

## 5. Frontend

**Composants nouveaux :**

```
client/src/app/admin/groups/
  page.tsx                  # liste + filtres + create
  [id]/page.tsx             # détail groupe : type, règle visuelle, membres résolus

client/src/app/admin/sites/
  page.tsx                  # browser building>floor>room (tree)
  [id]/page.tsx             # détail site : persons, bookings, heatmap

client/src/app/admin/org-structure/components/groups-tab.tsx   # enrichir (existant stub)
client/src/app/admin/org-structure/components/sites-tab.tsx    # enrichir (existant stub)

client/src/components/groups/
  rule-editor.tsx           # JSON rule → UI visuelle (and/or/not blocks)
  group-type-picker.tsx
  members-list.tsx          # résolution + avatars + count
client/src/components/sites/
  site-tree.tsx             # hiérarchie navigable
  booking-calendar.tsx      # planning jour/semaine
  occupancy-heatmap.tsx
  site-map-embed.tsx        # GPS → mini Leaflet (optionnel)

client/src/lib/api/org.ts   # extensions groups/sites/bookings
```

**Rule editor** : builder visuel type "notion filters" — on ajoute/supprime des blocs and/or, chaque feuille = {type: skill|node|site|...} avec son form contextuel. Sérialise en rule_json.

**Site tree** : navigation drill-down type explorateur fichiers. Chaque node cliquable montre ses enfants + fiche détail à droite.

**Booking calendar** : vue day/week par salle avec plages horaires, clic-drag pour book. Lib : FullCalendar (déjà dans deps via `meet` si présent) ou custom simple.

---

## 6. Seeds Nexus (SO7)

**Groupes (6) :**
- `python-devs` (dynamic) : règle `{"skill": {"slug": "python", "level_min": 3}}`
- `all-managers` (dynamic) : règle `{"title_contains": "Lead"}`
- `ethics-committee` (static) : 5 persons nommées (Marie CEO, Claire CHRO, Paul CFO, Isabelle Support, Sophie Platform)
- `engineering-broad` (derived) : `source_node_id = engineering node`
- `diversity-lunch` (hybrid) : règle `{"role": "manager"}` + inclusions Emma/Raphaël + exclusion Marie
- `paris-office` (dynamic) : `{"site_id": "<paris-hq-id>"}`

**Sites (3 buildings) :**
- Paris HQ (building, 18 rue de la Paix, GPS 48.869, 2.331)
  - RdC (floor)
    - Accueil (room, capacity 5)
    - Salle Phoenix (room, capacity 10, bookable, videoconf)
  - 1er étage (floor)
    - Open space Engineering (room, capacity 30)
    - Salle Alpha (room, capacity 6, bookable)
  - 2e étage (floor)
    - Bureau Marie (room, capacity 2)
    - Desk 2-1..2-8 (desk × 8, hot-desk sauf 2-1 assigné)
- Lyon Annex (building, 5 place Bellecour)
  - RdC (floor)
    - Salle Lyon (room, capacity 6, bookable)
- Remote (building, virtual, no GPS)
  - Home (floor)
    - Desk remote (desk, bookable=false)

**Site-persons (30) :** 20 persons rattachées Paris HQ primary, 8 Lyon, 2 Remote.

**Bookings (10) :** 10 bookings à venir sur Alpha/Phoenix/Lyon avec différents ownership.

---

## 7. Waves

### Wave 1 (3j) — Backend data + matcher

- W1.T1 Migration 505 + tests checksum
- W1.T2 Models + repos `Group`, `Site`, `SitePerson`, `Booking`
- W1.T3 Rule matcher `groups/matcher.rs` + tests unitaires (JSON → SQL WHERE)
- W1.T4 Handlers `groups.rs` CRUD + `/members` (résolu)
- W1.T5 Handlers `sites.rs` + `bookings.rs` + `/availability` + `/occupancy`

### Wave 2 (3j) — Seeds + UI browse

- W2.T6 Seeds SO7 : 6 groupes + 3 buildings + 30 site-persons + 10 bookings + tests idempotence
- W2.T7 Page `/admin/groups` + `/admin/groups/[id]` : liste + filtres + création + rule-editor
- W2.T8 Page `/admin/sites` : site-tree + détail + booking-calendar basique
- W2.T9 Tabs enrichis : `groups-tab.tsx` (node + person) + `sites-tab.tsx` (node + person)

### Wave 3 (2j) — Bookings avancé + occupancy + merge

- W3.T10 Booking calendar full (drag-drop create, conflict detection, edit/cancel)
- W3.T11 Heatmap occupancy + filtres date range + export CSV
- W3.T12 E2E Playwright (3 scénarios) + docs + merge

---

## 8. Exit criteria

- [ ] Migration 505 appliquée, 5 nouvelles tables + 3 triggers
- [ ] Rule matcher évalue les 8 opérateurs DSL correctement
- [ ] 6 groupes + 3 sites + 10 bookings seedés
- [ ] Tabs Groupes/Sites fonctionnels (node + person)
- [ ] Pages admin `/admin/groups` + `/admin/sites` livrées
- [ ] Rule editor visuel fonctionnel
- [ ] Booking calendar avec conflict detection
- [ ] Heatmap occupancy rendu
- [ ] Clippy + TS clean, boot < 5s
- [ ] 3 E2E verts (ou skip gracieux)
- [ ] Merge main

---

**Fin spec SO7.**
