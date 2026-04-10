# Module Sauvegardes (Backups) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Veeam** | Backup & replication VM/containers/cloud, verification automatique de restauration (SureBackup), orchestration de DR, granular recovery (fichier, objet, DB), immutabilite des backups, reporting avance, multi-cloud (AWS/Azure/GCP) |
| **Acronis** | Cyber Protect (backup + antimalware), image disque complete, backup incrementiel/differentiel, universal restore (hardware different), blockchain notarization, cloud/local hybride, protection ransomware |
| **Restic** | Open source (BSD-2), deduplication content-defined chunking, chiffrement AES-256/Poly1305, multi-backends (S3, B2, SFTP, local, Azure, GCS), snapshots immutables, verification d'integrite, parallele |
| **BorgBackup** | Open source (BSD-3), deduplication cote client, compression (lz4/zstd/zlib), chiffrement authentifie, mount FUSE des archives, pruning automatique, append-only mode |
| **Duplicati** | Open source (MIT), backup chiffre vers cloud (S3, B2, GDrive, OneDrive, Azure), scheduling integre, interface web, verification automatique, incremental forever, deduplication bloc |
| **rclone** | Open source (MIT), sync/copy vers 50+ backends cloud, chiffrement crypt, bisync, bandwidth limiting, dry-run, mount FUSE, serve HTTP/WebDAV, filtering avance |
| **Bareos** | Open source (AGPL), fork de Bacula, backup reseau centralize, catalog SQL, multiple storage daemons, plugins (MySQL, PostgreSQL, LDAP), TLS, scheduling avance |

## Principes directeurs

1. **Zero perte de donnees** — les sauvegardes sont la derniere ligne de defense. Chaque profil definit un RPO (Recovery Point Objective) et un RTO (Recovery Time Objective) avec alertes si non-respecte.
2. **Verification systematique** — une sauvegarde non-testee est une sauvegarde inexistante. Verification automatique d'integrite apres chaque backup et tests de restauration periodiques.
3. **Chiffrement de bout en bout** — toutes les sauvegardes sont chiffrees cote client (AES-256-GCM) avant transfert. Les cles ne quittent jamais l'organisation.
4. **Regle 3-2-1 facilitee** — l'interface guide vers 3 copies, 2 medias differents, 1 hors-site. Indicateur visuel de conformite.
5. **Immutabilite** — les sauvegardes validees sont immutables pendant leur periode de retention (protection ransomware, suppression accidentelle, attaque interne).
6. **Automatisation totale** — une fois le profil configure, les sauvegardes, verifications, rotations et alertes fonctionnent sans intervention humaine.

---

## Categorie 1 — Profils de sauvegarde

### 1.1 Liste des profils
Ecran principal avec tableau des profils existants : nom, cible (conteneur, base de donnees, fichiers, volume), derniere execution, prochain run, statut (OK/Warning/Error), taille totale, retention. Bouton `+ Nouveau profil` en haut a droite. Chaque ligne est cliquable pour acceder au detail. Pastille de couleur pour le statut : vert (OK, dernier backup reussi), orange (Warning, backup reussi mais verification echouee ou espace bas), rouge (Error, dernier backup echoue). Compteur en haut : `12 profils | 10 OK | 1 Warning | 1 Error`. Tri par colonnes (clic sur l'en-tete). Filtre par statut, par type de cible.

### 1.2 Creation de profil (CRUD)
Assistant en 4 etapes :
1. **Source** : type (conteneur Docker, volume, base PostgreSQL, repertoire, service SignApps), selection de la cible specifique. Pour PostgreSQL, autodetection des bases disponibles via `SELECT datname FROM pg_database`. Pour Docker, liste des conteneurs depuis signapps-containers (port 3002).
2. **Destination** : stockage local (volume dedie), stockage distant (S3, B2, SFTP, NFS, Azure Blob, GCS), ou les deux. Test de connectivite en un clic (`Tester la connexion`). Si le test echoue, message d'erreur avec details (`Connection refused sur sftp://backup.example.com:22`).
3. **Planification** : frequence (horaire, quotidienne, hebdomadaire, mensuelle), heure, jour, cron expression pour les avances. Fenetre de maintenance optionnelle (ne pas backuper entre 9h-18h). Editeur cron visuel : selecteurs pour minutes, heures, jours. Preview des 5 prochaines executions.
4. **Retention** : nombre de snapshots a conserver, politique (garder les 7 derniers quotidiens + 4 hebdomadaires + 12 mensuels + 1 annuel), duree maximale. Estimation de l'espace requis basee sur la taille de la source.

Bouton `Sauvegarder` cree le profil. Bouton `Sauvegarder et executer` cree le profil et lance le premier backup immediatement. Validation : le nom du profil doit etre unique au sein de l'organisation, la cron expression doit etre valide, la destination doit etre accessible.

API : `POST /api/v1/backups/profiles` avec body complet. Reponse : `201 Created` avec l'ID du profil. Erreur : `422 Unprocessable Entity` si validation echouee.

### 1.3 Edition et duplication de profil
Modifier un profil existant sans affecter les sauvegardes passees. Dupliquer un profil pour creer une variante (ex: meme config avec destination differente). Historique des modifications du profil (qui a change quoi, quand). Bouton `Dupliquer` pre-remplit le formulaire avec les valeurs du profil source et ajoute ` (copie)` au nom. Suppression d'un profil : confirmation modale `Supprimer le profil "Daily DB" ? Les sauvegardes existantes seront conservees.`. API : `PATCH /api/v1/backups/profiles/:id`, `POST /api/v1/backups/profiles/:id/duplicate`, `DELETE /api/v1/backups/profiles/:id`.

### 1.4 Types de sauvegarde
- **Full** : copie complete de la source. Reference pour les incrementaux.
- **Incrementiel** : uniquement les blocs modifies depuis le dernier backup (full ou incremental). Rapide, compact.
- **Differentiel** : blocs modifies depuis le dernier full. Plus gros que l'incrementiel mais restauration plus rapide.
- **Snapshot** : snapshot atomique (ZFS, LVM, Docker commit) pour coherence transactionnelle.

Configuration par profil : strategie par defaut = 1 full hebdomadaire + incrementiel quotidien. Le type est affiche dans la liste des backups avec un badge : `F` (full, bleu), `I` (incremental, vert), `D` (differentiel, orange), `S` (snapshot, violet).

### 1.5 Declenchement manuel
Bouton `Executer maintenant` sur chaque profil dans la liste. Lance immediatement un backup sans affecter le prochain run planifie. L'execution manuelle est marquee dans l'historique avec le label `Manuel` (vs `Planifie`). Confirmation si le profil est deja en cours d'execution : `Un backup est deja en cours pour ce profil. Voulez-vous en lancer un second ?`. API : `POST /api/v1/backups/profiles/:id/execute`. Reponse : `202 Accepted` avec l'ID de l'execution.

### 1.6 Sauvegarde de conteneurs Docker
Integration avec le backend signapps-containers (port 3002, bollard) :
- **Commit** du conteneur en image avant backup
- **Export** du filesystem du conteneur
- **Volume backup** : sauvegarde des volumes montes separement
- **Config backup** : docker-compose, env vars, labels, networks
- Option : arreter le conteneur pendant le backup pour coherence (configurable)

Si l'arret est active, le conteneur est stoppe, backe, puis redemarre. Duree d'indisponibilite affichee dans l'historique. Si le stop echoue (timeout 60s), le backup continue sans arret et un warning est emis.

### 1.7 Sauvegarde PostgreSQL
- **pg_dump** logique : export SQL complet ou par schema/table. Progression estimee basee sur la taille des tables (`pg_total_relation_size`). Affichage : `Dumping table users (3/42)... 15 Mo`.
- **pg_basebackup** physique : copie binaire pour PITR (Point-In-Time Recovery). Progression via `pg_stat_progress_basebackup`.
- **WAL archiving** : archivage continu des WAL pour recovery au timestamp exact
- Integration avec signapps-db : detection automatique des bases et schemas

Le pg_dump est execute via `tokio::process::Command` avec streaming de la sortie pour la barre de progression. Timeout configurable par profil (defaut : 1 heure). Si le dump excede le timeout, l'execution est marquee en erreur.

### 1.8 Sauvegarde des fichiers et volumes
- Scan du repertoire source, deduplication par content-hash (SHA-256)
- Exclusion par pattern (glob) : `*.tmp`, `node_modules/`, `.git/`
- Inclusion selective : uniquement certains sous-repertoires
- Preservation des permissions, timestamps, liens symboliques

### 1.9 Profils pre-configures
Templates pour les cas courants :
- **Base de donnees quotidienne** : pg_dump + WAL, retention 30j, verification auto
- **Conteneurs critiques** : snapshot + volumes, retention 14j, cross-region
- **Fichiers utilisateur** : incrementiel quotidien, retention 90j
- **Configuration systeme** : hebdomadaire, retention 52 semaines

Chaque template est selectionnable dans l'assistant de creation (etape 0 : `Choisir un template ou creer de zero`). Le template pre-remplit toutes les etapes.

---

## Categorie 2 — Monitoring et dashboard

### 2.1 Dashboard principal
Vue d'ensemble avec cartes KPI en haut :
- **Profils actifs** : 12 (lien vers la liste)
- **Derniere sauvegarde** : il y a 2h (lien vers le detail)
- **Echecs (7j)** : 1 (badge rouge, lien vers les erreurs)
- **Espace total** : 245 Go / 1 To (barre de progression)
- **Taux de succes (30j)** : 98.5% (vert si > 95%, orange si 90-95%, rouge si < 90%)

Graphique d'evolution du volume sauvegarde dans le temps (courbe des 30 derniers jours). Graphique de repartition par type de source (camembert : PostgreSQL 60%, Docker 25%, Fichiers 15%).

### 2.2 Timeline des executions
Chronologie visuelle (Gantt simplifie) des sauvegardes executees : barre verte (succes), orange (warning), rouge (echec). Survol affiche les details (duree, taille, vitesse). Clic ouvre le log detaille. Periode affichee : 24h par defaut, toggle vers 7j ou 30j. Les barres sont proportionnelles a la duree de l'execution. Animation au survol : la barre s'elargit legerement (transform scale 1.05) avec un tooltip detaille.

### 2.3 Statut par profil
Tableau detaille : profil, derniere execution (timestamp), duree, taille du backup, taille incrementielle, statut, prochaine execution. Tri et filtre par statut, par type, par destination. Clic sur le nom du profil ouvre son detail. Raccourci : `Ctrl+F` filtre la liste.

### 2.4 Alertes et notifications
Configuration des alertes :
- Echec de backup → notification immediate (email, push, chat)
- Backup en retard (> X heures apres l'heure prevue)
- Espace de stockage < seuil (ex: 10% restant)
- Verification d'integrite echouee
- RPO non-respecte (derniere sauvegarde trop ancienne)

Canaux : email (module Mail via PgEventBus `backup.alert`), notification push (module Notifications), webhook. Configuration par profil ou globale. Interface : tableau des alertes avec colonne canal, seuil, profil concerne. Bouton `Tester l'alerte` envoie un message test au canal configure. Historique des alertes envoyees avec timestamp et contenu.

### 2.5 Logs detailles
Pour chaque execution : log complet avec timestamps, etapes (preparation, snapshot, transfert, verification, nettoyage), taille transferee, debit, erreurs eventuelles. Niveau de detail configurable (info, debug, trace). Affichage en mode terminal (fond sombre, police monospace, coloration syntaxique). Bouton `Telecharger` pour exporter en fichier `.log`. Filtre par niveau (erreurs uniquement). Recherche par mot-cle dans les logs.

### 2.6 Rapports periodiques
Rapport hebdomadaire/mensuel automatique : resume des sauvegardes (succes/echec), espace consomme, tendance de croissance, profils non-executes, recommandations. Envoi par email au responsable via PgEventBus `backup.report.weekly`. Le rapport est genere en PDF et HTML. Destinataires configurables dans les parametres.

### 2.7 Metriques Prometheus
Export des metriques pour le module signapps-metrics (port 3008) :
- `backup_last_success_timestamp` par profil
- `backup_last_duration_seconds` par profil
- `backup_total_size_bytes` par destination
- `backup_failure_count` par profil et par periode
- `backup_storage_usage_ratio` par destination
- `backup_execution_count_total` par profil et par statut
- `backup_deduplication_ratio` par profil

Endpoint : `GET /metrics` au format Prometheus.

### 2.8 Calendrier des sauvegardes
Vue calendrier montrant toutes les executions planifiees pour le mois en cours. Chaque jour affiche les profils planifies. Clic sur un jour montre la liste des executions passees et futures. Code couleur : vert (execute avec succes), rouge (echec), gris (planifie, pas encore execute), bleu (en cours). Vue par semaine ou par mois. Integration possible avec le module Calendar via l'evenement `backup.scheduled`.

---

## Categorie 3 — Execution et progression

### 3.1 Barre de progression pg_dump
Pendant l'execution d'un backup PostgreSQL, la barre de progression affiche :
- Phase courante : `Dumping table "users" (3/42)`
- Pourcentage base sur le nombre de tables traitees / total
- Taille dumpee en temps reel : `125 Mo`
- Debit : `15.2 Mo/s`
- Temps ecoule : `00:02:15`
- Estimation du temps restant : `~00:08:30`

La progression est mise a jour toutes les secondes via SSE. Si la connexion SSE est perdue, le frontend tente une reconnexion automatique toutes les 5 secondes et affiche `Reconnexion...` dans la barre.

### 3.2 Barre de progression fichiers
Pour les backups de fichiers :
- Fichier en cours : `data/storage/uploads/report-2026.pdf`
- Fichiers traites / total : `1 542 / 8 903`
- Taille traitee / totale : `2.1 Go / 12.4 Go`
- Debit : `45 Mo/s`
- Estimation restante : `~00:03:45`
- Fichiers inchanges (skipped) : `6 200` (deduplication)

### 3.3 Execution parallele
Plusieurs backups peuvent s'executer en parallele si les sources sont differentes. Un indicateur dans le dashboard montre le nombre d'executions en cours : `3 backups en cours`. Limite configurable de backups paralleles (defaut : 4). Si la limite est atteinte, les suivants sont mis en file d'attente avec le statut `Queued`.

### 3.4 Annulation d'une execution
Bouton `Annuler` (croix rouge) sur une execution en cours. Confirmation : `Annuler le backup en cours de "Daily DB" ? Les donnees partiellement transferees seront nettoyees.`. Le backend envoie un signal d'arret au processus (pg_dump kill, transfert interrompu). Statut final : `Cancelled`. Les fichiers temporaires sont supprimes dans les 60 secondes.

---

## Categorie 4 — Verification des sauvegardes

### 4.1 Verification d'integrite automatique (checksum)
Apres chaque sauvegarde : verification des checksums (SHA-256) de chaque bloc. Comparaison avec le manifest. Alerte si corruption detectee. Re-upload automatique des blocs corrompus. Le checksum est calcule pendant le transfert (pas de relecture apres ecriture). Le manifest est stocke separement de la sauvegarde. Si un bloc corrompu est detecte, le statut de l'execution passe a `Warning` avec le detail `2 blocs corrompus re-uploades`. Evenement PgEventBus : `backup.integrity.warning`.

### 4.2 Test de restauration automatique (SureBackup)
Planification de tests de restauration periodiques (hebdomadaire, mensuel). Le systeme restaure automatiquement dans un environnement isole (conteneur temporaire), verifie que les donnees sont lisibles, puis detruit l'environnement. Rapport de test avec resultat (OK/KO). Pour PostgreSQL : restauration dans une instance temporaire, execution de `SELECT count(*) FROM <critical_tables>`, verification que les counts sont coherents. Pour les fichiers : verification que les fichiers sont lisibles et que les checksums correspondent. Le conteneur temporaire est nettoye automatiquement apres le test (max 30 minutes de vie). Evenement PgEventBus : `backup.restore_test.completed`.

### 4.3 Verification de coherence PostgreSQL
Pour les backups de base : restauration dans une instance temporaire, execution de `pg_catalog` checks, verification des tables critiques (COUNT, checksum). Rapport de coherence avec detail par table.

### 4.4 Verification de taille
Alerte si la taille d'un backup est anormalement petite (< 50% de la moyenne) ou grande (> 200% de la moyenne). Indication d'un probleme potentiel (source vide, explosion de donnees, corruption). Le seuil est calcule sur la moyenne des 10 derniers backups du meme profil.

### 4.5 Tableau de bord de verification
Panneau dedie : liste des verifications executees, resultat (OK/Warning/Error), date, duree, details. Filtres par profil, par type de verification, par resultat. Score de confiance global : pourcentage de backups verifies avec succes sur les 30 derniers jours. Badge affiche dans le dashboard principal : `Score de confiance : 97%` (vert si > 95%).

### 4.6 Politique de verification
Definition de regles : "verifier l'integrite apres chaque backup", "tester la restauration une fois par semaine", "verifier la coherence DB une fois par mois". Application par profil ou globale. Interface : tableau avec colonne type de verification, frequence, derniere execution, prochain run.

---

## Categorie 5 — Restauration

### 5.1 Wizard de restauration
Assistant en 3 etapes :
1. **Selection du backup** : liste des snapshots disponibles pour le profil selectionne. Chaque snapshot affiche : date, taille, type (full/incremental), verification (OK/Warning/Non-teste). Filtres par date, par type. Le snapshot le plus recent est pre-selectionne. API : `GET /api/v1/backups/profiles/:id/snapshots`.
2. **Preview** : affichage du contenu du snapshot (arborescence de fichiers ou liste des tables/schemas). Pour PostgreSQL : nombre de tables, nombre de lignes estimees, taille. Pour les fichiers : arborescence navigable. Pour Docker : image, volumes, config. Avertissements affiches : `Cette restauration ecrasera la base "signapps" actuelle.` ou `Le conteneur "nginx" sera arrete pendant la restauration.`.
3. **Confirmation** : resume de l'operation (source snapshot, destination, type de restauration). Checkbox obligatoire : `Je confirme vouloir restaurer ces donnees`. Bouton `Restaurer` (rouge pour les restaurations destructives, bleu pour les restaurations vers un nouvel emplacement).

API : `POST /api/v1/backups/profiles/:id/restore` avec `{ snapshot_id, target, options }`. Reponse : `202 Accepted` avec l'ID de l'operation de restauration.

### 5.2 Restauration complete
Selection du profil, du snapshot (date/heure), lancement de la restauration. Choix de la destination : emplacement original (ecrasement) ou nouvel emplacement. Barre de progression avec ETA identique a la barre de backup. Evenement PgEventBus : `backup.restore.started`, `backup.restore.completed`, `backup.restore.failed`.

### 5.3 Restauration granulaire
Pour les backups de fichiers : naviguer dans l'arborescence du snapshot, selectionner un fichier ou un repertoire specifique, restaurer uniquement celui-ci. Pour PostgreSQL : restaurer une table ou un schema specifique. Interface de selection avec checkboxes. Les elements selectionnes sont affiches dans un panneau lateral `A restaurer (3 elements, 45 Mo)`.

### 5.4 Point-In-Time Recovery (PITR)
Pour les backups PostgreSQL avec WAL archiving : choisir un timestamp exact (ex: "2026-04-09 14:30:00") et restaurer l'etat de la base a cet instant precis. Utile apres un DELETE accidentel. Datepicker avec selecteur d'heure a la seconde pres. Plage disponible affichee : `WAL disponibles du 2026-04-01 00:00:00 au 2026-04-09 23:59:59`.

### 5.5 Restauration vers un conteneur
Creer un nouveau conteneur a partir d'un backup de conteneur. Configuration : meme image, memes volumes, memes reseaux, ou configuration modifiee. Demarrage automatique apres restauration.

### 5.6 Dry-run de restauration
Mode simulation : execute toutes les etapes sauf l'ecriture effective. Verifie que le snapshot est lisible, que l'espace est suffisant, que les permissions sont correctes. Rapport avant de lancer la vraie restauration. Affichage : `Dry-run termine. Espace requis : 12.4 Go. Espace disponible : 450 Go. Resultat : OK`. API : `POST /api/v1/backups/profiles/:id/restore` avec `{ dry_run: true }`.

### 5.7 Historique des restaurations
Log de toutes les restaurations effectuees : date, profil, snapshot source, destination, duree, resultat, utilisateur. Audit trail pour la conformite.

---

## Categorie 6 — Cross-Region et replication

### 6.1 Configuration de replication
Interface de configuration par profil : ajouter une ou plusieurs destinations secondaires. Formulaire : type de destination (S3, SFTP, Azure Blob), credentials (chiffres dans le vault), region, bucket/path. Bouton `Tester la connexion`. La replication est declenchee automatiquement apres chaque backup primaire reussi. Delai configurable : immediat, 1h, 6h, 24h. API : `POST /api/v1/backups/profiles/:id/replicas`.

### 6.2 Replication vers un site distant
Configuration de destinations secondaires pour chaque profil. Replication asynchrone apres le backup primaire. Destinations supportees : autre instance SignApps, S3 dans une autre region, serveur SFTP distant, Azure Blob. Progression de la replication affichee dans le dashboard : `Replication en cours : 45% (3.2 Go / 7.1 Go)`.

### 6.3 Strategie cross-region
Definition de strategies : "repliquer tous les backups", "repliquer uniquement les full hebdomadaires", "repliquer avec un delai de 24h" (protection contre la suppression accidentelle repliquee). Configuration par profil dans l'onglet `Replication`.

### 6.4 Synchronisation bidirectionnelle
Pour les deploiements multi-sites : synchronisation des sauvegardes entre deux sites. Chaque site sauvegarde ses donnees locales et replique vers l'autre. En cas de sinistre, restauration depuis le site survivant.

### 6.5 Bandwidth management
Limitation de bande passante pour la replication : debit max (Mo/s), heures creuses preferees (nuit/week-end), priorite par profil. Indicateur de progression et ETA. Configuration : slider pour le debit max (1 Mo/s a illimite), checkbox `Heures creuses uniquement` avec plage horaire.

### 6.6 Statut de replication
Tableau de bord : snapshots repliques vs en attente, latence de replication, derniere synchronisation reussie, ecart entre primaire et replique. Alerte si ecart > seuil (defaut : 24h). Badge dans la liste des profils : icone de cloud avec checkmark vert si replique, horloge orange si en attente, croix rouge si echoue.

---

## Categorie 7 — Incremental et deduplication

### 7.1 Deduplication par contenu
Chunking base sur le contenu (content-defined chunking, CDC) : chaque fichier est decoupe en blocs de taille variable, chaque bloc est identifie par son hash SHA-256. Les blocs identiques ne sont stockes qu'une seule fois, meme entre profils differents.

### 7.2 Compression des blocs
Chaque bloc est compresse avant stockage : zstd (par defaut, bon ratio/vitesse), lz4 (rapide, compression moderee), zlib (compatible, compression elevee). Choix par profil. Affichage du taux de compression dans les details du backup : `Compression : 3.2x (12.4 Go → 3.9 Go)`.

### 7.3 Chiffrement des blocs (AES-256)
Chaque bloc est chiffre individuellement (AES-256-GCM) avec une cle derivee de la master key du profil. La cle master est protegee par mot de passe ou par le vault SignApps. Perte de la cle = perte des donnees. Avertissement a la creation du profil : `La cle de chiffrement est essentielle pour la restauration. Conservez-la en lieu sur.`. La cle n'est jamais stockee en clair en base — uniquement le hash pour verification.

### 7.4 Ratio de deduplication
Affichage du ratio par profil et global : taille logique (donnees sources) vs taille physique (donnees stockees). Ex: 500 Go logique, 120 Go physique = ratio 4.2x. Graphique d'evolution du ratio dans le temps. Widget dashboard : `Deduplication globale : 3.8x — 420 Go economises`.

### 7.5 Garbage collection
Nettoyage periodique des blocs orphelins (plus references par aucun snapshot). Execution planifiee (hebdomadaire par defaut) ou manuelle. Mode dry-run pour voir ce qui serait supprime : `Dry-run : 234 blocs orphelins detectes (1.2 Go). Supprimer ?`. Protection : ne jamais supprimer pendant un backup en cours. L'execution est bloquee si un backup est actif.

### 7.6 Cache de deduplication
Index des hashes en memoire pour accelerer la deduplication. Taille configurable (defaut : 256 Mo). Invalidation automatique apres garbage collection. Statistiques de hit/miss affichees dans le dashboard : `Cache dedup : 94% hit rate`.

---

## Categorie 8 — Securite et conformite

### 8.1 Chiffrement en transit
Toutes les communications de backup utilisent TLS 1.3. Verification du certificat du serveur distant. Pas de fallback vers des versions TLS obsoletes.

### 8.2 Immutabilite des snapshots
Les snapshots valides sont marques comme immutables pendant la duree de retention. Aucune suppression possible (meme par l'admin) avant expiration. Protection contre le ransomware et la suppression accidentelle. Tentative de suppression d'un snapshot immutable retourne `403 Forbidden` avec le message `Snapshot protected until 2026-12-31. Cannot delete.`.

### 8.3 Rotation des cles
Rotation periodique des cles de chiffrement (annuelle par defaut). Les anciens snapshots restent dechiffrables avec l'ancienne cle (stockee dans le vault). Nouvelle cle pour les nouveaux snapshots. Notification 30 jours avant la rotation prevue.

### 8.4 Audit des acces
Log de tous les acces aux sauvegardes : qui a cree, consulte, restaure, supprime un snapshot. Horodatage et IP source. Export pour conformite (RGPD, SOC2, ISO 27001). Chaque action est enregistree dans la table `backup_audit_log`.

### 8.5 RBAC (Role-Based Access Control)
Roles : `backup-admin` (tout), `backup-operator` (executer, restaurer), `backup-viewer` (consulter). Attribution par profil ou globale. Integration avec signapps-identity (RBAC existant). Un `backup-viewer` ne voit que la liste et les statuts, pas les logs detailles ni les donnees.

### 8.6 Retention legale (legal hold)
Marquer un snapshot sous retention legale : aucune suppression ni modification possible, meme apres expiration de la retention normale. Levee uniquement par un admin designe. Badge `Legal Hold` affiche sur le snapshot concerne.

### 8.7 Alertes email en cas d'echec
Configuration par profil : adresses email a notifier en cas d'echec. Le systeme envoie un email via le module Mail (evenement PgEventBus `backup.failed`) contenant : nom du profil, date/heure, message d'erreur, lien vers les logs. Template email personnalisable dans les parametres. Les alertes sont envoyees immediatement apres l'echec (pas de delai batch).

---

## Schema PostgreSQL

```sql
-- Profils de sauvegarde
CREATE TABLE backup_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('postgresql', 'docker', 'volume', 'directory', 'service')),
    source_config JSONB NOT NULL,
    destination_type VARCHAR(20) NOT NULL CHECK (destination_type IN ('local', 's3', 'b2', 'sftp', 'nfs', 'azure', 'gcs')),
    destination_config JSONB NOT NULL,
    schedule_cron VARCHAR(100) NOT NULL,
    schedule_timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    backup_type VARCHAR(20) NOT NULL DEFAULT 'incremental' CHECK (backup_type IN ('full', 'incremental', 'differential', 'snapshot')),
    retention_policy JSONB NOT NULL DEFAULT '{"daily": 7, "weekly": 4, "monthly": 12, "yearly": 1}',
    encryption_enabled BOOLEAN NOT NULL DEFAULT true,
    encryption_key_id UUID,
    compression_algo VARCHAR(10) NOT NULL DEFAULT 'zstd' CHECK (compression_algo IN ('zstd', 'lz4', 'zlib', 'none')),
    max_parallel INTEGER NOT NULL DEFAULT 1,
    timeout_seconds INTEGER NOT NULL DEFAULT 3600,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, name)
);
CREATE INDEX idx_backup_profiles_org ON backup_profiles(org_id);

-- Executions de sauvegarde
CREATE TABLE backup_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES backup_profiles(id),
    execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('scheduled', 'manual', 'restore_test')),
    backup_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'warning', 'error', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    source_size_bytes BIGINT,
    backup_size_bytes BIGINT,
    deduplication_ratio NUMERIC(5,2),
    compression_ratio NUMERIC(5,2),
    blocks_new INTEGER DEFAULT 0,
    blocks_reused INTEGER DEFAULT 0,
    error_message TEXT,
    log_path VARCHAR(500),
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_executions_profile ON backup_executions(profile_id);
CREATE INDEX idx_backup_executions_status ON backup_executions(status);
CREATE INDEX idx_backup_executions_started ON backup_executions(started_at DESC);

-- Snapshots (points de restauration)
CREATE TABLE backup_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES backup_executions(id),
    profile_id UUID NOT NULL REFERENCES backup_profiles(id),
    snapshot_date TIMESTAMPTZ NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    manifest JSONB NOT NULL,
    is_full BOOLEAN NOT NULL DEFAULT false,
    parent_snapshot_id UUID REFERENCES backup_snapshots(id),
    retention_until DATE NOT NULL,
    is_immutable BOOLEAN NOT NULL DEFAULT true,
    legal_hold BOOLEAN NOT NULL DEFAULT false,
    legal_hold_by UUID REFERENCES users(id),
    integrity_verified BOOLEAN NOT NULL DEFAULT false,
    integrity_verified_at TIMESTAMPTZ,
    restore_tested BOOLEAN NOT NULL DEFAULT false,
    restore_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_snapshots_profile ON backup_snapshots(profile_id);
CREATE INDEX idx_backup_snapshots_date ON backup_snapshots(snapshot_date DESC);

-- Replication cross-region
CREATE TABLE backup_replicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES backup_profiles(id),
    destination_type VARCHAR(20) NOT NULL,
    destination_config JSONB NOT NULL,
    strategy VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (strategy IN ('all', 'full_only', 'delayed')),
    delay_hours INTEGER DEFAULT 0,
    bandwidth_limit_mbps INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verifications d'integrite
CREATE TABLE backup_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES backup_snapshots(id),
    verification_type VARCHAR(30) NOT NULL CHECK (verification_type IN ('checksum', 'restore_test', 'pg_coherence', 'size_check')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'warning', 'error')),
    details JSONB,
    duration_seconds INTEGER,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_verifications_snapshot ON backup_verifications(snapshot_id);

-- Restaurations
CREATE TABLE backup_restorations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES backup_snapshots(id),
    profile_id UUID NOT NULL REFERENCES backup_profiles(id),
    target_type VARCHAR(30) NOT NULL,
    target_config JSONB NOT NULL,
    is_dry_run BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    restored_size_bytes BIGINT,
    error_message TEXT,
    initiated_by UUID NOT NULL REFERENCES users(id)
);

-- Alertes
CREATE TABLE backup_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES backup_profiles(id),
    alert_type VARCHAR(30) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    channel VARCHAR(20) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id)
);

-- Audit log
CREATE TABLE backup_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(30) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_audit_log ON backup_audit_log(org_id, entity_type, entity_id);
```

---

## PgEventBus Events

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `backup.started` | `{ profile_id, execution_id, backup_type }` | Backups | Dashboard, Metrics |
| `backup.completed` | `{ profile_id, execution_id, status, size_bytes, duration_seconds }` | Backups | Dashboard, Metrics, Alerts |
| `backup.failed` | `{ profile_id, execution_id, error_message }` | Backups | Alerts, Mail, Notifications |
| `backup.alert` | `{ profile_id, alert_type, severity, message }` | Backups | Mail, Notifications |
| `backup.integrity.warning` | `{ snapshot_id, corrupted_blocks, re_uploaded }` | Backups | Alerts, Dashboard |
| `backup.restore.started` | `{ snapshot_id, target, initiated_by }` | Backups | Dashboard, Audit |
| `backup.restore.completed` | `{ snapshot_id, target, duration_seconds, status }` | Backups | Dashboard, Notifications |
| `backup.restore.failed` | `{ snapshot_id, target, error_message }` | Backups | Alerts, Notifications |
| `backup.restore_test.completed` | `{ snapshot_id, result, details }` | Backups | Dashboard, Alerts |
| `backup.report.weekly` | `{ org_id, report_data, recipients }` | Backups | Mail |
| `backup.scheduled` | `{ profile_id, next_execution_at }` | Backups | Calendar |
| `backup.retention.expired` | `{ snapshot_id, profile_id }` | Backups | Audit |
| `backup.replication.completed` | `{ snapshot_id, replica_id, destination }` | Backups | Dashboard |

---

## REST API Endpoints

```
# Profiles
GET    /api/v1/backups/profiles                        — List all backup profiles (filter: source_type, status, is_active)
POST   /api/v1/backups/profiles                        — Create a new backup profile
GET    /api/v1/backups/profiles/:id                     — Get profile details
PATCH  /api/v1/backups/profiles/:id                     — Update a profile
DELETE /api/v1/backups/profiles/:id                     — Delete a profile (backups retained)
POST   /api/v1/backups/profiles/:id/duplicate           — Duplicate a profile
POST   /api/v1/backups/profiles/:id/execute             — Trigger manual backup execution
POST   /api/v1/backups/profiles/:id/test-connection     — Test destination connectivity

# Executions
GET    /api/v1/backups/executions                       — List executions (filter: profile_id, status, date_range)
GET    /api/v1/backups/executions/:id                   — Get execution details with logs
POST   /api/v1/backups/executions/:id/cancel            — Cancel a running execution
GET    /api/v1/backups/executions/:id/logs              — Stream execution logs (SSE)
GET    /api/v1/backups/executions/:id/progress          — Get current progress (SSE)

# Snapshots
GET    /api/v1/backups/profiles/:id/snapshots           — List snapshots for a profile
GET    /api/v1/backups/snapshots/:id                    — Get snapshot details with manifest
GET    /api/v1/backups/snapshots/:id/browse             — Browse snapshot contents (tree)
POST   /api/v1/backups/snapshots/:id/verify             — Trigger integrity verification
POST   /api/v1/backups/snapshots/:id/legal-hold         — Toggle legal hold

# Restore
POST   /api/v1/backups/profiles/:id/restore             — Start restoration (body: snapshot_id, target, options, dry_run)
GET    /api/v1/backups/restorations/:id                 — Get restoration status/progress
POST   /api/v1/backups/restorations/:id/cancel          — Cancel a running restoration

# Replicas
GET    /api/v1/backups/profiles/:id/replicas            — List replicas for a profile
POST   /api/v1/backups/profiles/:id/replicas            — Add a replica destination
PATCH  /api/v1/backups/replicas/:id                     — Update replica config
DELETE /api/v1/backups/replicas/:id                     — Remove a replica

# Verifications
GET    /api/v1/backups/verifications                    — List all verifications (filter: status, type)
POST   /api/v1/backups/snapshots/:id/restore-test       — Trigger automated restore test

# Dashboard
GET    /api/v1/backups/dashboard                        — Dashboard KPIs and summary
GET    /api/v1/backups/dashboard/timeline               — Execution timeline (period: 24h, 7d, 30d)
GET    /api/v1/backups/dashboard/calendar               — Calendar view of scheduled backups

# Alerts
GET    /api/v1/backups/alerts                           — List alerts (filter: severity, acknowledged)
POST   /api/v1/backups/alerts/:id/acknowledge           — Acknowledge an alert
POST   /api/v1/backups/alerts/test                      — Send a test alert

# Metrics
GET    /metrics                                         — Prometheus metrics endpoint
```

Auth JWT. Rate limiting : 60 req/min. All destructive operations require `backup-admin` or `backup-operator` role.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Veeam Help Center** (helpcenter.veeam.com) — documentation complete sur les strategies de backup, SureBackup, replication, restauration granulaire.
- **Restic Documentation** (restic.readthedocs.io) — architecture de deduplication, backends supportes, commandes de restauration, design principles.
- **BorgBackup Documentation** (borgbackup.readthedocs.io) — concepts de deduplication, compression, chiffrement, pruning, append-only mode.
- **Duplicati Documentation** (docs.duplicati.com) — strategies de backup incrementiel, chiffrement, scheduling, verification.
- **rclone Documentation** (rclone.org/docs) — configuration des backends cloud, filtres, sync strategies, chiffrement.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Restic** (github.com/restic/restic) | **BSD-2-Clause** | Architecture de deduplication CDC, format de repository, backends multiples, chiffrement. Reference principale. |
| **rclone** (github.com/rclone/rclone) | **MIT** | Abstraction multi-backends cloud (S3, B2, GCS, Azure, SFTP), sync bidirectionnel, bandwidth limiting, crypt overlay. |
| **Duplicati** (github.com/duplicati/duplicati) | **MIT** | Pattern de backup incrementiel chiffre vers le cloud, scheduling, verification automatique, interface web. |
| **BorgBackup** (github.com/borgbackup/borg) | **BSD-3-Clause** | Deduplication content-defined chunking, compression multi-algo, chiffrement authentifie, pruning policies. |
| **Bareos** (github.com/bareos/bareos) | **AGPL-3.0** | **INTERDIT** (AGPL). Reference pedagogique uniquement via la documentation. |
| **rustic** (github.com/rustic-rs/rustic) | **MIT/Apache-2.0** | Implementation Rust d'un client compatible restic. Pattern pour la deduplication et le chiffrement en Rust. |
| **opendal** (github.com/apache/opendal) | **Apache-2.0** | Deja utilise dans SignApps (signapps-storage). Abstraction de stockage multi-backend. |
| **sha2** (github.com/RustCrypto/hashes) | **MIT/Apache-2.0** | Hashing SHA-256 en Rust pour la deduplication et la verification d'integrite. |
| **aes-gcm** (github.com/RustCrypto/AEADs) | **MIT/Apache-2.0** | Chiffrement AES-256-GCM en Rust pour le chiffrement des blocs. |
| **zstd** (github.com/gyscos/zstd-rs) | **MIT** | Bindings Rust pour zstd. Compression des blocs de backup. |
| **bollard** (github.com/fussybeaver/bollard) | **MIT/Apache-2.0** | Deja utilise dans signapps-containers. API Docker pour les snapshots et exports de conteneurs. |
| **cron** (github.com/zslayton/cron) | **MIT/Apache-2.0** | Parsing d'expressions cron en Rust pour le scheduling des sauvegardes. |

### Pattern d'implementation recommande
1. **Deduplication** : content-defined chunking (CDC) avec Rabin fingerprint ou FastCDC. Taille de bloc moyenne 1-4 Mo. Hash SHA-256 pour l'identification. Inspiree de restic/borg (BSD).
2. **Stockage** : OpenDAL (Apache-2.0, deja dans SignApps) pour l'abstraction multi-backend. Repository = manifest JSON + blocs nommes par hash.
3. **Chiffrement** : `aes-gcm` (MIT) pour le chiffrement des blocs. Cle derivee via Argon2 (MIT) depuis la passphrase ou le vault.
4. **Compression** : `zstd-rs` (MIT) par defaut. Detection auto du type de contenu (pas de re-compression des JPEG, videos, archives).
5. **Scheduling** : `cron` crate (MIT) pour parser les expressions. Execution via tokio runtime avec retry sur echec.
6. **Docker integration** : `bollard` (MIT, deja present) pour `container.commit()`, `container.export()`, `volume` operations.
7. **PostgreSQL** : invocation de `pg_dump`/`pg_basebackup` via `tokio::process::Command`. WAL archiving via configuration PostgreSQL.

### Ce qu'il ne faut PAS faire
- **Pas de backup sans chiffrement** — meme en local, les donnees sont chiffrees au repos.
- **Pas de suppression sans verification** — le garbage collector ne supprime jamais un bloc encore reference.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT/BSD. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque).
- **Pas de backup en texte clair vers le cloud** — chiffrement obligatoire avant transfert.
- **Pas de single point of failure** — toujours proposer au moins 2 destinations.

---

## Assertions E2E cles (a tester)

- Creation d'un profil de sauvegarde pour un conteneur Docker (assistant 4 etapes)
- Creation d'un profil pour une base PostgreSQL
- Edition et duplication d'un profil existant
- Execution manuelle d'un backup et verification du statut OK
- Barre de progression pg_dump avec nombre de tables et taille
- Annulation d'un backup en cours
- Verification automatique d'integrite apres backup (checksums SHA-256)
- Test de restauration automatique (SureBackup) avec rapport OK/KO
- Planification d'un backup recurrent (cron) et verification de l'execution
- Wizard de restauration : selection snapshot → preview → confirmation → restauration
- Restauration complete depuis un snapshot vers l'emplacement original
- Restauration granulaire d'un fichier specifique depuis un snapshot
- Dry-run de restauration sans ecriture effective
- PITR PostgreSQL a un timestamp exact
- Dashboard affiche correctement les statuts (OK/Warning/Error)
- Calendrier des sauvegardes avec vue mensuelle
- Alerte email envoyee sur echec de backup
- Configuration de replication cross-region vers S3
- Replication effective apres un backup reussi
- Deduplication effective (ratio > 1x sur des donnees similaires)
- Chiffrement AES-256-GCM verifie (donnees non-lisibles sans cle)
- Immutabilite : impossible de supprimer un snapshot avant expiration (403)
- Legal hold : snapshot non-supprimable meme apres expiration
- Politique de retention respectee (suppression des snapshots expires)
- Garbage collection en dry-run puis execution reelle
- Metriques Prometheus exportees correctement
- RBAC : un backup-viewer ne peut pas restaurer ni executer
- Profils pre-configures : selection d'un template et creation rapide
