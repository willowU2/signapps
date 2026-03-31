# Drive SP4 : Exposition SMB/WebDAV + Partage avancé — Design Spec

## Objectif

Exposer le Drive SignApps via les protocoles SMB et WebDAV pour un accès natif depuis les explorateurs de fichiers (Windows, macOS, Linux). Les ACL SP1 s'appliquent.

## Architecture

### WebDAV (prioritaire)

WebDAV est plus simple à implémenter et fonctionne sur tous les OS sans serveur supplémentaire :
- Intégré directement dans signapps-storage comme routes Axum
- Authentification via Basic Auth (vérifie les credentials JWT ou username/password)
- Mapping 1:1 entre les opérations WebDAV et les endpoints Drive existants

#### Endpoints WebDAV

Le standard WebDAV (RFC 4918) requiert :

```
OPTIONS  /webdav/*          → capabilities
PROPFIND /webdav/*          → list properties (= list nodes)
GET      /webdav/*path      → download file
PUT      /webdav/*path      → upload/update file
MKCOL    /webdav/*path      → create folder
DELETE   /webdav/*path      → delete node
MOVE     /webdav/*path      → move/rename (Destination header)
COPY     /webdav/*path      → copy (Destination header)
LOCK     /webdav/*path      → lock file (optional)
UNLOCK   /webdav/*path      → unlock (optional)
```

Chaque opération passe par l'ACL resolver existant (SP1).

### SMB (optionnel, complexe)

SMB nécessite un daemon Samba externe. Approche :
- Samba configuré pour exposer le répertoire `data/storage/drive/`
- Authentification déléguée à SignApps via PAM ou LDAP
- Les ACL POSIX de Samba mappés aux ACL Drive

C'est plus lourd — on implémente WebDAV d'abord, SMB en phase 2.

### Modèle de données

Pas de nouvelles tables. On réutilise `drive.nodes` + `drive.acl` + `storage.files`.

Ajout d'un champ dans la config :
```sql
ALTER TABLE identity.users
    ADD COLUMN IF NOT EXISTS webdav_enabled BOOLEAN DEFAULT TRUE;
```

### Endpoints

```
# WebDAV (sous /webdav/)
OPTIONS /webdav/*
PROPFIND /webdav/*
GET/PUT/DELETE/MKCOL/MOVE/COPY /webdav/*

# Admin
GET  /api/v1/webdav/config        — config WebDAV (actif, users autorisés)
PUT  /api/v1/webdav/config        — modifier config
GET  /api/v1/webdav/sessions      — sessions WebDAV actives
```

### Frontend

- Section dans `/admin/settings` pour activer/désactiver WebDAV
- Affichage de l'URL WebDAV : `https://signapps.local/webdav/`
- Instructions de connexion par OS (Windows: "Connecter un lecteur réseau", macOS: "Se connecter au serveur", Linux: davfs2)

### Partage avancé

Enrichir les shares existants avec :
- **Partage WebDAV** : share link utilisable comme URL WebDAV (accès en lecture/écriture selon les droits)
- **QR Code** pour partage mobile
- **Notifications** : notifier le destinataire par email quand un fichier est partagé
