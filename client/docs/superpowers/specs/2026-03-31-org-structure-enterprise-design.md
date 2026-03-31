# Structure Organisationnelle Enterprise — Design Spec

## Objectif

Remplacer le modèle workforce actuel (employees liés à des org_nodes) par un modèle enterprise complet :
- **Party Model** : une personne = une entité unique avec N rôles (employé, client, fournisseur)
- **Arbres agnostiques** : la structure org existe indépendamment des personnes (positions ≠ personnes)
- **Affectations temporelles** : historique complet de qui a occupé quoi, quand, pourquoi
- **Sites géographiques** : dimension séparée rattachée aux noeuds et personnes
- **Profils de droits** : la position détermine les permissions applicatives
- **Groupes auto** : chaque noeud org génère un groupe pour les ACL données
- **Multi-entreprise** : un tenant, isolation souple via ACL basées sur la structure

## Décisions architecturales

- **Arbre unique** par type (internal, clients, suppliers) avec closure table pour requêtes O(1)
- **Positions agnostiques** : un noeud `position` existe sans occupant. Les personnes sont AFFECTÉES.
- **Affectations avec responsabilité** : hiérarchique (RH), fonctionnelle (tech), matricielle (projet)
- **Historique complet** : chaque changement d'affectation est loggé (qui, quand, pourquoi)
- **Sites séparés** : structure géographique indépendante de la structure fonctionnelle
- **Propagation à tous les modules** : Drive, Calendrier, Mail, Chat, Billing, Projets via groupes auto
- **Noeuds transverses** : BU/services rattachés au groupe (racine) sont accessibles par toutes les filiales

---

## 1. Modèle de données

### 1.1 Party Model — `core.persons` + `core.person_roles`

```sql
CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE core.persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE core.person_role_type AS ENUM ('employee', 'client_contact', 'supplier_contact', 'partner');

CREATE TABLE core.person_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    role_type core.person_role_type NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(person_id, role_type)
);
```

`metadata` pour employee : `{"employee_number": "EMP-001", "contract_type": "CDI", "fte_ratio": 1.0, "hire_date": "2024-01-15"}`
`metadata` pour client_contact : `{"title": "Directeur Achats", "is_decision_maker": true}`

### 1.2 Arbres — `core.org_trees` + `core.org_nodes` + `core.org_closure`

```sql
CREATE TYPE core.tree_type AS ENUM ('internal', 'clients', 'suppliers');

CREATE TABLE core.org_trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tree_type core.tree_type NOT NULL,
    name TEXT NOT NULL,
    root_node_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, tree_type)
);

CREATE TABLE core.org_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES core.org_trees(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES core.org_nodes(id) ON DELETE SET NULL,
    node_type TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    config JSONB DEFAULT '{}',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE core.org_closure (
    ancestor_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    depth INT NOT NULL DEFAULT 0,
    PRIMARY KEY (ancestor_id, descendant_id)
);
```

Types de noeuds internes : `group`, `subsidiary`, `bu`, `department`, `service`, `team`, `position`
Types clients : `client_group`, `client_company`, `client_division`, `client_site`
Types fournisseurs : `supplier_group`, `supplier_company`, `supplier_site`

### 1.3 Affectations — `core.assignments` + `core.assignment_history`

```sql
CREATE TYPE core.assignment_type AS ENUM ('holder', 'interim', 'deputy', 'intern', 'contractor');
CREATE TYPE core.responsibility_type AS ENUM ('hierarchical', 'functional', 'matrix');

CREATE TABLE core.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    assignment_type core.assignment_type DEFAULT 'holder',
    responsibility_type core.responsibility_type DEFAULT 'hierarchical',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    fte_ratio DECIMAL(3,2) DEFAULT 1.00,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE core.assignment_action AS ENUM ('created', 'modified', 'ended', 'transferred');

CREATE TABLE core.assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES core.assignments(id) ON DELETE CASCADE,
    action core.assignment_action NOT NULL,
    changed_by UUID REFERENCES identity.users(id),
    changes JSONB DEFAULT '{}',
    reason TEXT,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.4 Sites — `core.sites` + rattachements

```sql
CREATE TYPE core.site_type AS ENUM ('campus', 'building', 'floor', 'room');

CREATE TABLE core.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_id UUID REFERENCES core.sites(id) ON DELETE SET NULL,
    site_type core.site_type NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    geo_lat DOUBLE PRECISION,
    geo_lng DOUBLE PRECISION,
    timezone TEXT DEFAULT 'Europe/Paris',
    capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE core.node_sites (
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (node_id, site_id)
);

CREATE TABLE core.person_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_primary BOOLEAN DEFAULT TRUE
);
```

### 1.5 Profils de droits — `core.permission_profiles`

```sql
CREATE TABLE core.permission_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    inherit BOOLEAN DEFAULT TRUE,
    modules JSONB DEFAULT '{}',
    max_role TEXT DEFAULT 'user',
    custom_permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id)
);
```

`modules` : `{"drive": true, "billing": true, "admin": false, "calendar": true, "mail": true, "chat": true}`
`max_role` : `"admin"`, `"manager"`, `"editor"`, `"user"`

### 1.6 Groupes auto — Trigger

Quand un noeud org est créé → un `identity.groups` est créé avec :
- `source = 'org'`
- `external_id = org_node.id`
- `name = 'org:' || org_node.code || ':' || org_node.name`

Quand une personne est affectée (assignment créé) et a un `user_id` :
- Ajouter le user au groupe du noeud
- Ajouter le user aux groupes de tous les ancêtres (closure table)

Quand une personne est désaffectée :
- Retirer des groupes correspondants

---

## 2. Migration des données existantes

### workforce → core

```sql
-- Migrer les employés existants vers core.persons
INSERT INTO core.persons (tenant_id, first_name, last_name, email, phone, user_id, metadata)
SELECT tenant_id, first_name, last_name, email, phone, user_id,
       jsonb_build_object('employee_number', employee_number, 'contract_type', contract_type, 'hire_date', hire_date)
FROM workforce_employees;

-- Migrer les org_nodes vers core.org_nodes
INSERT INTO core.org_nodes (tree_id, parent_id, node_type, name, code, description, config, sort_order, is_active)
SELECT (SELECT id FROM core.org_trees WHERE tree_type = 'internal' LIMIT 1),
       parent_id, node_type, name, code, description, config, sort_order, is_active
FROM workforce_org_nodes;

-- Migrer la closure table
INSERT INTO core.org_closure (ancestor_id, descendant_id, depth)
SELECT ancestor_id, descendant_id, depth FROM workforce_org_closure;

-- Créer les affectations depuis les anciennes liaisons employee → org_node
INSERT INTO core.assignments (person_id, node_id, start_date)
SELECT p.id, e.org_node_id, COALESCE(e.hire_date, CURRENT_DATE)
FROM core.persons p
JOIN workforce_employees e ON e.user_id = p.user_id
WHERE e.org_node_id IS NOT NULL;
```

---

## 3. Propagation à tous les modules

| Module | Mécanisme | Exemple |
|--------|-----------|---------|
| **Drive** | Groupe auto `org:*` dans drive.acl | Dossier "Compta" → acl grantee_type=group, grantee_id=group:compta |
| **Calendrier** | Layer "Équipe" filtre par noeud org | Sélectionner "Compta" → voir les events de tous les affectés |
| **Mail** | Alias de diffusion auto | `compta@signapps.local` → tous les members du groupe org:compta |
| **Chat** | Canal auto par noeud | Noeud "Compta Lyon" → canal #compta-lyon créé automatiquement |
| **Contacts** | Arbre clients visible selon le noeud commercial | Un commercial voit ses clients, un directeur voit ceux de sa BU |
| **Billing** | Filtre par noeud org | Factures de la BU Commerce France uniquement |
| **Projets** | Ressources = personnes affectées aux noeuds participants | Projet "Refonte SI" → staffé depuis les noeuds IT de chaque filiale |
| **Présence RH** | presence_rules liées au noeud org | min_coverage = 2 techniciens sur le noeud "Support N1" |
| **Congés** | Approbateur = responsable hiérarchique de la position parent | Marie demande congé → va au titulaire du poste parent avec responsibility=hierarchical |
| **Timesheets** | Imputation par noeud org/projet | Heures imputées à "BU Commerce" ou "Projet X" |

### Middleware d'injection

Un middleware `org_context` injecte dans chaque requête :
1. Les noeuds org de l'utilisateur (via ses affectations actives)
2. Ses groupes auto (via closure table → tous les ancêtres)
3. Son profil de droits effectif (merge des profils de ses positions)

Chaque module peut ensuite filtrer ses données par `group_id IN (user_org_groups)`.

---

## 4. Endpoints API

### Arbres
```
GET    /api/v1/org/trees                    — lister (internal, clients, suppliers)
POST   /api/v1/org/trees                    — créer un arbre
GET    /api/v1/org/trees/:id/full           — arbre complet avec noeuds
```

### Noeuds
```
GET    /api/v1/org/nodes/:id                — détail du noeud
POST   /api/v1/org/nodes                    — créer
PUT    /api/v1/org/nodes/:id                — modifier
DELETE /api/v1/org/nodes/:id                — désactiver
POST   /api/v1/org/nodes/:id/move           — déplacer dans l'arbre
GET    /api/v1/org/nodes/:id/children       — enfants directs
GET    /api/v1/org/nodes/:id/descendants    — tous les descendants
GET    /api/v1/org/nodes/:id/ancestors      — chemin vers racine
GET    /api/v1/org/nodes/:id/assignments    — personnes affectées
GET    /api/v1/org/nodes/:id/permissions    — profil de droits
PUT    /api/v1/org/nodes/:id/permissions    — configurer droits
```

### Personnes
```
GET    /api/v1/persons                      — lister (filtres: role, node, site, active)
POST   /api/v1/persons                      — créer
PUT    /api/v1/persons/:id                  — modifier
GET    /api/v1/persons/:id                  — détail avec rôles + affectations
GET    /api/v1/persons/:id/assignments      — affectations actives
GET    /api/v1/persons/:id/history          — historique complet d'affectations
GET    /api/v1/persons/:id/effective-permissions — droits effectifs calculés
POST   /api/v1/persons/:id/link-user        — lier à un compte utilisateur
POST   /api/v1/persons/:id/unlink-user      — délier du compte
```

### Affectations
```
POST   /api/v1/assignments                  — affecter (person_id, node_id, type, responsibility, dates)
PUT    /api/v1/assignments/:id              — modifier
DELETE /api/v1/assignments/:id              — terminer (end_date = today)
GET    /api/v1/assignments/history          — historique global (filtres: person, node, date)
```

### Sites
```
GET    /api/v1/sites                        — lister
POST   /api/v1/sites                        — créer
PUT    /api/v1/sites/:id                    — modifier
GET    /api/v1/sites/:id/persons            — personnes sur ce site
POST   /api/v1/sites/:id/attach-node        — rattacher un noeud org
POST   /api/v1/sites/:id/attach-person      — rattacher une personne
```

### Organigramme
```
GET    /api/v1/org/orgchart                 — organigramme complet (structure + personnes affectées)
GET    /api/v1/org/orgchart?date=2025-01-15 — organigramme à une date passée
GET    /api/v1/org/orgchart/:node_id        — sous-arbre depuis un noeud
```

---

## 5. Frontend

### Pages
- `/admin/org-structure` — Éditeur d'arbre org (drag-drop, CRUD noeuds, types)
- `/admin/persons` — Gestion des personnes (CRUD, rôles, affectations)
- `/admin/sites` — Gestion des sites géographiques
- `/admin/permissions-matrix` — Vue matricielle noeuds × modules (qui a accès à quoi)
- `/team/org-chart` — Organigramme interactif (existant, enrichi)

### Composants
- `OrgTreeEditor` — Éditeur d'arbre avec types de noeuds colorés
- `AssignmentPanel` — Panneau d'affectation (personne ↔ position)
- `PersonCard` — Carte personne avec rôles et affectations
- `OrgChart` — Organigramme visuel avec personnes
- `SiteMap` — Carte des sites avec rattachements
- `PermissionMatrix` — Grille noeuds × modules

---

## 6. Fichiers à créer/modifier

### Backend
| Action | Fichier |
|--------|---------|
| Créer | `migrations/122_core_org_structure.sql` |
| Créer | `crates/signapps-db/src/models/core_org.rs` |
| Créer | `crates/signapps-db/src/repositories/core_org_repository.rs` |
| Créer | `services/signapps-identity/src/handlers/org_trees.rs` |
| Créer | `services/signapps-identity/src/handlers/org_nodes.rs` |
| Créer | `services/signapps-identity/src/handlers/persons.rs` |
| Créer | `services/signapps-identity/src/handlers/assignments.rs` |
| Créer | `services/signapps-identity/src/handlers/sites.rs` |
| Créer | `services/signapps-identity/src/services/org_groups_sync.rs` |
| Créer | `services/signapps-identity/src/middleware/org_context.rs` |
| Modifier | `services/signapps-identity/src/main.rs` (routes) |

### Frontend
| Action | Fichier |
|--------|---------|
| Créer | `client/src/lib/api/org.ts` |
| Créer | `client/src/types/org.ts` |
| Créer | `client/src/stores/org-store.ts` |
| Créer | `client/src/app/admin/org-structure/page.tsx` |
| Créer | `client/src/app/admin/persons/page.tsx` |
| Créer | `client/src/app/admin/sites/page.tsx` |
| Créer | `client/src/components/org/org-tree-editor.tsx` |
| Créer | `client/src/components/org/assignment-panel.tsx` |
| Créer | `client/src/components/org/person-card.tsx` |
| Créer | `client/src/components/org/site-map.tsx` |
| Modifier | `client/src/components/hr/org-chart.tsx` (enrichir) |
