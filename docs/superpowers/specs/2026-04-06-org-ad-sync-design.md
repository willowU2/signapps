# Synchronisation Org-Structure → Active Directory — Design Specification

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Sync bidirectionnelle org→AD, provisionnement automatique, multi-site, sauvegardes, restauration granulaire

---

## 1. Objectif

Synchroniser automatiquement la hierarchie organisationnelle (`core.org_nodes`) vers l'Active Directory sous forme d'OUs, User Accounts, Computer Accounts et Security Groups. L'org-structure est la **source de verite** — l'AD est un miroir provisionne automatiquement.

## 2. Decisions architecturales

| Decision | Choix |
|----------|-------|
| Source de verite | Org-structure (core.org_nodes) |
| Direction sync | Org → AD (unidirectionnelle, org est maitre) |
| Declenchement | Hybride : temps reel (event queue) + reconciliation periodique (15 min) |
| Nommage utilisateur | `p.nom` (1ere lettre prenom + nom), doublon → 2e prenom ou 2 lettres |
| Mail | Auto-creation dans signapps-mail, meme login/mot de passe que l'AD |
| Domaine mail | Configurable par noeud org avec heritage |
| Ordinateurs | Tous dans `OU=Computers,DC=...` (pas de repartition par service) |
| Positions | Security Group + attributs title/department sur le User |
| Multi-site | DCs par site avec failover, replication inter-DC |
| Sauvegardes | Full (quotidien), incremental (4h), pre-migration (auto) |
| Restauration | Granulaire (domaine, OU, user, group, computer, DNS, GPO) |

## 3. Mapping Org → AD

| Objet Org-Structure | Objet AD | Nommage AD |
|---------------------|----------|------------|
| Group (racine) | OU racine | `OU={name},DC=...` |
| Subsidiary | OU | `OU={name},OU={parent},...` |
| BU | OU | `OU={name},OU={parent},...` |
| Department | OU | `OU={name},OU={parent},...` |
| Service | OU | `OU={name},OU={parent},...` |
| Team | OU + Security Group | `OU={name},...` + `GS-{name}` |
| Position | Security Group | `GR-Position-{name}` |
| Person (assignee) | User Account | `CN={display_name},OU={team},...` |
| Computer (it.hardware) | Computer Account | `CN={name}$,OU=Computers,...` |
| Org Group (transversal) | Security Group | `GS-{name}` |
| Site | AD Site | `CN={name},CN=Sites,CN=Configuration,...` |

## 4. Modele de donnees

### 4.1 Table `ad_ous` — OUs synchronisees

```sql
CREATE TABLE ad_ous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    distinguished_name TEXT NOT NULL,
    parent_ou_id UUID REFERENCES ad_ous(id),
    guid TEXT,
    mail_distribution_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'orphan')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, node_id)
);

CREATE INDEX idx_ad_ous_domain ON ad_ous(domain_id);
CREATE INDEX idx_ad_ous_node ON ad_ous(node_id);
```

### 4.2 Table `ad_user_accounts` — Comptes utilisateurs AD

```sql
CREATE TABLE ad_user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    ou_id UUID REFERENCES ad_ous(id),
    sam_account_name TEXT NOT NULL,
    user_principal_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    title TEXT,
    department TEXT,
    mail TEXT,
    mail_domain_id UUID REFERENCES infrastructure.domains(id),
    account_flags INT DEFAULT 512, -- NORMAL_ACCOUNT
    object_sid TEXT,
    password_must_change BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name),
    UNIQUE(domain_id, person_id)
);

CREATE INDEX idx_ad_users_domain ON ad_user_accounts(domain_id);
CREATE INDEX idx_ad_users_person ON ad_user_accounts(person_id);
CREATE INDEX idx_ad_users_ou ON ad_user_accounts(ou_id);
```

### 4.3 Table `ad_computer_accounts` — Comptes machine AD

```sql
CREATE TABLE ad_computer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    hardware_id UUID REFERENCES it.hardware(id),
    sam_account_name TEXT NOT NULL, -- ex: PC-JD01$
    distinguished_name TEXT NOT NULL,
    dns_hostname TEXT,
    os_name TEXT,
    os_version TEXT,
    object_sid TEXT,
    is_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name)
);

CREATE INDEX idx_ad_computers_domain ON ad_computer_accounts(domain_id);
CREATE INDEX idx_ad_computers_hardware ON ad_computer_accounts(hardware_id);
```

### 4.4 Table `ad_security_groups` — Groupes de securite AD

```sql
CREATE TABLE ad_security_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('org_group', 'team', 'position')),
    source_id UUID NOT NULL,
    sam_account_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    display_name TEXT,
    group_scope TEXT DEFAULT 'global'
        CHECK (group_scope IN ('domain_local', 'global', 'universal')),
    group_type TEXT DEFAULT 'security'
        CHECK (group_type IN ('security', 'distribution')),
    object_sid TEXT,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'orphan')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name)
);

CREATE INDEX idx_ad_groups_domain ON ad_security_groups(domain_id);
CREATE INDEX idx_ad_groups_source ON ad_security_groups(source_type, source_id);
```

### 4.5 Table `ad_group_members` — Membres des groupes AD

```sql
CREATE TABLE ad_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES ad_security_groups(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL
        CHECK (member_type IN ('user', 'computer', 'group')),
    member_id UUID NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    UNIQUE(group_id, member_type, member_id)
);

CREATE INDEX idx_ad_gm_group ON ad_group_members(group_id);
```

### 4.6 Table `ad_sync_queue` — File d'evenements

```sql
CREATE TABLE ad_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    target_site_id UUID REFERENCES core.sites(id),
    target_dc_id UUID,
    priority INT DEFAULT 5, -- 1=urgent (user create) 5=normal 10=low (reconciliation)
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry', 'dead')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_pending ON ad_sync_queue(status, next_retry_at)
    WHERE status IN ('pending', 'retry');
CREATE INDEX idx_sync_queue_domain ON ad_sync_queue(domain_id);
```

### 4.7 Table `ad_node_mail_domains` — Mapping noeud → domaine mail

```sql
CREATE TABLE ad_node_mail_domains (
    node_id UUID PRIMARY KEY REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

Resolution par heritage : pour un noeud sans mapping direct, remonter la closure table jusqu'a trouver un ancetre avec un mapping.

### 4.8 Table `ad_dc_sites` — DCs par site

```sql
CREATE TABLE ad_dc_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    site_id UUID REFERENCES core.sites(id),
    dc_hostname TEXT NOT NULL,
    dc_ip TEXT NOT NULL,
    dc_role TEXT DEFAULT 'rwdc'
        CHECK (dc_role IN ('primary_rwdc', 'rwdc', 'rodc')),
    dc_status TEXT DEFAULT 'provisioning'
        CHECK (dc_status IN ('provisioning', 'online', 'degraded', 'offline', 'decommissioning')),
    is_writable BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    replication_partner_id UUID REFERENCES ad_dc_sites(id),
    promoted_at TIMESTAMPTZ,
    demoted_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    last_replication_at TIMESTAMPTZ,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, dc_hostname)
);

CREATE INDEX idx_dc_sites_domain ON ad_dc_sites(domain_id);
CREATE INDEX idx_dc_sites_site ON ad_dc_sites(site_id);
```

### 4.9 Table `ad_fsmo_roles` — Roles FSMO

```sql
CREATE TABLE ad_fsmo_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    role TEXT NOT NULL
        CHECK (role IN ('schema_master', 'domain_naming', 'rid_master', 'pdc_emulator', 'infrastructure_master')),
    dc_id UUID NOT NULL REFERENCES ad_dc_sites(id),
    transferred_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, role)
);
```

### 4.10 Table `ad_snapshots` — Sauvegardes

```sql
CREATE TABLE ad_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    dc_id UUID REFERENCES ad_dc_sites(id),
    snapshot_type TEXT NOT NULL
        CHECK (snapshot_type IN ('full', 'incremental', 'pre_migration', 'pre_restore')),
    storage_path TEXT NOT NULL,
    manifest JSONB DEFAULT '{}',
    tables_included TEXT[] DEFAULT '{}',
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 TEXT,
    status TEXT DEFAULT 'creating'
        CHECK (status IN ('creating', 'completed', 'restoring', 'expired', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_snapshots_domain ON ad_snapshots(domain_id);
CREATE INDEX idx_snapshots_type ON ad_snapshots(snapshot_type, created_at DESC);
```

## 5. Nommage des comptes utilisateurs

### Algorithme de generation du sAMAccountName

```
generate_sam(person):
  base = lowercase(first_char(person.first_name) + "." + person.last_name)
  base = normalize_ascii(base)  // e→e, e→e, etc.
  base = truncate(base, 20)     // limite sAMAccountName

  if not exists(base):
    return base                  // j.dupont

  // Doublon detecte
  if person.middle_name:
    alt = lowercase(first_char(first_name) + first_char(middle_name) + "." + last_name)
    if not exists(alt):
      return alt                 // jp.dupont (Jean-Paul)

  // Fallback : 2 premieres lettres du prenom
  alt2 = lowercase(first_two_chars(first_name) + "." + last_name)
  if not exists(alt2):
    return alt2                  // je.dupont

  // Dernier recours : suffixe numerique
  for i in 2..99:
    if not exists(base + str(i)):
      return base + str(i)      // j.dupont2
```

### Adresse mail

```
mail = sam_account_name + "@" + resolve_mail_domain(person.node)
```

Ou `resolve_mail_domain` remonte la closure table depuis le noeud de la personne jusqu'a trouver un ancetre avec un mapping dans `ad_node_mail_domains`.

### Attributs User Account

| Attribut AD | Source |
|------------|--------|
| `sAMAccountName` | Algorithme ci-dessus |
| `userPrincipalName` | `{sam}@{realm}` |
| `displayName` | `{first_name} {last_name}` |
| `givenName` | `person.first_name` |
| `sn` | `person.last_name` |
| `title` | Nom de la position (assignment → node de type position) |
| `department` | Nom du noeud parent de type department/service |
| `mail` | `{sam}@{mail_domain}` |
| `company` | Nom du noeud racine ou filiale |
| `physicalDeliveryOfficeName` | Site principal de la personne |
| `telephoneNumber` | `person.phone` |
| `userAccountControl` | 512 (enabled) + 8388608 (password must change) |

## 6. Flux de synchronisation

### 6.1 Evenements temps reel

| Action org | Event type | Priorite | Effet AD |
|-----------|-----------|----------|----------|
| Creer noeud (group→service) | `ou_create` | 3 | Cree OU dans le DN parent |
| Renommer noeud | `ou_rename` | 5 | Rename OU (modrdn LDAP) |
| Deplacer noeud | `ou_move` | 3 | Move OU + tous les objets enfants |
| Supprimer noeud | `ou_delete` | 5 | Delete OU si vide, sinon erreur |
| Assigner personne | `user_provision` | 1 | Cree User + mail + Kerberos principal |
| Desassigner personne | `user_disable` | 2 | Desactive compte (pas de suppression) |
| Changer position | `user_update` | 5 | Met a jour title + groupe position |
| Deplacer personne (change d'equipe) | `user_move` | 3 | Move user vers nouvelle OU + update groups |
| Creer groupe transversal | `group_create` | 5 | Cree Security Group |
| Modifier membres groupe | `group_sync` | 5 | Sync members |
| Supprimer groupe | `group_delete` | 5 | Delete Security Group |
| Ajouter PC | `computer_create` | 5 | Cree Computer Account dans OU=Computers |
| Retirer PC | `computer_disable` | 5 | Desactive Computer Account |
| Lier domaine mail a noeud | `mail_domain_bind` | 3 | Recalcule les adresses mail des users enfants |

### 6.2 Worker async

```
ad_sync_worker():
  loop:
    // Ecoute NOTIFY pour reveil immediat
    events = dequeue(status IN ('pending', 'retry') AND next_retry_at <= now())

    for event in events:
      mark(event, 'processing')

      // Resoudre le DC cible
      dc = resolve_dc(event.domain_id, event.target_site_id)
      if dc is None:
        mark(event, 'retry', error="No available DC")
        continue

      // Appliquer l'operation
      result = apply_ad_operation(dc, event)
      if result.ok:
        mark(event, 'completed')
      else:
        event.attempts += 1
        if event.attempts >= event.max_attempts:
          mark(event, 'dead')
        else:
          mark(event, 'retry', next_retry = exponential_backoff(event.attempts))
```

### 6.3 Reconciliation periodique (cron 15 min)

```
reconcile():
  for domain in active_domains():
    // 1. OUs
    expected_ous = org_nodes WHERE tree_type='internal' AND node_type IN (group..service)
    actual_ous = ad_ous WHERE domain_id = domain.id
    for missing in expected_ous - actual_ous:
      enqueue('ou_create', priority=10)
    for orphan in actual_ous - expected_ous:
      mark_orphan(orphan)

    // 2. Users
    expected_users = active assignments with persons
    actual_users = ad_user_accounts WHERE is_enabled=true
    for missing in expected_users - actual_users:
      enqueue('user_provision', priority=10)
    for orphan in actual_users - expected_users:
      enqueue('user_disable', priority=10)

    // 3. Groups + members
    // Similar pattern...

    // 4. Computers
    // Similar pattern...
```

## 7. Multi-site et multi-serveur

### Resolution du DC cible

```
resolve_dc(domain_id, site_id):
  // 1. DC writable du site demande
  dc = ad_dc_sites WHERE domain_id AND site_id AND is_writable AND dc_status='online'
  if dc: return dc

  // 2. DC writable le plus proche (meme domaine)
  dc = ad_dc_sites WHERE domain_id AND is_writable AND dc_status='online'
      ORDER BY last_heartbeat_at DESC LIMIT 1
  if dc: return dc

  // 3. DC primaire (dernier recours)
  dc = ad_dc_sites WHERE domain_id AND is_primary
  return dc  // peut etre None si aucun DC
```

### Operations DC Lifecycle

| Operation | Etapes |
|-----------|--------|
| **DC Promote** | 1. Creer entree `ad_dc_sites` (status=provisioning) → 2. Repliquer la base AD depuis le partner → 3. Generer les cles Kerberos du DC → 4. Creer les SRV records DNS du site → 5. Status → online |
| **DC Demote** | 1. Verifier que les roles FSMO ne sont pas sur ce DC (sinon transferer) → 2. Repliquer les derniers changements vers un partner → 3. Supprimer les SRV records DNS → 4. Desactiver le compte machine du DC → 5. Status → decommissioning → 6. Supprimer apres 30j |
| **DC Migration** | 1. Snapshot pre-migration → 2. DC Promote sur le nouveau site → 3. Replication complete → 4. Transfert des roles FSMO si applicable → 5. DC Demote sur l'ancien site |
| **FSMO Transfer** | 1. Verifier que le DC cible est writable et online → 2. UPDATE ad_fsmo_roles SET dc_id = new_dc → 3. Notifier tous les DCs du changement |
| **FSMO Seize** | Comme Transfer mais sans accord de l'ancien DC (en cas de panne) — necessite confirmation admin |

## 8. Sauvegardes et restauration

### Politique de sauvegarde

| Type | Frequence | Retention | Contenu |
|------|-----------|-----------|---------|
| Full | Quotidien 02h00 | 30 jours | Toutes tables AD (ous, users, computers, groups, members, principals, DNS, GPO) |
| Incremental | Toutes les 4h | 7 jours | Lignes modifiees depuis le dernier snapshot (via last_synced_at/updated_at) |
| Pre-migration | Auto (avant promote/demote) | 90 jours | Full snapshot du DC concerne |
| Pre-restore | Auto (avant toute restauration) | 90 jours | Full snapshot de l'etat actuel |

### Format de snapshot

Le manifest JSONB indexe chaque objet par DN :
```json
{
  "objects": {
    "OU=DRH,OU=SignApps Corp,DC=corp,DC=local": {
      "type": "ou",
      "table": "ad_ous",
      "row_id": "uuid...",
      "offset": 1024,
      "length": 256
    },
    "CN=j.dupont,OU=Dev Frontend,...": {
      "type": "user",
      "table": "ad_user_accounts",
      "row_id": "uuid...",
      "offset": 1280,
      "length": 512
    }
  },
  "metadata": {
    "domain": "corp.local",
    "dc": "dc1.corp.local",
    "timestamp": "2026-04-06T02:00:00Z",
    "object_count": 1234
  }
}
```

### Restauration granulaire

| Granularite | Cible | Restaure |
|-------------|-------|----------|
| Domaine complet | `corp.local` | Tout : OUs, users, computers, groups, DNS, principals |
| OU (avec sous-arbre) | `OU=DRH,...` | L'OU + tous ses enfants (sous-OUs, users, computers) |
| OU seule | `OU=DRH,...` | Seulement les attributs de l'OU |
| Utilisateur | `j.dupont` | User account + group memberships + principal Kerberos + boite mail |
| Groupe | `GS-Dev-Frontend` | Le groupe + sa liste de membres |
| Computer | `PC-JD01$` | Le compte machine + son principal Kerberos |
| DNS Zone | `corp.local` | Tous les records DNS de la zone |
| GPO | `Default Domain Policy` | La GPO + ses liens aux OUs |

### Workflow de restauration

```
restore(snapshot_id, target_dn, include_children):
  1. Creer snapshot pre-restore automatique
  2. Charger le manifest du snapshot source
  3. Filtrer les objets selon target_dn et include_children
  4. Afficher le diff preview (etat actuel vs snapshot)
  5. Attendre confirmation admin
  6. Pour chaque objet a restaurer :
     - Emettre un evenement restore_* dans ad_sync_queue
     - Le worker applique la restauration (INSERT/UPDATE)
  7. Marquer le snapshot source comme "used for restore at {date}"
```

## 9. Systeme mail integre

### 9.1 Domaine mail par noeud org

Un domaine mail peut etre assigne a n'importe quel noeud org via `ad_node_mail_domains`. L'heritage fonctionne par proximite : un noeud sans domaine herite du domaine de l'ancetre le plus proche qui en a un.

### 9.2 Boites mail utilisateurs

Quand un `user_provision` est traite :
1. Resoudre le domaine mail par defaut via `ad_node_mail_domains` + heritage closure (domaine le plus proche)
2. Si un domaine mail est trouve :
   a. Generer l'adresse par defaut : `{sam_account_name}@{mail_domain.dns_name}`
   b. Creer la boite mail dans `mailserver.accounts` avec le meme mot de passe que l'AD
   c. Stocker `mail` dans `ad_user_accounts`
3. Si pas de domaine mail : laisser `mail` NULL (pas de boite mail)

Le mot de passe mail est toujours synchronise avec le mot de passe AD (meme hash dans `ad_principal_keys`).

### 9.3 Alias mail — regle "mon niveau + branches en dessous"

Un utilisateur peut envoyer avec :
- Son domaine par defaut (herite du noeud le plus proche)
- Tous les domaines assignes aux sous-branches en dessous de son niveau dans l'arbre

L'adresse est toujours `{sam_account_name}@{domaine}` (meme login partout).

**Algorithme de resolution des alias :**
```
resolve_mail_aliases(person):
  node = person.assigned_node
  default_domain = resolve_closest_mail_domain(node)  // remonte closure

  // Collecter tous les domaines des sous-branches
  descendants = closure_descendants(node)  // tous les noeuds en dessous
  alias_domains = ad_node_mail_domains WHERE node_id IN descendants

  return {
    default: sam + "@" + default_domain,
    aliases: [sam + "@" + d.dns_name for d in alias_domains]
  }
```

**Exemple :**
```
SignApps Corp (advicetech.fr)
+-- Commercial (sales.advicetech.fr)
|   +-- France (france.sales.advicetech.fr)
|   |   +-- a.vendeur
|   +-- b.directeur
+-- LDLC Mulhouse (ldlc-mulhouse.fr)
|   +-- m.martin
+-- p.boss (DG)
```

| Utilisateur | Defaut | Alias |
|------------|--------|-------|
| p.boss | p.boss@advicetech.fr | p.boss@sales.advicetech.fr, p.boss@france.sales.advicetech.fr, p.boss@ldlc-mulhouse.fr |
| b.directeur | b.directeur@sales.advicetech.fr | b.directeur@france.sales.advicetech.fr |
| a.vendeur | a.vendeur@france.sales.advicetech.fr | *(aucun)* |
| m.martin | m.martin@ldlc-mulhouse.fr | *(aucun)* |

### 9.4 Boites mail partagees OU/Groupe (dossiers IMAP)

Au lieu de listes de distribution (qui dupliquent les mails), chaque OU/groupe avec une adresse mail cree une **boite partagee** qui apparait comme un **dossier IMAP** dans la boite de chaque membre.

**Principe :** Un mail envoye a `drh@advicetech.fr` arrive **une seule fois** dans la boite partagee DRH, visible par tous les membres comme un dossier dans leur client mail.

**Hierarchie des dossiers dans la boite utilisateur :**
```
Boite mail de j.dupont@advicetech.fr
+-- Inbox (personnel)
+-- Sent
+-- Drafts
+-- [Shared] SignApps Corp (advicetech.fr)
|   +-- [Shared] SI (si@advicetech.fr)
|   |   +-- [Shared] Dev Frontend (dev-frontend@advicetech.fr)
|   +-- [Shared] DRH (drh@advicetech.fr)
```

Par defaut, l'utilisateur voit toute la branche hierarchique de son noeud jusqu'a la racine. Cela est configurable par les administrateurs.

**Configuration par OU** (stockee dans `ad_ous.config` JSONB ou `ad_shared_mailboxes.config`) :

| Parametre | Defaut | Description |
|-----------|--------|-------------|
| `shared_mailbox_enabled` | `true` | Active/desactive la boite partagee pour cette OU |
| `shared_mailbox_visible_to_children` | `true` | Les membres des sous-OUs voient ce dossier |
| `shared_mailbox_send_as` | `members` | Qui peut envoyer en tant que cette OU : `members`, `managers`, `none` |
| `shared_mailbox_auto_subscribe` | `true` | Les nouveaux membres sont abonnes automatiquement |

**Exemples de configuration :**
- Desactiver `shared_mailbox_visible_to_children` sur SignApps Corp → les filiales ne voient pas le dossier racine
- Mettre `shared_mailbox_send_as = managers` sur DRH → seuls les membres du board DRH peuvent repondre depuis `drh@advicetech.fr`
- Desactiver `shared_mailbox_enabled` sur une equipe → pas de dossier partage pour cette equipe

### 9.5 Table `ad_mail_aliases` — Alias utilisateurs

```sql
CREATE TABLE ad_mail_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id UUID NOT NULL REFERENCES ad_user_accounts(id) ON DELETE CASCADE,
    mail_address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mail_address)
);

CREATE INDEX idx_mail_aliases_user ON ad_mail_aliases(user_account_id);
```

### 9.6 Table `ad_shared_mailboxes` — Boites partagees OU/Groupe

```sql
CREATE TABLE ad_shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ou_id UUID REFERENCES ad_ous(id) ON DELETE CASCADE,
    group_id UUID REFERENCES ad_security_groups(id) ON DELETE CASCADE,
    mail_address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id),
    display_name TEXT NOT NULL,
    config JSONB DEFAULT '{
        "shared_mailbox_enabled": true,
        "shared_mailbox_visible_to_children": true,
        "shared_mailbox_send_as": "members",
        "shared_mailbox_auto_subscribe": true
    }',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mail_address),
    CHECK (ou_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX idx_shared_mbox_ou ON ad_shared_mailboxes(ou_id);
CREATE INDEX idx_shared_mbox_group ON ad_shared_mailboxes(group_id);
```

### 9.7 Table `ad_shared_mailbox_subscriptions` — Abonnements utilisateurs

```sql
CREATE TABLE ad_shared_mailbox_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES ad_shared_mailboxes(id) ON DELETE CASCADE,
    user_account_id UUID NOT NULL REFERENCES ad_user_accounts(id) ON DELETE CASCADE,
    imap_folder_path TEXT NOT NULL,
    can_send_as BOOLEAN DEFAULT false,
    is_subscribed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mailbox_id, user_account_id)
);

CREATE INDEX idx_mbox_sub_user ON ad_shared_mailbox_subscriptions(user_account_id);
CREATE INDEX idx_mbox_sub_mailbox ON ad_shared_mailbox_subscriptions(mailbox_id);
```

Le champ `imap_folder_path` contient le chemin hierarchique du dossier tel qu'il apparait dans le client mail, ex: `[Shared]/SignApps Corp/SI/Dev Frontend`.

### 9.8 Algorithme de calcul des abonnements

```
compute_subscriptions(user):
  node = user.assigned_node
  domain = resolve_closest_mail_domain(node)

  // 1. Remonter la branche jusqu'a la racine
  ancestors = closure_ancestors(node)  // du plus proche au plus loin
  path_parts = []

  for ancestor in reverse(ancestors):  // de la racine vers le bas
    mailbox = ad_shared_mailboxes WHERE ou_id = ad_ous.id AND ancestor.id = node_id
    if mailbox is None: continue
    if not mailbox.config.shared_mailbox_enabled: continue

    // Verifier la visibilite pour les enfants
    if ancestor != node AND not mailbox.config.shared_mailbox_visible_to_children:
      continue

    path_parts.append(mailbox.display_name)
    folder_path = "[Shared]/" + "/".join(path_parts)

    upsert subscription(
      mailbox_id = mailbox.id,
      user_account_id = user.id,
      imap_folder_path = folder_path,
      can_send_as = (mailbox.config.send_as == 'members'
                     OR (mailbox.config.send_as == 'managers' AND user_is_board_member(ancestor)))
    )

  // 2. Ajouter les groupes transversaux dont l'user est membre
  for group_membership in user.group_memberships:
    mailbox = ad_shared_mailboxes WHERE group_id = group_membership.group_id
    if mailbox: subscribe(user, mailbox, "[Shared]/Groupes/" + mailbox.display_name)
```

## 10. Services impactes

| Service | Modification |
|---------|-------------|
| signapps-dc | +Worker ad_sync (consomme la queue, applique les operations AD) |
| signapps-dc | +Cron reconciliation (15 min) |
| signapps-dc | +Cron sauvegarde (full quotidien, incremental 4h) |
| signapps-dc | +Handlers DC promote/demote/migrate/snapshot/restore |
| signapps-workforce | +Triggers NOTIFY sur org_nodes, assignments, org_groups |
| signapps-workforce | +Handlers pour ad_node_mail_domains CRUD |
| signapps-mail | +Creation automatique de compte mail lors du user_provision |
| Frontend | +Page AD Sync status (queue, derniere reconciliation, erreurs) |
| Frontend | +Page DC Management (promote, demote, migrate, FSMO) |
| Frontend | +Page Snapshots (liste, restauration granulaire, diff preview) |
| Frontend | +Colonne "Compte AD" dans la page Personnes |

## 11. Migrations

- Migration 224: tables `ad_ous`, `ad_user_accounts`, `ad_computer_accounts`
- Migration 225: tables `ad_security_groups`, `ad_group_members`
- Migration 226: table `ad_sync_queue` + index
- Migration 227: table `ad_node_mail_domains`
- Migration 228: tables `ad_dc_sites`, `ad_fsmo_roles`
- Migration 229: table `ad_snapshots`
- Migration 230: tables `ad_mail_aliases`, `ad_shared_mailboxes`, `ad_shared_mailbox_subscriptions`
- Migration 231: triggers NOTIFY sur core.org_nodes, core.assignments, workforce_org_groups
