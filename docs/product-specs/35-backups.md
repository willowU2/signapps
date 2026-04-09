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
Ecran principal avec tableau des profils existants : nom, cible (conteneur, base de donnees, fichiers, volume), derniere execution, prochain run, statut (OK/Warning/Error), taille totale, retention. Bouton `+ Nouveau profil` en haut a droite.

### 1.2 Creation de profil
Assistant en 4 etapes :
1. **Source** : type (conteneur Docker, volume, base PostgreSQL, repertoire, service SignApps), selection de la cible specifique
2. **Destination** : stockage local (volume dedie), stockage distant (S3, B2, SFTP, NFS, Azure Blob, GCS), ou les deux
3. **Planification** : frequence (horaire, quotidienne, hebdomadaire, mensuelle), heure, jour, cron expression pour les avances. Fenetre de maintenance optionnelle (ne pas backuper entre 9h-18h)
4. **Retention** : nombre de snapshots a conserver, politique (garder les 7 derniers quotidiens + 4 hebdomadaires + 12 mensuels + 1 annuel), duree maximale

### 1.3 Types de sauvegarde
- **Full** : copie complete de la source. Reference pour les incrementaux.
- **Incrementiel** : uniquement les blocs modifies depuis le dernier backup (full ou incremental). Rapide, compact.
- **Differentiel** : blocs modifies depuis le dernier full. Plus gros que l'incrementiel mais restauration plus rapide.
- **Snapshot** : snapshot atomique (ZFS, LVM, Docker commit) pour coherence transactionnelle.

Configuration par profil : strategie par defaut = 1 full hebdomadaire + incrementiel quotidien.

### 1.4 Sauvegarde de conteneurs Docker
Integration avec le backend signapps-containers (port 3002, bollard) :
- **Commit** du conteneur en image avant backup
- **Export** du filesystem du conteneur
- **Volume backup** : sauvegarde des volumes montes separement
- **Config backup** : docker-compose, env vars, labels, networks
- Option : arreter le conteneur pendant le backup pour coherence (configurable)

### 1.5 Sauvegarde PostgreSQL
- **pg_dump** logique : export SQL complet ou par schema/table
- **pg_basebackup** physique : copie binaire pour PITR (Point-In-Time Recovery)
- **WAL archiving** : archivage continu des WAL pour recovery au timestamp exact
- Integration avec signapps-db : detection automatique des bases et schemas

### 1.6 Sauvegarde des fichiers et volumes
- Scan du repertoire source, deduplication par content-hash (SHA-256)
- Exclusion par pattern (glob) : `*.tmp`, `node_modules/`, `.git/`
- Inclusion selective : uniquement certains sous-repertoires
- Preservation des permissions, timestamps, liens symboliques

### 1.7 Profils pre-configures
Templates pour les cas courants :
- **Base de donnees quotidienne** : pg_dump + WAL, retention 30j, verification auto
- **Conteneurs critiques** : snapshot + volumes, retention 14j, cross-region
- **Fichiers utilisateur** : incrementiel quotidien, retention 90j
- **Configuration systeme** : hebdomadaire, retention 52 semaines

### 1.8 Edition et duplication de profil
Modifier un profil existant sans affecter les sauvegardes passees. Dupliquer un profil pour creer une variante (ex: meme config avec destination differente). Historique des modifications du profil.

---

## Categorie 2 — Monitoring et dashboard

### 2.1 Dashboard principal
Vue d'ensemble : nombre total de profils, derniere sauvegarde reussie, nombre de backups en echec (derniere 24h/7j/30j), espace total utilise, espace disponible. Graphique d'evolution du volume sauvegarde dans le temps.

### 2.2 Timeline des executions
Chronologie visuelle (Gantt simplifie) des sauvegardes executees : barre verte (succes), orange (warning), rouge (echec). Survol affiche les details (duree, taille, vitesse). Clic ouvre le log detaille.

### 2.3 Statut par profil
Tableau detaille : profil, derniere execution (timestamp), duree, taille du backup, taille incrementielle, statut, prochaine execution. Tri et filtre par statut, par type, par destination.

### 2.4 Alertes et notifications
Configuration des alertes :
- Echec de backup → notification immediate (email, push, chat)
- Backup en retard (> X heures apres l'heure prevue)
- Espace de stockage < seuil (ex: 10% restant)
- Verification d'integrite echouee
- RPO non-respecte (derniere sauvegarde trop ancienne)
Canaux : email (module Mail), notification push (module Notifications), webhook.

### 2.5 Logs detailles
Pour chaque execution : log complet avec timestamps, etapes (preparation, snapshot, transfert, verification, nettoyage), taille transferee, debit, erreurs eventuelles. Niveau de detail configurable (info, debug, trace).

### 2.6 Rapports periodiques
Rapport hebdomadaire/mensuel automatique : resume des sauvegardes (succes/echec), espace consomme, tendance de croissance, profils non-executes, recommandations. Envoi par email au responsable.

### 2.7 Metriques Prometheus
Export des metriques pour le module signapps-metrics (port 3008) :
- `backup_last_success_timestamp` par profil
- `backup_last_duration_seconds` par profil
- `backup_total_size_bytes` par destination
- `backup_failure_count` par profil et par periode
- `backup_storage_usage_ratio` par destination

---

## Categorie 3 — Verification des sauvegardes

### 3.1 Verification d'integrite automatique
Apres chaque sauvegarde : verification des checksums (SHA-256) de chaque bloc. Comparaison avec le manifest. Alerte si corruption detectee. Re-upload automatique des blocs corrompus.

### 3.2 Test de restauration automatique (SureBackup)
Planification de tests de restauration periodiques (hebdomadaire, mensuel). Le systeme restaure automatiquement dans un environnement isole (conteneur temporaire), verifie que les donnees sont lisibles, puis detruit l'environnement. Rapport de test avec resultat (OK/KO).

### 3.3 Verification de coherence PostgreSQL
Pour les backups de base : restauration dans une instance temporaire, execution de `pg_catalog` checks, verification des tables critiques (COUNT, checksum). Rapport de coherence.

### 3.4 Verification de taille
Alerte si la taille d'un backup est anormalement petite (< 50% de la moyenne) ou grande (> 200% de la moyenne). Indication d'un probleme potentiel (source vide, explosion de donnees, corruption).

### 3.5 Tableau de bord de verification
Panneau dedie : liste des verifications executees, resultat (OK/Warning/Error), date, duree, details. Filtres par profil, par type de verification, par resultat. Score de confiance global : pourcentage de backups verifies avec succes.

### 3.6 Politique de verification
Definition de regles : "verifier l'integrite apres chaque backup", "tester la restauration une fois par semaine", "verifier la coherence DB une fois par mois". Application par profil ou globale.

---

## Categorie 4 — Restauration

### 4.1 Restauration complete
Selection du profil, du snapshot (date/heure), lancement de la restauration. Choix de la destination : emplacement original (ecrasement) ou nouvel emplacement. Barre de progression avec ETA.

### 4.2 Restauration granulaire
Pour les backups de fichiers : naviguer dans l'arborescence du snapshot, selectionner un fichier ou un repertoire specifique, restaurer uniquement celui-ci. Pour PostgreSQL : restaurer une table ou un schema specifique.

### 4.3 Point-In-Time Recovery (PITR)
Pour les backups PostgreSQL avec WAL archiving : choisir un timestamp exact (ex: "2026-04-09 14:30:00") et restaurer l'etat de la base a cet instant precis. Utile apres un DELETE accidentel.

### 4.4 Restauration vers un conteneur
Creer un nouveau conteneur a partir d'un backup de conteneur. Configuration : meme image, memes volumes, memes reseaux, ou configuration modifiee. Demarrage automatique apres restauration.

### 4.5 Dry-run de restauration
Mode simulation : execute toutes les etapes sauf l'ecriture effective. Verifie que le snapshot est lisible, que l'espace est suffisant, que les permissions sont correctes. Rapport avant de lancer la vraie restauration.

### 4.6 Historique des restaurations
Log de toutes les restaurations effectuees : date, profil, snapshot source, destination, duree, resultat, utilisateur. Audit trail pour la conformite.

---

## Categorie 5 — Cross-Region et replication

### 5.1 Replication vers un site distant
Configuration de destinations secondaires pour chaque profil. Replication asynchrone apres le backup primaire. Destinations supportees : autre instance SignApps, S3 dans une autre region, serveur SFTP distant, Azure Blob.

### 5.2 Strategie cross-region
Definition de strategies : "repliquer tous les backups", "repliquer uniquement les full hebdomadaires", "repliquer avec un delai de 24h" (protection contre la suppression accidentelle repliquee).

### 5.3 Synchronisation bidirectionnelle
Pour les deploiements multi-sites : synchronisation des sauvegardes entre deux sites. Chaque site sauvegarde ses donnees locales et replique vers l'autre. En cas de sinistre, restauration depuis le site survivant.

### 5.4 Bandwidth management
Limitation de bande passante pour la replication : debit max (Mo/s), heures creuses preferees (nuit/week-end), priorite par profil. Indicateur de progression et ETA.

### 5.5 Statut de replication
Tableau de bord : snapshots repliques vs en attente, latence de replication, derniere synchronisation reussie, ecart entre primaire et replique. Alerte si ecart > seuil.

---

## Categorie 6 — Incremental et deduplication

### 6.1 Deduplication par contenu
Chunking base sur le contenu (content-defined chunking, CDC) : chaque fichier est decoupe en blocs de taille variable, chaque bloc est identifie par son hash SHA-256. Les blocs identiques ne sont stockes qu'une seule fois, meme entre profils differents.

### 6.2 Compression des blocs
Chaque bloc est compresse avant stockage : zstd (par defaut, bon ratio/vitesse), lz4 (rapide, compression moderee), zlib (compatible, compression elevee). Choix par profil.

### 6.3 Chiffrement des blocs
Chaque bloc est chiffre individuellement (AES-256-GCM) avec une cle derivee de la master key du profil. La cle master est protegee par mot de passe ou par le vault SignApps. Perte de la cle = perte des donnees.

### 6.4 Ratio de deduplication
Affichage du ratio par profil et global : taille logique (donnees sources) vs taille physique (donnees stockees). Ex: 500 Go logique, 120 Go physique = ratio 4.2x. Graphique d'evolution du ratio dans le temps.

### 6.5 Garbage collection
Nettoyage periodique des blocs orphelins (plus references par aucun snapshot). Execution planifiee ou manuelle. Mode dry-run pour voir ce qui serait supprime. Protection : ne jamais supprimer pendant un backup en cours.

### 6.6 Cache de deduplication
Index des hashes en memoire pour accelerer la deduplication. Taille configurable. Invalidation automatique apres garbage collection. Statistiques de hit/miss.

---

## Categorie 7 — Securite et conformite

### 7.1 Chiffrement en transit
Toutes les communications de backup utilisent TLS 1.3. Verification du certificat du serveur distant. Pas de fallback vers des versions TLS obsoletes.

### 7.2 Immutabilite des snapshots
Les snapshots valides sont marques comme immutables pendant la duree de retention. Aucune suppression possible (meme par l'admin) avant expiration. Protection contre le ransomware et la suppression accidentelle.

### 7.3 Rotation des cles
Rotation periodique des cles de chiffrement (annuelle par defaut). Les anciens snapshots restent dechiffrables avec l'ancienne cle (stockee dans le vault). Nouvelle cle pour les nouveaux snapshots.

### 7.4 Audit des acces
Log de tous les acces aux sauvegardes : qui a cree, consulte, restaure, supprime un snapshot. Horodatage et IP source. Export pour conformite (RGPD, SOC2, ISO 27001).

### 7.5 RBAC (Role-Based Access Control)
Roles : `backup-admin` (tout), `backup-operator` (executer, restaurer), `backup-viewer` (consulter). Attribution par profil ou globale. Integration avec signapps-identity (RBAC existant).

### 7.6 Retention legale (legal hold)
Marquer un snapshot sous retention legale : aucune suppression ni modification possible, meme apres expiration de la retention normale. Levee uniquement par un admin designe.

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

- Creation d'un profil de sauvegarde pour un conteneur Docker
- Creation d'un profil pour une base PostgreSQL
- Execution manuelle d'un backup et verification du statut OK
- Verification automatique d'integrite apres backup (checksums)
- Planification d'un backup recurrent (cron) et verification de l'execution
- Restauration complete depuis un snapshot vers l'emplacement original
- Restauration granulaire d'un fichier specifique depuis un snapshot
- PITR PostgreSQL a un timestamp exact
- Dashboard affiche correctement les statuts (OK/Warning/Error)
- Alerte envoyee sur echec de backup
- Replication cross-region vers un stockage S3 distant
- Deduplication effective (ratio > 1x sur des donnees similaires)
- Immutabilite : impossible de supprimer un snapshot avant expiration
- Test de restauration automatique (SureBackup) avec rapport
- Politique de retention respectee (suppression des snapshots expires)
- Dry-run de restauration sans ecriture effective
- Metriques Prometheus exportees correctement
- RBAC : un backup-viewer ne peut pas restaurer
