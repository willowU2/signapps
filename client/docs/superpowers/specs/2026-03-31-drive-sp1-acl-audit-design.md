# Drive SP1 : ACL hérité + Groupes hybrides + Audit forensique — Design Spec

## Objectif

Remplacer le système de permissions plat actuel (`drive.permissions` avec 3 rôles) par un ACL hérité à 5 rôles avec groupes hybrides (local + LDAP/AD) et un audit trail forensique avec chaîne de signatures, géolocalisation, et alertes automatiques.

## Décisions architecturales

- **Héritage strict par défaut** : les enfants héritent des droits du parent. Override possible par noeud (`inherit_permissions = false`).
- **5 rôles ordonnés** : viewer < downloader < editor < contributor < manager. L'owner a toujours manager implicite.
- **Groupes hybrides** : groupes locaux + sync LDAP/AD automatique (15 min).
- **Audit forensique** : chaque action loguée avec SHA256, chaîne de signatures, géoloc IP, alertes comportementales.
- **Middleware d'autorisation** : vérifie les ACL avant chaque opération Drive, log dans l'audit.

---

## 1. Modèle de données

### 1.1 Extension de `drive.nodes`

```sql
ALTER TABLE drive.nodes
    ADD COLUMN IF NOT EXISTS inherit_permissions BOOLEAN DEFAULT TRUE;
```

### 1.2 Table `drive.acl` (remplace `drive.permissions`)

```sql
CREATE TYPE drive.acl_role AS ENUM ('viewer', 'downloader', 'editor', 'contributor', 'manager');
CREATE TYPE drive.grantee_type AS ENUM ('user', 'group', 'everyone');

CREATE TABLE drive.acl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES drive.nodes(id) ON DELETE CASCADE,
    grantee_type drive.grantee_type NOT NULL,
    grantee_id UUID,  -- NULL when grantee_type = 'everyone'
    role drive.acl_role NOT NULL,
    inherit BOOLEAN DEFAULT TRUE,  -- propagate to children
    granted_by UUID NOT NULL REFERENCES identity.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id, grantee_type, grantee_id)
);

CREATE INDEX idx_acl_node ON drive.acl(node_id);
CREATE INDEX idx_acl_grantee ON drive.acl(grantee_type, grantee_id);
CREATE INDEX idx_acl_expires ON drive.acl(expires_at) WHERE expires_at IS NOT NULL;
```

### 1.3 Table `drive.audit_log`

```sql
CREATE TYPE drive.audit_action AS ENUM (
    'view', 'download', 'create', 'update', 'delete', 'restore',
    'share', 'unshare', 'permission_change', 'access_denied',
    'move', 'rename', 'copy', 'trash', 'untrash', 'version_restore'
);

CREATE TABLE drive.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID,
    node_path TEXT NOT NULL,
    action drive.audit_action NOT NULL,
    actor_id UUID NOT NULL REFERENCES identity.users(id),
    actor_ip INET,
    actor_geo TEXT,  -- "FR/Paris" format
    file_hash TEXT,  -- SHA256 of file at time of action
    details JSONB DEFAULT '{}',
    prev_log_hash TEXT,  -- SHA256 of previous entry (chain)
    log_hash TEXT NOT NULL,  -- SHA256(prev_hash + action + timestamp + actor)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_node ON drive.audit_log(node_id);
CREATE INDEX idx_audit_actor ON drive.audit_log(actor_id);
CREATE INDEX idx_audit_action ON drive.audit_log(action);
CREATE INDEX idx_audit_created ON drive.audit_log(created_at);
CREATE INDEX idx_audit_hash ON drive.audit_log(log_hash);
```

### 1.4 Table `drive.audit_alert_config`

```sql
CREATE TABLE drive.audit_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    alert_type TEXT NOT NULL,  -- 'mass_download', 'off_hours', 'access_denied_burst', 'mass_delete'
    threshold JSONB NOT NULL,  -- {"count": 50, "window_minutes": 10}
    enabled BOOLEAN DEFAULT TRUE,
    notify_emails TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.5 Extension de `identity.groups`

```sql
ALTER TABLE identity.groups
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local',  -- 'local', 'ldap', 'ad'
    ADD COLUMN IF NOT EXISTS external_id TEXT,  -- LDAP DN or AD SID
    ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

CREATE INDEX idx_groups_source ON identity.groups(source);
CREATE INDEX idx_groups_external ON identity.groups(external_id) WHERE external_id IS NOT NULL;
```

### 1.6 Migration de `drive.permissions` → `drive.acl`

```sql
-- Migrate existing permissions to new ACL table
INSERT INTO drive.acl (node_id, grantee_type, grantee_id, role, granted_by, created_at)
SELECT
    node_id,
    CASE WHEN group_id IS NOT NULL THEN 'group' ELSE 'user' END,
    COALESCE(user_id, group_id),
    role::text::drive.acl_role,
    granted_by,
    created_at
FROM drive.permissions
ON CONFLICT DO NOTHING;

-- Mark old table as deprecated
COMMENT ON TABLE drive.permissions IS 'DEPRECATED: migrated to drive.acl';
```

---

## 2. Algorithme de résolution des droits

```
function resolve_effective_role(user_id, node_id):
    // 1. Owner = always manager
    node = get_node(node_id)
    if node.owner_id == user_id:
        return 'manager'

    // 2. Get user's groups
    user_groups = get_user_groups(user_id)

    // 3. Walk up the tree collecting ACLs
    current = node_id
    collected_acls = []

    while current != null:
        current_node = get_node(current)

        // Get direct ACLs for this node
        acls = get_acls(current)
        for acl in acls:
            if acl.expires_at && acl.expires_at < now():
                continue  // expired
            if acl.grantee_type == 'everyone':
                collected_acls.append(acl)
            elif acl.grantee_type == 'user' && acl.grantee_id == user_id:
                collected_acls.append(acl)
            elif acl.grantee_type == 'group' && acl.grantee_id in user_groups:
                collected_acls.append(acl)

        // Stop if this node breaks inheritance
        if current_node.inherit_permissions == false:
            break

        current = current_node.parent_id

    // 4. Return highest role found
    if collected_acls.is_empty():
        return null  // no access

    role_order = ['viewer', 'downloader', 'editor', 'contributor', 'manager']
    return max(collected_acls, key=role_order.index)
```

**Actions autorisées par rôle** :

| Action | viewer | downloader | editor | contributor | manager |
|--------|--------|------------|--------|-------------|---------|
| Voir/preview | oui | oui | oui | oui | oui |
| Télécharger | non | oui | oui | oui | oui |
| Créer/modifier | non | non | oui | oui | oui |
| Renommer/déplacer | non | non | oui | oui | oui |
| Partager (share link) | non | non | non | oui | oui |
| Supprimer | non | non | non | non | oui |
| Gérer les ACL | non | non | non | non | oui |
| Casser l'héritage | non | non | non | non | oui |

---

## 3. Groupes hybrides

### Synchronisation LDAP/AD

- **Fréquence** : toutes les 15 minutes (configurable via `LDAP_SYNC_INTERVAL`)
- **Processus** :
  1. Connecter à l'annuaire LDAP/AD (config existante dans signapps-identity)
  2. Lister tous les groupes avec leurs membres
  3. Pour chaque groupe avec `sync_enabled = true` :
     - Créer/mettre à jour le groupe local si absent
     - Synchroniser les membres (ajouter les nouveaux, retirer les supprimés)
     - Mettre à jour `last_sync_at`
  4. Les groupes locaux (`source = 'local'`) ne sont pas touchés par la sync

### API Groupes (enrichissement)

- `POST /api/v1/groups/sync` — Forcer une synchronisation immédiate
- `GET /api/v1/groups?source=ldap` — Filtrer par source
- Les endpoints CRUD existants restent inchangés

---

## 4. Audit trail forensique

### Chaîne de signatures

Chaque entrée est signée :
```
log_hash = SHA256(prev_log_hash + action + actor_id + node_id + created_at.timestamp())
```

Le premier log de la chaîne utilise `prev_log_hash = "GENESIS"`.

**Vérification d'intégrité** : l'endpoint `GET /api/v1/drive/audit/verify` parcourt toute la chaîne et vérifie que chaque `log_hash` correspond au recalcul. Si une entrée a été modifiée, la vérification échoue à cet endroit avec l'index du premier log corrompu.

### Géolocalisation IP

- Utiliser une base GeoIP locale (MaxMind GeoLite2-City) ou un service interne
- Stocker au format `"FR/Paris"` (pays/ville)
- Si non disponible, stocker `null`
- Pas de requête externe (la base est embarquée)

### Alertes automatiques

| Type | Seuil par défaut | Action |
|------|-----------------|--------|
| `mass_download` | 50 fichiers / 10 min | Email admin + log warning |
| `off_hours` | Accès entre 22h-6h | Email admin |
| `access_denied_burst` | 5 refus / 5 min | Email admin + log warning |
| `mass_delete` | 20 fichiers / 5 min | Email admin + bloquer temporairement |

Les seuils sont configurables via `drive.audit_alert_config`. Le worker d'alertes tourne en background (toutes les minutes), query les logs récents, et déclenche les notifications.

### Rétention

- Défaut : 365 jours
- Configurable par l'admin
- Job de nettoyage nocturne (03:00) supprime les logs expirés
- Export CSV/JSON avant suppression si configuré

---

## 5. Endpoints API

### ACL

```
GET    /api/v1/drive/nodes/:id/acl           — lister les ACL d'un noeud (directs + hérités)
POST   /api/v1/drive/nodes/:id/acl           — ajouter un grant {grantee_type, grantee_id, role, inherit?, expires_at?}
PUT    /api/v1/drive/nodes/:id/acl/:acl_id   — modifier un grant (changer le rôle, l'expiration)
DELETE /api/v1/drive/nodes/:id/acl/:acl_id   — révoquer un grant
POST   /api/v1/drive/nodes/:id/acl/break     — casser l'héritage (copie les ACL hérités comme explicites)
POST   /api/v1/drive/nodes/:id/acl/restore   — restaurer l'héritage (supprime les ACL explicites, remet inherit=true)
GET    /api/v1/drive/nodes/:id/effective-acl  — droits effectifs calculés pour l'utilisateur courant
GET    /api/v1/drive/nodes/:id/effective-acl/:user_id — droits effectifs pour un utilisateur spécifique (admin)
```

### Audit

```
GET    /api/v1/drive/audit                   — lister (filtres: node_id, actor_id, action, date_from, date_to, limit, offset)
GET    /api/v1/drive/audit/verify             — vérifier l'intégrité de la chaîne de signatures
POST   /api/v1/drive/audit/export             — export CSV/JSON {format, date_from, date_to, filters}
GET    /api/v1/drive/audit/alerts             — alertes déclenchées récentes
GET    /api/v1/drive/audit/alerts/config      — lister la config des alertes
PUT    /api/v1/drive/audit/alerts/config      — modifier les seuils
GET    /api/v1/drive/audit/stats              — statistiques (actions par jour, top users, top fichiers)
```

### Groupes

```
POST   /api/v1/groups/sync                    — forcer sync LDAP/AD
GET    /api/v1/groups/:id/members             — lister les membres (existant, enrichi avec source)
```

---

## 6. Middleware d'autorisation Drive

Nouveau middleware `drive_acl_check` inséré dans la chaîne Axum pour toutes les routes `/api/v1/drive/**` et `/api/v1/files/**` :

```rust
async fn drive_acl_check(
    State(state): State<AppState>,
    claims: Claims,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // 1. Extract node_id from path or body
    let node_id = extract_node_id(&req);

    // 2. Determine required role from HTTP method + path
    let required_role = match (req.method(), req.uri().path()) {
        (GET, p) if p.contains("/download") => AclRole::Downloader,
        (GET, _) => AclRole::Viewer,
        (POST, p) if p.contains("/acl") => AclRole::Manager,
        (POST, _) | (PUT, _) => AclRole::Editor,
        (DELETE, _) => AclRole::Manager,
        _ => AclRole::Viewer,
    };

    // 3. Resolve effective role
    let effective_role = resolve_effective_role(&state.pool, claims.sub, node_id).await?;

    // 4. Check access
    if effective_role < required_role {
        // Log access denied
        audit_log(&state.pool, AuditAction::AccessDenied, node_id, claims.sub, &req).await;
        return Err(AppError::forbidden("Insufficient permissions"));
    }

    // 5. Log the action
    let action = map_request_to_audit_action(&req);
    audit_log(&state.pool, action, node_id, claims.sub, &req).await;

    // 6. Continue
    next.run(req).await
}
```

---

## 7. Frontend

### Panneau de permissions (enrichi)

Remplacer `permissions-sheet.tsx` existant avec :
- Liste des grants directs + hérités (hérités en gris avec indicateur)
- Ajout de grant : picker utilisateur/groupe + sélecteur de rôle (5 options)
- Badge "Héritage actif" / bouton "Casser l'héritage"
- Date d'expiration optionnelle
- Indicateur de source du groupe (local / LDAP / AD)

### Panneau d'audit (nouveau)

Accessible depuis le contexte menu d'un fichier → "Historique d'accès" :
- Timeline des actions avec icônes, acteur, date, IP, géoloc
- Filtres par action, date, utilisateur
- Indicateur d'intégrité (chaîne vérifiée / corrompue)
- Export CSV

### Admin → Audit global

Page `/admin/drive-audit` :
- Dashboard des alertes actives
- Graphiques d'activité (actions/jour, répartition par type)
- Configuration des seuils d'alertes
- Vérification d'intégrité globale
- Export massif

---

## 8. Résumé des fichiers à créer/modifier

### Backend (Rust)

| Action | Fichier |
|--------|---------|
| Créer | `migrations/118_drive_acl.sql` |
| Créer | `services/signapps-storage/src/handlers/acl.rs` |
| Créer | `services/signapps-storage/src/handlers/audit.rs` |
| Créer | `services/signapps-storage/src/middleware/acl_check.rs` |
| Créer | `services/signapps-storage/src/services/acl_resolver.rs` |
| Créer | `services/signapps-storage/src/services/audit_chain.rs` |
| Créer | `services/signapps-storage/src/services/alert_worker.rs` |
| Modifier | `services/signapps-storage/src/main.rs` (routes + middleware) |
| Modifier | `services/signapps-identity/src/handlers/groups.rs` (sync endpoint) |
| Modifier | `crates/signapps-db/src/models/` (ACL + audit models) |
| Modifier | `crates/signapps-db/src/repositories/` (ACL + audit repos) |

### Frontend (React)

| Action | Fichier |
|--------|---------|
| Créer | `client/src/components/storage/acl-panel.tsx` |
| Créer | `client/src/components/storage/audit-timeline.tsx` |
| Créer | `client/src/app/admin/drive-audit/page.tsx` |
| Modifier | `client/src/lib/api/storage.ts` (ACL + audit endpoints) |
| Modifier | `client/src/lib/api/drive.ts` (ACL helper) |
| Modifier | `client/src/app/drive/page.tsx` (context menu → audit) |
