# Drive SP3 : Sauvegarde incrémentielle enterprise — Design Spec

## Objectif

Ajouter un système de sauvegarde de fichiers avec snapshots incrémentaux, plans de backup configurables, et restauration granulaire (fichier, dossier, point dans le temps).

## Architecture

Le système repose sur 3 niveaux :
1. **Snapshots** — Copie incrémentielle des fichiers modifiés depuis le dernier snapshot
2. **Plans de backup** — Cron configurables (quotidien, hebdo, mensuel) avec rétention
3. **Restauration** — Récupérer un fichier/dossier à un instant T

### Modèle de données

#### `storage.backup_plans`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| name | text | "Backup quotidien", "Backup mensuel" |
| schedule | text | Cron expression: `0 2 * * *` |
| backup_type | enum | `full`, `incremental`, `differential` |
| retention_days | int | Jours de rétention (défaut 30) |
| max_snapshots | int | Max snapshots gardés (défaut 10) |
| include_paths | text[] | Dossiers à inclure (vide = tout) |
| exclude_paths | text[] | Dossiers à exclure |
| enabled | bool | |
| last_run_at | timestamptz | |
| next_run_at | timestamptz | |

#### `storage.backup_snapshots`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| plan_id | UUID FK | Plan de backup |
| backup_type | enum | full/incremental/differential |
| status | enum | `running`, `completed`, `failed` |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| files_count | int | Nombre de fichiers sauvegardés |
| total_size | bigint | Taille totale en bytes |
| storage_path | text | Chemin du snapshot sur disque |
| error_message | text | Si failed |

#### `storage.backup_entries`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| snapshot_id | UUID FK | Snapshot parent |
| node_id | UUID FK → drive.nodes | Fichier/dossier original |
| node_path | text | Chemin au moment du backup |
| file_hash | text | SHA256 |
| file_size | bigint | |
| backup_key | text | Clé dans le storage de backup |

### Endpoints API

```
GET    /api/v1/backups/plans              — lister les plans
POST   /api/v1/backups/plans              — créer un plan
PUT    /api/v1/backups/plans/:id          — modifier
DELETE /api/v1/backups/plans/:id          — supprimer
POST   /api/v1/backups/plans/:id/run      — déclencher manuellement

GET    /api/v1/backups/snapshots          — lister les snapshots
GET    /api/v1/backups/snapshots/:id      — détail (avec entries)
DELETE /api/v1/backups/snapshots/:id      — supprimer un snapshot

POST   /api/v1/backups/restore            — restaurer {snapshot_id, node_id?, target_path?}
GET    /api/v1/backups/browse/:snapshot_id — parcourir le contenu d'un snapshot
```

### Worker background

Toutes les 60 secondes, vérifie si un plan doit s'exécuter (`next_run_at <= NOW()`). Si oui :
1. Créer un snapshot `status=running`
2. Lister les fichiers modifiés depuis le dernier snapshot (via SHA256 comparison)
3. Copier chaque fichier modifié dans le répertoire de backup
4. Marquer le snapshot `status=completed`
5. Nettoyer les vieux snapshots (rétention)

### Frontend

- Page `/admin/backups` avec :
  - Liste des plans (CRUD)
  - Timeline des snapshots
  - Restauration avec browser de snapshot
