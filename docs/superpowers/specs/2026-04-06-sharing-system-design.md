# Unified Sharing & Permissions System

**Date:** 2026-04-06
**Status:** Draft — Pending implementation plan
**Scope:** Nouveau crate `signapps-sharing` + schema SQL `sharing.*` + migration des systèmes existants

---

## 1. Contexte et motivation

SignApps Platform possède actuellement 3 systèmes de partage indépendants :

| Système | Service | Rôles | Limitations |
|---------|---------|-------|-------------|
| `drive.acl` | Storage | 5 (viewer→manager) | Spécifique aux fichiers |
| `calendar.members` | Calendar | 3 (viewer/editor/owner) | Pas de support groupes |
| `document_permissions` | Docs/Collab | 3 (view/edit/admin) | Pas d'héritage |

6 services n'ont aucun partage : Forms, Contacts, Mail, Chat (implicite workspace), IT Assets (implicite org), Vault (délégations).

**Objectif :** Un système unifié, secure by design, basé sur l'organisation, qui couvre tous les éléments partageables de la plateforme.

---

## 2. Décisions de design

| Décision | Choix | Justification |
|----------|-------|---------------|
| Périmètre | Unifié, tous les éléments | Un seul modèle = une seule UX, un seul code |
| Résolution conflits | Additive + deny explicite | Cumul naturel, deny bloque tout (AWS IAM/Azure AD) |
| Rôles | 3 fixes (viewer/editor/manager) + capabilities par type | UX simple, flexibilité par type |
| Source des droits | 3 axes : org node + groupes + position dans le groupe | Reflète la réalité organisationnelle |
| Reshare | Contrôlé par flag `can_reshare` (default false) | Contrôle au moment du grant |
| Visibilité par défaut | Configurable par type d'élément et par tenant | Secure by default, pragmatique par type |
| Friction | Héritage conteneurs + templates de partage | 80% automatique + 20% ad-hoc |
| Architecture | Shared crate (pas de nouveau microservice) | Zéro latence réseau, suit le pattern existant |

---

## 3. Architecture

### 3.1 Approche retenue : shared crate `signapps-sharing`

Nouveau crate dans le workspace, au même niveau que `signapps-common`, `signapps-db`, `signapps-cache`. Chaque service l'embarque et résout les permissions localement contre les tables `sharing.*` en DB.

**Dépendances :**
```
services/*  →  signapps-sharing  →  signapps-db
                                 →  signapps-common (Claims, AppError)
                                 →  signapps-cache (moka TTL)
```

### 3.2 Structure du crate

```
crates/signapps-sharing/src/
├── lib.rs           — Re-exports publics, SharingEngine
├── engine.rs        — API publique : check(), grant(), revoke(), effective_role(), shared_with_me()
├── resolver.rs      — Algorithme de résolution en 6 étapes
├── middleware.rs     — require_permission() Axum middleware layer
├── models.rs        — Grant, Policy, Template, Capability, AuditEntry, EffectivePermission
├── repository.rs    — SharingRepository (CRUD grants, policies, templates)
├── cache.rs         — Intégration signapps-cache pour L1/L2
├── audit.rs         — Logging des opérations de partage
├── types.rs         — ResourceType, Role, Action, GranteeType enums
└── defaults.rs      — Default capabilities par type, default visibility
```

---

## 4. Modèle de données

### 4.1 Schema `sharing`

#### `sharing.grants` — Table centrale des droits

Remplace : `drive.acl`, `calendar.members`, `document_permissions`.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | Identifiant unique |
| `tenant_id` | UUID FK NOT NULL | Isolation tenant |
| `resource_type` | TEXT NOT NULL | 'file', 'folder', 'calendar', 'event', 'document', 'form', 'contact_book', 'channel', 'asset', 'vault_entry' |
| `resource_id` | UUID NOT NULL | ID de l'élément partagé |
| `grantee_type` | TEXT NOT NULL | 'user', 'group', 'org_node', 'everyone' |
| `grantee_id` | UUID | NULL si everyone |
| `role` | TEXT NOT NULL | 'viewer', 'editor', 'manager', 'deny' |
| `can_reshare` | BOOL DEFAULT false | Autorisation de re-partager |
| `inherit` | BOOL DEFAULT true | Héritage vers les enfants du conteneur |
| `granted_by` | UUID FK NOT NULL | Qui a accordé le droit |
| `expires_at` | TIMESTAMPTZ | Expiration optionnelle |
| `created_at` | TIMESTAMPTZ NOT NULL | Timestamp de création |
| `updated_at` | TIMESTAMPTZ NOT NULL | Timestamp de modification |

**Index :**
- `(tenant_id, resource_type, resource_id, grantee_type, grantee_id)` UNIQUE
- `(tenant_id, grantee_type, grantee_id)` — "tous les partages de X"
- `(expires_at) WHERE expires_at IS NOT NULL` — cleanup job

#### `sharing.policies` — Héritage conteneurs

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `container_type` | TEXT | 'folder', 'calendar', 'form_space', 'channel_group' |
| `container_id` | UUID | |
| `grantee_type` | TEXT | |
| `grantee_id` | UUID | |
| `default_role` | TEXT | Rôle hérité par les enfants |
| `can_reshare` | BOOL | |
| `apply_to_existing` | BOOL | Rétroactif sur les éléments existants |

Quand un élément est créé dans un conteneur, un grant est auto-généré selon la policy active.

#### `sharing.templates` — Presets nommés

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `name` | TEXT | ex: "Équipe Marketing lecture" |
| `description` | TEXT | |
| `grants` | JSONB | `[{grantee_type, grantee_id, role, can_reshare}]` |
| `created_by` | UUID FK | |
| `is_system` | BOOL | Template prédéfini |

Appliquer un template = créer N grants d'un seul clic.

#### `sharing.capabilities` — Rôle → Actions par type

| Colonne | Type | Description |
|---------|------|-------------|
| `resource_type` | TEXT | PK composite |
| `role` | TEXT | PK composite |
| `actions` | TEXT[] | Liste d'actions autorisées |

#### `sharing.defaults` — Visibilité par défaut par type

| Colonne | Type | Description |
|---------|------|-------------|
| `tenant_id` | UUID FK | PK composite |
| `resource_type` | TEXT | PK composite |
| `default_visibility` | TEXT | 'private', 'workspace', 'org_node', 'tenant' |

**Defaults système :**

| Type | Visibilité par défaut |
|------|----------------------|
| file | private |
| folder | private |
| calendar | workspace |
| event | (hérite du calendar) |
| document | private |
| form | private |
| contact_book | private |
| channel | workspace |
| asset | org_node |
| vault_entry | private |

#### `sharing.audit_log` — Traçabilité complète

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `resource_type` | TEXT | |
| `resource_id` | UUID | |
| `actor_id` | UUID | |
| `action` | TEXT | grant_created, grant_revoked, deny_set, access_denied, etc. |
| `details` | JSONB | Contexte de l'opération |
| `created_at` | TIMESTAMPTZ | |

Table **INSERT-only** — pas de UPDATE, pas de DELETE.

---

## 5. Moteur de résolution

### 5.1 Algorithme — 6 étapes

```
check(user_ctx, resource_ref, action) -> Result<(), AppError>

1. OWNER CHECK
   Si user = owner de la ressource → return Ok(manager) [court-circuit]

2. DENY CHECK (priorité absolue)
   Chercher grants WHERE role='deny' matchant user (direct, groupe, org_node)
   Si deny trouvé → return Err(Forbidden) [court-circuit, non-overridable]

3. COLLECT GRANTS — 3 axes en parallèle
   Axe 1 (direct):   WHERE grantee_type='user' AND grantee_id = user.id
   Axe 2 (groupes):  WHERE grantee_type='group' AND grantee_id IN (user.group_ids)
   Axe 3 (org):      WHERE grantee_type='org_node' AND grantee_id IN (user.org_ancestors)
   + WHERE grantee_type='everyone' (tenant-wide)
   Filtre: WHERE (expires_at IS NULL OR expires_at > NOW())

4. HÉRITAGE CONTENEUR (walk up)
   Si pas de grants sur la ressource directement :
   Remonter au conteneur parent → grand-parent → ...
   Stop si inherit=false sur un grant (break inheritance)

5. MOST PERMISSIVE WINS
   effective_role = max(all collected grants.role)
   effective_can_reshare = any(all collected grants.can_reshare)
   Ordre: viewer(1) < editor(2) < manager(3)

6. CAPABILITY CHECK
   Lookup capabilities[resource_type][effective_role]
   Si action ∈ capabilities → Ok(())
   Sinon → Err(Forbidden)
```

### 5.2 UserContext

```rust
pub struct UserContext {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub group_ids: Vec<Uuid>,           // groupes dont l'user est membre
    pub group_roles: HashMap<Uuid, GroupRole>, // rôle dans chaque groupe
    pub org_ancestors: Vec<Uuid>,        // org nodes ancêtres (closure table)
    pub system_role: i16,                // admin/superadmin bypass
}
```

Construit depuis `Claims` + cache (group_ids TTL 5min, org_ancestors TTL 5min).

### 5.3 Cache

| Niveau | Clé | TTL | Invalidation |
|--------|-----|-----|-------------|
| L1 (moka) | user → group_ids | 5min | group_member change |
| L1 (moka) | user → org_ancestors | 5min | org reassignment |
| L1 (moka) | (resource_type, role) → capabilities | 1h | capability update |
| L2 (moka) | (user_id, resource_type, resource_id) → effective_role | 2min | grant create/update/delete |

Le deny check n'est jamais caché (sécurité > performance).

---

## 6. Capabilities par type de ressource

Les rôles sont cumulatifs : editor inclut toutes les capabilities de viewer, manager inclut toutes celles d'editor.

### file
- **viewer:** read, preview, download
- **editor:** + write, upload, rename, move, version
- **manager:** + delete, share, set_policy, trash, restore

### folder
- **viewer:** list, read_children
- **editor:** + create_child, upload, rename
- **manager:** + delete, share, set_policy, move

### calendar
- **viewer:** read, export
- **editor:** + create_event, edit_event, rsvp
- **manager:** + delete_event, share, configure, delete_calendar

### event
- **viewer:** read, export
- **editor:** + edit, rsvp, add_attachment
- **manager:** + delete, share, invite

### document
- **viewer:** read, export, comment
- **editor:** + write, suggest, history
- **manager:** + delete, share, lock, template

### form
- **viewer:** read, submit, view_own_responses
- **editor:** + edit_fields, view_all_responses, export
- **manager:** + delete, share, configure, archive

### contact_book
- **viewer:** read, search, export_vcard
- **editor:** + create, edit, import, merge
- **manager:** + delete, share, bulk_ops

### channel
- **viewer:** read, search_history
- **editor:** + post, react, thread, pin
- **manager:** + delete_msg, share, configure, archive, kick

### asset
- **viewer:** read, view_history
- **editor:** + edit, assign, add_note, check_out
- **manager:** + delete, share, decommission, transfer

### vault_entry (cas spécial)
- **viewer:** read_metadata (PAS le secret)
- **editor:** + read_secret, edit, rotate
- **manager:** + delete, share, audit
- **Restrictions :** pas de grant `grantee_type='everyone'`, chaque `read_secret` audité

---

## 7. API REST

### 7.1 Endpoints — pattern uniforme par type

```
# Grants CRUD
GET    /api/v1/{type}/{id}/grants              → Liste les grants
POST   /api/v1/{type}/{id}/grants              → Créer un grant (manager)
PATCH  /api/v1/{type}/{id}/grants/{grant_id}   → Modifier un grant (manager)
DELETE /api/v1/{type}/{id}/grants/{grant_id}    → Révoquer un grant (manager)

# Permissions effectives
GET    /api/v1/{type}/{id}/permissions          → Mon rôle effectif + capabilities
GET    /api/v1/{type}/{id}/permissions/explain   → Debug : sources de chaque permission

# Shared with me
GET    /api/v1/shared-with-me                   → Tous les éléments partagés avec moi
GET    /api/v1/shared-with-me?type=file          → Filtré par type
GET    /api/v1/shared-with-me?type=calendar&role=editor → Filtré par type + rôle

# Policies (conteneurs)
GET    /api/v1/{type}/{id}/policy               → Politique d'héritage
POST   /api/v1/{type}/{id}/policy               → Définir une politique (manager)
DELETE /api/v1/{type}/{id}/policy               → Supprimer la politique (manager)

# Templates
GET    /api/v1/sharing/templates                → Lister les templates du tenant
POST   /api/v1/sharing/templates                → Créer un template (admin)
POST   /api/v1/{type}/{id}/apply-template/{template_id} → Appliquer (manager)

# Deny (admin only)
POST   /api/v1/{type}/{id}/deny                 → Poser un deny explicite
DELETE /api/v1/{type}/{id}/deny/{grant_id}       → Retirer un deny

# Audit
GET    /api/v1/{type}/{id}/audit                → Historique partage (manager/admin)
GET    /api/v1/sharing/audit?actor={user_id}     → Audit par acteur (admin)
```

### 7.2 Intégration services

Chaque service ajoute les routes de partage via une macro :

```rust
let app = Router::new()
    // Routes métier
    .route("/api/v1/files", get(list_files).post(create_file))
    .route("/api/v1/files/:id", get(get_file).put(update_file))
    // Routes de partage auto-générées
    .merge(sharing_routes!(ResourceType::File, "files"))
    .merge(sharing_routes!(ResourceType::Folder, "folders"))
    .with_state(AppState { pool, engine, cache });
```

### 7.3 Middleware

Deux modes d'utilisation :

**Mode layer (route-level) :**
```rust
.route("/api/v1/files/:id", get(get_file))
    .layer(auth_middleware())
    .layer(require_permission(ResourceType::File, Action::Read, ":id"))
```

**Mode handler (fine-grained) :**
```rust
pub async fn update_file(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<File>, AppError> {
    engine.check(&claims.into(), ResourceRef::file(id), Action::Write).await?;
    // ... logique métier
}
```

---

## 8. Migration

### Phase 1 — Fondation (risque : zéro)

- Migration SQL : créer schema `sharing` avec les 5 tables
- Crate `signapps-sharing` : engine, resolver, middleware, repository
- Intégrer sur les services **sans partage existant** : Forms, Contacts, Mail
- Ces services passent de "owner only" à "sharing-enabled"

### Phase 2 — Calendar + Docs (risque : modéré)

- `calendar.members` → `sharing.grants` (mapping direct 3→3 rôles)
- `document_permissions` → `sharing.grants` (view→viewer, edit→editor, admin→manager)
- Migration SQL : `INSERT INTO sharing.grants SELECT ... FROM calendar.members`
- Dual-read pendant 1 sprint, puis bascule

### Phase 3 — Drive ACL (risque : élevé)

Mapping 5→3 rôles via capabilities :

| drive.acl role | sharing.grants role | Note |
|----------------|---------------------|------|
| viewer | viewer | Direct |
| downloader | viewer | capability 'download' incluse dans viewer pour files |
| editor | editor | Direct |
| contributor | editor | capability 'upload' incluse dans editor pour files |
| manager | manager | Direct |

- Migrer `drive.audit_log` → `sharing.audit_log`
- Share links (tokens) restent dans `drive.share_links` (spécifique Drive)
- Dual-read obligatoire pendant 2 sprints

### Phase 4 — Cleanup (risque : zéro)

- DROP tables : `drive.acl`, `calendar.members`, `document_permissions`
- Supprimer code legacy : repositories, handlers, modèles
- Mettre à jour les tests

---

## 9. Sécurité — Secure by design

### 9.1 Garde-fous

1. **Deny-by-default** — aucun grant = DENIED, pas de fallback
2. **Tenant isolation absolue** — `WHERE tenant_id = $1` sur chaque query
3. **Deny non-overridable** — un deny bloque même face à N grants manager
4. **Grant expiry enforcement** — filtré en SQL : `WHERE (expires_at IS NULL OR expires_at > NOW())`
5. **Escalation impossible** — `grant()` vérifie que l'actor a un rôle ≥ au rôle accordé
6. **Audit trail immutable** — `sharing.audit_log` est INSERT-only

### 9.2 Restrictions par type

- `vault_entry` : interdit `grantee_type='everyone'`, chaque `read_secret` audité
- `deny` : seuls les admins tenant peuvent poser/retirer un deny

---

## 10. Tests

### 10.1 Matrice de tests — 14 scénarios critiques

| # | Scénario | Expected |
|---|----------|----------|
| 1 | Aucun grant | DENIED |
| 2 | Owner implicite | ALLOWED (manager) |
| 3 | Grant direct user | ALLOWED |
| 4 | Grant via groupe | ALLOWED |
| 5 | Grant via org_node | ALLOWED |
| 6 | Most permissive wins (viewer org + editor group) | editor |
| 7 | Deny override tout (editor group + deny user) | DENIED |
| 8 | Héritage conteneur (editor sur parent folder) | ALLOWED |
| 9 | Break inheritance (inherit=false sur parent) | DENIED |
| 10 | Grant expiré | DENIED |
| 11 | Capability check (viewer + Action::Write) | DENIED |
| 12 | Cross-tenant isolation | DENIED |
| 13 | Reshare refusé (can_reshare=false) | FORBIDDEN |
| 14 | Editor tente share (POST /grants) | FORBIDDEN |

### 10.2 Types de tests

- **Unit tests** (`resolver.rs`) : chaque étape testée isolément avec mocks
- **Integration tests** (`engine.rs`) : vraie DB PostgreSQL, scénarios end-to-end
- **Property-based tests** : proptest/quickcheck sur le resolver
  - Invariant : deny + any grants = DENIED
  - Invariant : no grants + not owner = DENIED
  - Monotonie : role(A ∪ B) ≥ max(role(A), role(B))
- **Mutation tests** : cargo-mutants sur le resolver — aucune mutation ne doit transformer DENIED en ALLOWED
