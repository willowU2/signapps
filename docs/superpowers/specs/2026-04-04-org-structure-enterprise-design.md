# Org Structure Enterprise — Design Specification

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Backend (signapps-workforce) + Frontend (org-structure page) + Migrations SQL

---

## 1. Objectif

Refondre le module de structure organisationnelle pour supporter les grands groupes internationaux (10K+ personnes, multi-pays, multi-filiales) tout en restant utilisable dès le jour 1 par une PME mono-entité.

### Principes directeurs

- **SignApps = source de vérité** — l'annuaire externe (Kanidm/LDAP) est un consommateur, pas un maître
- **API-first** — chaque fonctionnalité est accessible via REST avant d'avoir une UI
- **Patterns Kanidm sans copie de code** — adopter les concepts (entry lifecycle, memberOf, policy-on-groups, privilege elevation, high-privilege taint, fail-fast batch, event pipeline, referential integrity, schema-as-data) en les réimplémentant en Rust/PostgreSQL
- **Hybride SQL + JSONB + pgvector** — tables relationnelles pour le cœur, JSONB `attributes` pour l'extensibilité, pgvector pour le RAG
- **Licence** — tout le code est propriétaire SignApps, aucune dépendance MPL/GPL requise

---

## 2. Architecture en couches

```
┌─────────────────────────────────────────────────────────┐
│  Couche API (Axum REST + futur LDAP Gateway read-only)  │
│  OpenAPI / SCIM / LDAP v3 compatible                    │
├─────────────────────────────────────────────────────────┤
│  Identity Engine                                         │
│  Auth JWT/OIDC/SAML · MFA/Passkeys · Sessions ·         │
│  Privilege Elevation                                     │
├─────────────────────────────────────────────────────────┤
│  Org Engine                                              │
│  Arbre Org · Affectations · Groupes transverses ·        │
│  Sites/Géographie · Conventions                          │
├─────────────────────────────────────────────────────────┤
│  Policy Engine (GPO)                                     │
│  GPO Engine · RBAC Resolver · Delegation Chains ·        │
│  Naming Policies · Audit Trail                           │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector (BDD RAG unifiée)                 │
│  Tables relationnelles + JSONB extensible + Index vec    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Schéma de données PostgreSQL

### 3.1 Cœur Org

#### `org_trees`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| tenant_id | UUID | NOT NULL, FK tenants | Tenant propriétaire |
| tree_type | TEXT | NOT NULL, CHECK (internal/clients/suppliers) | Type d'arbre |
| name | TEXT | NOT NULL | Nom affiché |
| root_node_id | UUID | FK org_nodes, NULLABLE | Nœud racine (set après création) |
| description | TEXT | | Description optionnelle |
| attributes | JSONB | DEFAULT '{}' | Attributs extensibles |
| is_active | BOOLEAN | DEFAULT true | Soft-delete |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

#### `org_node_types`

Types de nœuds extensibles (schema-as-data, pattern Kanidm).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| tree_type | TEXT | NOT NULL | Applicable à quel type d'arbre |
| name | TEXT | NOT NULL | Identifiant technique (ex: department) |
| label | TEXT | NOT NULL | Label affiché (ex: Département) |
| color | TEXT | | Couleur CSS |
| icon | TEXT | | Icône lucide |
| sort_order | INT | DEFAULT 0 | Ordre d'affichage |
| allowed_children | TEXT[] | | Types de nœuds enfants autorisés |
| schema | JSONB | DEFAULT '{}' | Schéma des attributs custom attendus |
| is_active | BOOLEAN | DEFAULT true | |

Seed par défaut :
- **internal:** group, subsidiary, bu, department, service, team, position
- **clients:** client_group, client, project, workstream
- **suppliers:** supplier_group, supplier, contract

#### `org_nodes`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| tree_id | UUID | NOT NULL, FK org_trees | Arbre parent |
| parent_id | UUID | FK org_nodes, NULLABLE | Nœud parent (NULL = racine) |
| node_type | TEXT | NOT NULL | Référence org_node_types.name |
| name | TEXT | NOT NULL | Nom affiché |
| code | TEXT | | Code court unique dans l'arbre |
| description | TEXT | | |
| sort_order | INT | DEFAULT 0 | Ordre parmi les frères |
| is_active | BOOLEAN | DEFAULT true | |
| lifecycle_state | TEXT | DEFAULT 'live' | live / recycled / tombstone (pattern Kanidm) |
| attributes | JSONB | DEFAULT '{}' | Attributs extensibles |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Index:** `(tree_id, parent_id)`, `(tree_id, code) UNIQUE WHERE code IS NOT NULL`, `(tenant_id, lifecycle_state)`

### 3.2 Personnes et Affectations

#### `persons`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| first_name | TEXT | NOT NULL | |
| last_name | TEXT | NOT NULL | |
| email | TEXT | | Email professionnel |
| phone | TEXT | | |
| avatar_url | TEXT | | |
| user_id | UUID | FK users, NULLABLE | Lien vers le compte utilisateur |
| is_active | BOOLEAN | DEFAULT true | |
| lifecycle_state | TEXT | DEFAULT 'live' | live / recycled / tombstone |
| attributes | JSONB | DEFAULT '{}' | Extensible (job_title, employee_id, etc.) |
| created_at | TIMESTAMPTZ | | |
| updated_at | TIMESTAMPTZ | | |

#### `assignments`

Affectation d'une personne à un nœud org.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| person_id | UUID | NOT NULL, FK persons | |
| node_id | UUID | NOT NULL, FK org_nodes | |
| assignment_type | TEXT | NOT NULL | holder / interim / deputy / intern / contractor |
| responsibility_type | TEXT | NOT NULL | hierarchical / functional / matrix |
| start_date | DATE | NOT NULL | Date d'effet |
| end_date | DATE | | NULL = en cours |
| fte_ratio | DECIMAL(3,2) | DEFAULT 1.00 | Ratio temps plein (0.01 - 1.00) |
| is_primary | BOOLEAN | DEFAULT false | Affectation principale |
| attributes | JSONB | DEFAULT '{}' | |
| created_at | TIMESTAMPTZ | | |
| updated_at | TIMESTAMPTZ | | |

**Contrainte :** Une personne ne peut avoir qu'une seule affectation `is_primary = true` active à la fois.

#### `assignment_history`

Audit immutable de chaque changement d'affectation.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| assignment_id | UUID | NOT NULL, FK assignments | |
| action | TEXT | NOT NULL | created / modified / ended / transferred |
| changed_by | UUID | FK users | Qui a fait le changement |
| changes | JSONB | NOT NULL | Diff avant/après |
| reason | TEXT | | Motif du changement |
| effective_date | DATE | NOT NULL | Date d'effet du changement |
| created_at | TIMESTAMPTZ | DEFAULT now() | Horodatage du changement |

### 3.3 Groupes transverses

#### `org_groups`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| name | TEXT | NOT NULL | Nom du groupe |
| description | TEXT | | |
| group_type | TEXT | NOT NULL | static / dynamic / derived / hybrid |
| filter | JSONB | | Filtre pour groupes dynamiques/dérivés |
| managed_by | UUID | FK org_groups, NULLABLE | Groupe qui administre ce groupe (delegation pattern Kanidm) |
| valid_from | TIMESTAMPTZ | | Début de validité (NULL = immédiat) |
| valid_until | TIMESTAMPTZ | | Fin de validité (NULL = permanent) |
| is_active | BOOLEAN | DEFAULT true | |
| attributes | JSONB | DEFAULT '{}' | |
| created_at | TIMESTAMPTZ | | |
| updated_at | TIMESTAMPTZ | | |

**Types de filtre (JSONB) :**

```json
// dynamic: filtre sur attributs
{"type": "dynamic", "conditions": [
  {"field": "node_type", "op": "in", "value": ["department"]},
  {"field": "node.tree_type", "op": "eq", "value": "internal"}
]}

// derived: dérivé de la structure org
{"type": "derived", "source": "assignment", "conditions": [
  {"field": "assignment_type", "op": "eq", "value": "holder"},
  {"field": "node.parent_id", "op": "eq", "value": "<root_node_id>"}
]}

// hybrid: base dynamique + overrides manuels
{"type": "hybrid", "base_filter": {...}, "include": ["uuid1"], "exclude": ["uuid2"]}
```

#### `org_group_members`

Membres explicites (statique + overrides manuels pour hybride).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| group_id | UUID | NOT NULL, FK org_groups | |
| member_type | TEXT | NOT NULL | person / group / node |
| member_id | UUID | NOT NULL | UUID de la personne, groupe ou nœud |
| is_manual_override | BOOLEAN | DEFAULT false | Override manuel pour groupes hybrides |
| created_at | TIMESTAMPTZ | | |

**Note :** `member_type = node` signifie "toutes les personnes affectées à ce nœud et ses descendants".

#### `org_memberof` (index inverse auto-calculé)

Table matérialisée, maintenue par trigger PostgreSQL (pattern Kanidm memberOf).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| person_id | UUID | NOT NULL, FK persons | |
| group_id | UUID | NOT NULL, FK org_groups | |
| source | TEXT | NOT NULL | direct / nested / dynamic / node |
| computed_at | TIMESTAMPTZ | DEFAULT now() | Dernier recalcul |

**PK:** `(person_id, group_id, source)`

**Trigger de recalcul :** Se déclenche sur INSERT/UPDATE/DELETE de `org_group_members`, `assignments`, et `org_groups.filter`. Gère les groupes imbriqués (récursion avec détection de cycles).

### 3.4 Policies GPO

#### `org_policies`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| name | TEXT | NOT NULL | Identifiant unique lisible (ex: pol_corp_security) |
| description | TEXT | | |
| domain | TEXT | NOT NULL | security / modules / naming / delegation / compliance / custom |
| priority | INT | NOT NULL, DEFAULT 100 | Plus petit = plus prioritaire |
| is_enforced | BOOLEAN | DEFAULT false | Non-bloquable par les enfants |
| is_disabled | BOOLEAN | DEFAULT false | Désactivée temporairement |
| settings | JSONB | NOT NULL | Les règles de la policy |
| version | INT | DEFAULT 1 | Versioning pour audit |
| attributes | JSONB | DEFAULT '{}' | |
| created_at | TIMESTAMPTZ | | |
| updated_at | TIMESTAMPTZ | | |

**Exemples de settings par domaine :**

```json
// domain: security
{
  "auth.mfa_required": true,
  "auth.session_max_hours": 8,
  "auth.password_min_length": 14,
  "auth.allowed_methods": ["passkey", "totp"],
  "auth.privilege_elevation_minutes": 30
}

// domain: modules
{
  "modules.enabled": ["calendar", "mail", "chat"],
  "modules.disabled": ["billing"],
  "modules.devtools": true
}

// domain: naming
{
  "naming.email_pattern": "{first}.{last}@{domain}",
  "naming.username_pattern": "{first[0]}{last}",
  "naming.node_code_pattern": "{country}-{dept_code}",
  "naming.allowed_domains": ["corp.com", "fr.corp.com"]
}

// domain: delegation
{
  "delegation.max_depth": null,
  "delegation.allowed_permissions": ["manage_persons", "manage_assignments"],
  "delegation.require_approval": false
}

// domain: compliance
{
  "compliance.data_residency": "EU",
  "compliance.gdpr": true,
  "compliance.retention_years": 5,
  "compliance.right_to_forget": true
}
```

#### `org_policy_links`

Lie une policy à un point d'ancrage (nœud, groupe, site, pays, global).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| policy_id | UUID | NOT NULL, FK org_policies | |
| link_type | TEXT | NOT NULL | node / group / site / country / global |
| link_id | TEXT | NOT NULL | UUID du nœud/groupe/site ou code pays ISO 3166 ou '*' pour global |
| is_blocked | BOOLEAN | DEFAULT false | Bloquer l'héritage de cette policy à ce point |
| created_at | TIMESTAMPTZ | | |

**Contrainte unique :** `(policy_id, link_type, link_id)`

#### `country_policies`

Mapping automatique pays → policies compliance.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| country_code | TEXT | NOT NULL | ISO 3166-1 alpha-2 |
| policy_id | UUID | NOT NULL, FK org_policies | |

**Seed par défaut :**
- FR → RGPD
- DE → RGPD + Betriebsverfassungsgesetz
- US → CCPA (si CA) / at-will employment
- JP → APPI
- GB → UK GDPR post-Brexit

### 3.5 Sites et Géographie

#### `sites`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| parent_id | UUID | FK sites, NULLABLE | Hiérarchie de sites |
| site_type | TEXT | NOT NULL | campus / building / floor / room / coworking |
| name | TEXT | NOT NULL | |
| code | TEXT | | Code court |
| address | TEXT | | |
| city | TEXT | | |
| country_code | TEXT | | ISO 3166-1 alpha-2 |
| geo_lat | DOUBLE PRECISION | | |
| geo_lng | DOUBLE PRECISION | | |
| timezone | TEXT | DEFAULT 'UTC' | IANA timezone |
| capacity | INT | | Capacité maximale |
| legal_entity | TEXT | | Entité légale rattachée |
| is_active | BOOLEAN | DEFAULT true | |
| attributes | JSONB | DEFAULT '{}' | subnet, vlan, dns_suffix, amenities, etc. |
| created_at | TIMESTAMPTZ | | |
| updated_at | TIMESTAMPTZ | | |

#### `site_assignments`

Lie personnes et nœuds org à des sites (N:M).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| site_id | UUID | NOT NULL, FK sites | |
| assignee_type | TEXT | NOT NULL | person / node |
| assignee_id | UUID | NOT NULL | |
| is_primary | BOOLEAN | DEFAULT false | Site principal |
| schedule | JSONB | | Planning de présence (ex: lundi-mercredi) |
| created_at | TIMESTAMPTZ | | |

### 3.6 Délégations

#### `org_delegations`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| delegator_id | UUID | NOT NULL, FK persons | Qui délègue |
| delegate_type | TEXT | NOT NULL | person / group |
| delegate_id | UUID | NOT NULL | À qui on délègue |
| scope_node_id | UUID | NOT NULL, FK org_nodes | Sous-arbre délégué |
| permissions | JSONB | NOT NULL | Liste des droits délégués |
| delegated_by | UUID | FK persons | Qui a créé cette délégation |
| depth | INT | DEFAULT 0 | Profondeur de sub-délégation (0 = première) |
| parent_delegation_id | UUID | FK org_delegations, NULLABLE | Délégation parente (pour chaîne) |
| expires_at | TIMESTAMPTZ | | Expiration optionnelle |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | | |

**Exemple de permissions JSONB :**

```json
{
  "manage_persons": true,
  "manage_assignments": true,
  "manage_groups": false,
  "manage_policies": false,
  "manage_structure": false,
  "view_audit": true,
  "manage_sites": false,
  "sub_delegate": true
}
```

### 3.7 Audit

#### `org_audit_log`

Audit immutable de toutes les opérations org (pattern Kanidm security logging).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| actor_id | UUID | NOT NULL | Qui a fait l'action |
| actor_type | TEXT | NOT NULL | user / system / trigger |
| action | TEXT | NOT NULL | create / update / delete / move / assign / delegate / policy_change |
| entity_type | TEXT | NOT NULL | node / person / assignment / group / policy / site / delegation |
| entity_id | UUID | NOT NULL | |
| changes | JSONB | NOT NULL | Diff avant/après |
| metadata | JSONB | DEFAULT '{}' | IP, user-agent, privilege_elevated, etc. |
| created_at | TIMESTAMPTZ | DEFAULT now() | Immutable |

**Partition :** Par mois (`created_at`) pour les performances sur gros volumes.

**Index :** `(tenant_id, entity_type, entity_id)`, `(tenant_id, actor_id)`, `(tenant_id, created_at DESC)`

---

## 4. Algorithme de résolution de policy

```
resolve_effective_policy(person_id) -> EffectivePolicy:

  1. COLLECTER les policies par source
     org_policies   ← walk ancestors de chaque assignment.node_id
     site_policies  ← walk ancestors de chaque site_assignment.site_id
     country_pols   ← DISTINCT country_code des sites de la personne
     group_policies ← policy_links WHERE link_type='group' AND group_id IN person.memberof
     global_pols    ← policy_links WHERE link_type='global'

  2. FILTRER
     - Exclure is_disabled = true
     - Exclure policies avec is_blocked = true au point d'ancrage ancêtre

  3. SÉPARER
     enforced ← WHERE is_enforced = true
     normal   ← WHERE is_enforced = false

  4. MERGER par domaine
     domain = 'security':
       Pour chaque setting key:
         enforced d'abord, puis normal
         Résolution: le plus STRICT gagne
         (max pour min_length, true > false pour booleans, min pour timeouts,
          intersection pour allowed lists)

     domain IN ('modules', 'naming', 'delegation', 'compliance'):
       enforced d'abord (priority ASC), puis normal (priority ASC)
       Résolution: le premier non-null gagne (plus petit priority = plus prioritaire)

     domain = 'custom':
       deep_merge par priority ASC (les clés du plus prioritaire écrasent)

  5. RETOURNER
     {
       settings: { ...merged settings par domaine },
       sources: [ { key, value, policy_id, policy_name, link_type, via } ]
     }
```

Le champ `sources` permet de répondre à "pourquoi cette personne a ce droit ?" — traçabilité complète.

---

## 5. Rôles d'administration par défaut

| Rôle | Scope | Droits | High-privilege |
|------|-------|--------|----------------|
| platform_admin | Global | Tout (domaine, intégrations, réplication) | Oui |
| idm_admin | Global | Personnes, groupes, assignments | Oui |
| policy_admin | Global | Policies GPO, naming, compliance | Oui |
| org_admin | Global | Arbre, nœuds, sites | Non |
| group_admin | Global | Groupes transverses | Non |
| audit_viewer | Global | Lecture audit trail | Non |
| delegated_admin | Sous-arbre | Selon permissions JSONB de la délégation | Non |
| service_desk | Global | Reset password, lock/unlock comptes | Non |
| manager | Sous-arbre | Ses subordonnés directs (assignments, view) | Non |

**Protection high-privilege (pattern Kanidm) :** Les membres d'un groupe marqué `high_privilege = true` ne peuvent pas être modifiés par des rôles inférieurs. Un service_desk ne peut pas reset le password d'un idm_admin.

---

## 6. Groupes transverses

### Types

| Type | Membres | Exemple |
|------|---------|---------|
| **static** | Ajoutés manuellement | Comité RGPD, Projet Alpha |
| **dynamic** | Calculés par filtre sur attributs | All IT (node_type IN dsi, engineering) |
| **derived** | Dérivés de la structure org | Managers N-1 (holders des enfants directs de root) |
| **hybrid** | Base dynamique + overrides manuels | All IT + Dave (ajouté manuellement) |

### Capacités

- **Imbrication** — un groupe peut contenir d'autres groupes
- **MemberOf auto-calculé** — trigger PG maintient `org_memberof` (index inverse)
- **Policy attachable** — les GPO s'attachent aux groupes via `org_policy_links`
- **Délégation** — `managed_by` pointe vers un groupe gestionnaire (pattern Kanidm `entry_managed_by`)
- **Scope temporel** — `valid_from`/`valid_until` pour projets et missions
- **Détection de cycles** — le trigger memberOf détecte et coupe les boucles d'imbrication

---

## 7. Sites et résolution 3 axes

La policy effective d'une personne combine 3 axes indépendants :

```
Policy effective = merge(
  policies de l'arbre org (via assignments),
  policies des sites (via site_assignments),
  policies pays (via country_code des sites)
)
```

Le `country_code` du site injecte automatiquement les policies compliance via `country_policies`. Ajouter un site au Japon active automatiquement l'APPI sans action manuelle.

---

## 8. Endpoints API REST

### Arbres et nœuds (existants, à enrichir)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/workforce/org/trees` | Lister les arbres |
| POST | `/workforce/org/trees` | Créer un arbre |
| GET | `/workforce/org/trees/{id}` | Détail d'un arbre |
| CRUD | `/workforce/org/nodes/*` | Nœuds (existant) |
| POST | `/workforce/org/nodes/{id}/move` | Déplacer un nœud (existant) |
| GET | `/workforce/org/nodes/{id}/descendants` | Descendants (existant) |
| GET | `/workforce/org/nodes/{id}/effective-policy` | Policy effective du nœud |
| CRUD | `/workforce/org/node-types` | Types de nœuds extensibles |

### Personnes et affectations (existants)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| CRUD | `/workforce/employees/*` | Personnes |
| CRUD | `/workforce/assignments/*` | Affectations |
| GET | `/workforce/assignments/history` | Historique des affectations |

### Groupes transverses (nouveau)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/workforce/groups` | Lister les groupes |
| POST | `/workforce/groups` | Créer un groupe |
| GET | `/workforce/groups/{id}` | Détail avec membres résolus |
| PUT | `/workforce/groups/{id}` | Modifier |
| DELETE | `/workforce/groups/{id}` | Supprimer (recycle) |
| POST | `/workforce/groups/{id}/members` | Ajouter un membre |
| DELETE | `/workforce/groups/{id}/members/{member_id}` | Retirer un membre |
| GET | `/workforce/groups/{id}/effective-members` | Membres résolus (dynamic + static) |
| GET | `/workforce/employees/{id}/memberof` | Groupes d'une personne |

### Policies GPO (nouveau)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/workforce/policies` | Lister les policies |
| POST | `/workforce/policies` | Créer une policy |
| GET | `/workforce/policies/{id}` | Détail |
| PUT | `/workforce/policies/{id}` | Modifier |
| DELETE | `/workforce/policies/{id}` | Supprimer |
| POST | `/workforce/policies/{id}/links` | Attacher à un nœud/groupe/site/pays |
| DELETE | `/workforce/policies/{id}/links/{link_id}` | Détacher |
| GET | `/workforce/policies/resolve/{person_id}` | Policy effective d'une personne |
| GET | `/workforce/policies/resolve/node/{node_id}` | Policy effective d'un nœud |
| GET | `/workforce/policies/simulate` | Simuler un changement de policy |

### Sites (existant, à enrichir)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| CRUD | `/workforce/sites/*` | Sites (existant) |
| POST | `/workforce/sites/{id}/assign` | Affecter personne/nœud à un site |
| DELETE | `/workforce/sites/{id}/assign/{assignment_id}` | Retirer |
| GET | `/workforce/sites/{id}/effective-policy` | Policy effective du site |

### Délégations (nouveau)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/workforce/delegations` | Lister les délégations |
| POST | `/workforce/delegations` | Créer une délégation |
| PUT | `/workforce/delegations/{id}` | Modifier |
| DELETE | `/workforce/delegations/{id}` | Révoquer |
| GET | `/workforce/delegations/my` | Mes délégations (reçues) |
| GET | `/workforce/delegations/granted` | Délégations que j'ai données |

### Audit (nouveau)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/workforce/audit` | Log d'audit filtrable |
| GET | `/workforce/audit/entity/{type}/{id}` | Historique d'une entité |
| GET | `/workforce/audit/actor/{person_id}` | Actions d'un acteur |

---

## 9. UX — Commander + Focus Mode

### Mode normal (triple panel)

```
┌──────────────┬──────────────────────────┬──────────────────┐
│  Navigation  │       Contenu            │    Détail        │
│              │                          │                  │
│  [Arbre]     │  ┌──────────────────┐    │  Type: Dept      │
│  [Groupes]   │  │ Arbre/Orgchart/  │    │  Nom: DSI        │
│  [Sites]     │  │ Liste            │    │  Code: FR-DSI    │
│              │  │                  │    │                  │
│  ▼ Corp      │  │  Stats + Vue     │    │  [Détails]       │
│    ▼ France  │  │  principale      │    │  [Personnes]     │
│      ●DSI    │  │                  │    │  [Policies]      │
│      DRH     │  │                  │    │  [Sites]         │
│    ▶ US      │  └──────────────────┘    │  [Audit]         │
│              │                          │                  │
│  🔍 Chercher │  3 policies · 12 pers   │  Policies eff.   │
└──────────────┴──────────────────────────┴──────────────────┘
```

- **Navigation gauche** : 3 onglets (Arbre, Groupes, Sites) + recherche
- **Contenu central** : 3 modes de vue (arbre, organigramme, liste) + barre de stats
- **Détail droit** : 5 onglets (Détails, Personnes, Policies, Sites, Audit)

### Mode focus (pleine page)

Déclenché par double-clic ou Entrée sur un nœud. Le panneau de navigation se réduit, le détail occupe toute la largeur avec :

- Breadcrumb de navigation
- 6 onglets (Détails, Personnes, Policies, Sites, Délégations, Audit)
- Formulaires complets, tableaux, timeline
- KPIs (effectif, taux occupation, turnover, compliance score)
- Bouton retour → revient au mode normal

### Responsive

- **≥1280px** : Triple panel complet
- **768-1279px** : Navigation collapsible (drawer), contenu + détail
- **<768px** : Navigation et détail en overlay, contenu seul visible

---

## 10. Patterns Kanidm appliqués

| # | Pattern | Implémentation SignApps |
|---|---------|------------------------|
| 1 | Entry lifecycle (Live → Recycled → Tombstone) | Colonne `lifecycle_state` sur org_nodes et persons |
| 2 | MemberOf auto-compute | Trigger PG sur org_group_members, assignments, org_groups.filter → MAJ org_memberof |
| 3 | High-privilege taint | Colonne `high_privilege` sur org_groups, vérifié dans le middleware d'autorisation |
| 4 | Privilege elevation | Session JWT read-only par défaut, re-auth pour écriture (fenêtre configurable via policy) |
| 5 | Referential integrity | FK PostgreSQL + trigger de nettoyage des références pendantes |
| 6 | Fail-fast batch | Transactions SERIALIZABLE, rollback complet en cas d'erreur |
| 7 | Event pipeline | Validate → ACP check → Pre-hooks → Write → Post-hooks (memberOf, audit, referential) |
| 8 | Schema-as-data | org_node_types extensible sans migration SQL |
| 9 | Policy-on-groups | org_policies attachable via org_policy_links à tout type d'entité |
| 10 | LDAP gateway (futur) | Endpoint LDAP v3 read-only exposant l'arbre org en format LDAP standard |

---

## 11. Migrations SQL

Ordre d'application :

1. `XXX_org_node_types.sql` — Types de nœuds extensibles + seed
2. `XXX_org_trees_update.sql` — Ajout attributes JSONB, description sur org_trees
3. `XXX_org_nodes_update.sql` — Ajout lifecycle_state, attributes JSONB sur org_nodes
4. `XXX_persons_update.sql` — Ajout lifecycle_state, attributes JSONB sur persons
5. `XXX_org_groups.sql` — Table org_groups + org_group_members
6. `XXX_org_memberof.sql` — Table org_memberof + triggers de recalcul
7. `XXX_org_policies.sql` — Tables org_policies + org_policy_links + country_policies + seed
8. `XXX_sites_update.sql` — Enrichir sites (country_code, legal_entity, attributes) + site_assignments
9. `XXX_org_delegations.sql` — Table org_delegations
10. `XXX_org_audit_log.sql` — Table org_audit_log partitionnée par mois

---

## 12. Hors périmètre (futur)

- LDAP gateway read-only (intégration Kanidm/OpenLDAP)
- SCIM endpoint pour sync externe
- Import/export bulk CSV/SCIM
- Organigramme interactif depuis backend (`/workforce/org/orgchart`)
- Notifications temps réel sur changements org (via WebSocket/SSE)
- Reporting BI (effectifs, turnover, compliance dashboard)
