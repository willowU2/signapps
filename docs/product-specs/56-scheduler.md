# Module Planificateur CRON (Scheduler) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Rundeck** | Orchestration de jobs multi-noeuds, interface web (creation/edition/execution), workflows multi-step avec conditions (on-success, on-failure, on-error), scheduling cron, gestion de credentials (key storage), RBAC granulaire, log streaming en temps reel, webhooks, API REST, plugins (notification, execution, node source), retry policies, job dependencies |
| **Apache Airflow** | DAGs Python (workflows as code), scheduling cron avance, TaskFlow API, XCom (communication inter-taches), backfill (execution retroactive), SLA monitoring, pool de workers, variables/connections, UI riche (graph view, gantt, tree, grid), operateurs extensibles (HTTP, SQL, Bash, Docker, Kubernetes), plugins, REST API |
| **Temporal** | Workflows durables et fault-tolerant, execution garantie (exactly-once), retries automatiques avec backoff, timeouts configurables, workflows longs (jours/mois), versioning de workflows, signal/query, child workflows, saga pattern, multi-langage (Go, Java, TypeScript, Python, .NET), visibility API, search attributes |
| **Ofelia** (Docker cron) | Scheduler cron leger specialise Docker, execution de commandes dans des conteneurs existants ou lancement de conteneurs ephemeres, labels Docker pour la configuration, logging, healthcheck jobs, mail notifications, zero configuration (annotation-driven) |
| **crontab.guru** | Editeur visuel de syntaxe cron avec explication en langage naturel ("At 04:05 on Sunday"), preview des 5 prochaines executions, validation instantanee de l'expression, bookmarks, exemples pre-definis, API. Pattern d'UX pour l'edition de planification. |
| **Jenkins** (scheduling) | Job scheduling via cron syntax, pipelines multi-step (Declarative/Scripted), build triggers (SCM, cron, upstream), parametrized builds, distributed builds (agents), credentials management, blue ocean UI, plugins (2000+), pipeline as code (Jenkinsfile), email/Slack notifications |
| **pgAgent** | Job scheduler integre a PostgreSQL, steps SQL et batch, schedules cron, exceptions (dates exclues), logging dans des tables PostgreSQL, gestion via pgAdmin, multi-database, retry policies, depends-on entre jobs |
| **Chronos** | Scheduler distribue (Mesos), jobs containerises, dependencies entre jobs (DAG), ISO 8601 scheduling (interval/repeating), retry policies, REST API, historique d'executions, epsilon (delai de tolerance), asynchronous execution, multi-cluster |

## Principes directeurs

1. **Simplicite d'usage** — creer une tache planifiee doit etre aussi simple que remplir un formulaire : nom, expression cron (avec aide visuelle), cible (URL, commande, evenement), et c'est parti. Pas besoin de YAML, de DAG Python ou de pipeline as code pour les cas simples.
2. **Fiabilite garantie** — chaque execution est tracee dans PostgreSQL avec son statut (succes/echec/timeout), sa duree, ses logs. Si une execution echoue, le systeme retente selon la politique configuree (retry count + backoff). Aucune execution ne doit etre perdue silencieusement.
3. **Observabilite complete** — le dashboard affiche en temps reel les taches actives, les executions en cours, les echecs recents. Les KPIs (total, actives, reussies, en cours) donnent une vue d'ensemble instantanee. Les logs de chaque execution sont consultables en detail.
4. **Integration native** — le scheduler est un composant central de SignApps. Il peut declencher des endpoints HTTP internes (health checks, purges, synchronisations), executer des requetes SQL, emettre des evenements sur PgEventBus, ou appeler des services externes via webhook.
5. **Securite et controle** — seuls les administrateurs peuvent creer, modifier ou supprimer des taches. Chaque action est auditee. Les taches ne peuvent pas acceder a des ressources non autorisees. Les credentials (tokens, mots de passe) sont stockees dans le vault, pas dans la configuration de la tache.
6. **Resilience au redemarrage** — si le service scheduler redemarre, toutes les taches planifiees sont rechargees depuis PostgreSQL et reprennent leur planification. Les executions manquees pendant le downtime peuvent etre rattrapees (catch-up configurable par tache).

---

## Categorie 1 — Dashboard principal

### 1.1 En-tete et titre
Route `/scheduler`. Titre "Planificateur" affiche en haut de la page. Sous-titre optionnel decrivant le role : "Gerez et automatisez les taches planifiees de votre plateforme".

### 1.2 Cartes KPI
Quatre cartes KPI alignees horizontalement en haut du dashboard :
- **Total Taches** : nombre total de taches enregistrees (actives + inactives). Icone calendrier. Couleur neutre (bleu/gris).
- **Taches Actives** : nombre de taches dont le statut est "actif" (scheduling en cours). Icone play. Couleur verte.
- **Executions Reussies** : nombre d'executions terminees avec succes sur les dernieres 24h (ou la periode selectionnee). Icone check. Couleur verte.
- **En Cours** : nombre d'executions actuellement en train de s'executer. Icone spinner/horloge. Couleur orange si > 0, grise sinon.

Chaque KPI affiche un delta par rapport a la periode precedente (ex: "+3 depuis hier").

### 1.3 Boutons d'action
Barre d'actions au-dessus du tableau :
- **Nouvelle Tache** : ouvre le formulaire de creation (voir categorie 2)
- **Actualiser** : force le rechargement de la liste et des KPIs
- **Exporter** : export CSV de la liste des taches avec leur configuration et statistiques
- **Filtre** (optionnel) : dropdown pour filtrer par statut (tous, actifs, inactifs, en erreur)

### 1.4 Etat vide
Si aucune tache n'est configuree, affichage centre :
- Icone calendrier/horloge
- Texte : "Aucune tache planifiee"
- Sous-texte : "Creez votre premiere tache pour automatiser vos operations"
- Bouton primaire "Nouvelle Tache"

---

## Categorie 2 — Tableau des taches

### 2.1 Colonnes du tableau
Le tableau principal liste les taches planifiees avec les colonnes :
- **Etat** : pastille coloree (vert = actif, gris = inactif, rouge = en erreur, orange = en cours d'execution)
- **Nom** : identifiant lisible de la tache (cliquable → detail)
- **Planification** : expression cron affichee en format lisible (ex: "Toutes les 5 min", "Chaque jour a 3h00", "Lundi a 9h00"). L'expression cron brute est affichee au survol (tooltip).
- **Cible** : type et destination de l'execution (ex: "HTTP POST /api/v1/cleanup", "SQL query", "PgEventBus: maintenance.daily", "Webhook: https://...")
- **Derniere Execution** : horodatage de la derniere execution (ex: "il y a 3 min", "2026-04-09 14:30")
- **Dernier Statut** : badge colore du resultat de la derniere execution (Succes vert, Echec rouge, Timeout orange, En cours bleu)
- **Actions** : boutons (Executer maintenant, Modifier, Activer/Desactiver, Supprimer)

### 2.2 Tri et filtre
Clic sur l'en-tete de colonne pour trier par nom (A-Z), planification (frequence), derniere execution (plus recent), dernier statut. Filtre par statut (dropdown dans l'en-tete de colonne "Etat"). Recherche textuelle par nom de tache.

### 2.3 Pagination
Si le nombre de taches depasse 20 (configurable), pagination en bas du tableau. Navigation : premiere page, precedente, numero de page, suivante, derniere page. Selecteur de taches par page : 10, 20, 50, 100.

### 2.4 Selection multiple
Checkboxes pour selection multiple. Actions en masse :
- **Activer la selection** : active toutes les taches selectionnees
- **Desactiver la selection** : desactive toutes les taches selectionnees
- **Supprimer la selection** : supprime avec confirmation

### 2.5 Indicateur visuel d'execution imminente
Si une tache est prevue pour s'executer dans les 60 prochaines secondes, un indicateur subtil (pulsation, icone horloge) apparait pour prevenir l'administrateur. Utile pour le debug et le monitoring visuel.

---

## Categorie 3 — Creation et edition de taches

### 3.1 Formulaire de creation
Bouton "Nouvelle Tache" ouvre un formulaire (modale ou page dediee) :
- **Nom** : identifiant unique de la tache (ex: "cleanup-expired-sessions", "daily-backup-report"). Caracteres alphanumeriques, tirets, underscores. Validation : pas de doublon.
- **Description** (optionnel) : texte libre expliquant ce que fait la tache et pourquoi.
- **Planification** : expression cron avec aide visuelle (voir 3.2).
- **Type de cible** : dropdown (HTTP, SQL, PgEventBus, Webhook, Commande systeme).
- **Configuration de cible** : champs dynamiques selon le type (voir 3.3).
- **Politique de retry** : nombre de retentatives (defaut 0), delai entre retentatives (defaut 60s), backoff exponentiel (oui/non).
- **Timeout** : duree max d'execution (defaut 300s, max 3600s).
- **Statut initial** : actif ou inactif (defaut actif).
- **Tags** (optionnel) : labels pour organiser les taches (ex: "maintenance", "reporting", "sync").
- **Catch-up** : si le scheduler etait down pendant une execution prevue, rattraper a la reprise (oui/non, defaut non).

### 3.2 Editeur d'expression cron
L'editeur d'expression cron combine deux modes :
- **Mode visuel** : selecteurs pour minutes, heures, jour du mois, mois, jour de la semaine. Presets rapides : "Toutes les minutes", "Toutes les 5 minutes", "Toutes les heures", "Chaque jour a minuit", "Chaque lundi a 9h", "Le 1er du mois a 3h".
- **Mode expert** : saisie libre de l'expression cron a 5 champs (min hour dom month dow). Validation en temps reel avec message d'erreur si syntaxe invalide.
- **Preview** : en dessous de l'editeur, affichage des 5 prochaines executions calculees (ex: "2026-04-09 15:00, 2026-04-09 15:05, 2026-04-09 15:10, ..."). Explication en langage naturel (ex: "S'execute toutes les 5 minutes").
- **Support etendu** : secondes optionnelles (6 champs), expressions `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, intervalles `*/5`, plages `1-5`, listes `1,15`.

### 3.3 Types de cibles

**HTTP** :
- Methode : GET, POST, PUT, DELETE
- URL : endpoint interne (ex: `/api/v1/sessions/cleanup`) ou externe (ex: `https://api.example.com/hook`)
- Headers : tableau cle/valeur (optionnel)
- Body : JSON (optionnel, pour POST/PUT)
- Auth : None, Bearer token (reference vault), Basic Auth (reference vault)
- Code de succes attendu : liste de codes HTTP (defaut 200-299)

**SQL** :
- Requete SQL a executer sur la base PostgreSQL
- Base de donnees cible (defaut : signapps)
- Mode : execute (pas de resultat), query (resultat stocke dans les logs)
- Danger : les requetes destructives (DROP, TRUNCATE, DELETE sans WHERE) sont bloquees sauf si explicitement autorisees

**PgEventBus** :
- Nom de l'evenement a emettre (ex: `maintenance.daily`, `sync.calendar`, `cleanup.storage`)
- Payload JSON (optionnel)
- Le service cible recoit l'evenement et le traite

**Webhook** :
- URL du webhook externe
- Methode (POST par defaut)
- Payload JSON (template avec variables : `{{task_name}}`, `{{execution_time}}`, `{{task_id}}`)
- Headers personnalises
- Secret HMAC pour la signature du payload (optionnel)

**Commande systeme** (restreint aux admins avec privilege eleve) :
- Commande shell a executer
- Repertoire de travail
- Variables d'environnement
- Timeout specifique
- ATTENTION : cette cible est desactivee par defaut pour des raisons de securite. Activation via configuration serveur.

### 3.4 Edition d'une tache existante
Meme formulaire que la creation, pre-rempli avec les valeurs actuelles. L'edition ne modifie pas l'historique des executions. Si la planification change, la prochaine execution est recalculee immediatement. Un avertissement s'affiche si la tache est actuellement en cours d'execution.

### 3.5 Duplication de tache
Action "Dupliquer" sur une tache existante : cree une copie avec toutes les memes configurations mais un nom suffixe "-copy". L'utilisateur peut modifier avant de sauvegarder. Utile pour creer des variantes d'une tache.

---

## Categorie 4 — Execution et monitoring

### 4.1 Execution manuelle
Bouton "Executer maintenant" sur chaque tache dans le tableau. Declenche une execution immediate independamment de la planification cron. L'execution manuelle est tracee avec la mention "manual" dans le type de declenchement. Confirmation requise avant execution.

### 4.2 Historique des executions
Clic sur le nom d'une tache → page de detail avec un onglet "Historique des executions". Tableau :
- **ID d'execution** : identifiant unique (UUID court)
- **Declenchement** : "schedule" (cron) ou "manual" (execution manuelle)
- **Debut** : horodatage de debut d'execution
- **Duree** : temps d'execution (ex: "1.2s", "45s", "2m 30s")
- **Statut** : Succes (vert), Echec (rouge), Timeout (orange), En cours (bleu spinner), Annule (gris)
- **Tentative** : numero de tentative si retry (ex: "1/3", "2/3")
- **Details** : bouton pour voir les logs de l'execution

Pagination, filtres par statut et par periode.

### 4.3 Logs d'execution
Chaque execution stocke ses logs :
- **HTTP** : request envoyee (method, URL, headers), response recue (status code, body, latence)
- **SQL** : requete executee, nombre de lignes affectees ou resultat (tronque si volumineux)
- **PgEventBus** : evenement emis, confirmation de delivery
- **Webhook** : request envoyee, response recue
- **Commande** : stdout et stderr captures

Les logs sont affiches dans un panneau avec coloration syntaxique (JSON, SQL). Taille max des logs : 1 Mo par execution (tronque au-dela avec lien de telechargement).

### 4.4 Annulation d'execution
Si une execution est en cours (statut "En cours"), un bouton "Annuler" permet de l'interrompre. Pour les cibles HTTP/Webhook, la requete est abandonnee (timeout force). Pour les commandes systeme, un signal SIGTERM est envoye au processus. L'execution passe en statut "Annule".

### 4.5 Statistiques par tache
Onglet "Statistiques" dans le detail d'une tache :
- **Taux de succes** : pourcentage d'executions reussies sur la periode (24h, 7j, 30j)
- **Duree moyenne** : temps moyen d'execution
- **Duree p95** : 95e percentile de la duree d'execution
- **Executions par jour** : graphique en barres montrant le nombre d'executions quotidiennes
- **Distribution des statuts** : camembert (succes, echec, timeout, annule)
- **Tendance** : evolution du taux de succes dans le temps

### 4.6 Execution en cours (live)
Quand une tache est en cours d'execution, le tableau principal affiche un spinner dans la colonne "Dernier Statut". Le detail de la tache montre un bandeau "Execution en cours depuis Xs" avec un bouton "Annuler". Si le type de cible le permet, les logs s'affichent en streaming (tail -f). Un compteur de duree s'incremente en temps reel.

---

## Categorie 5 — Alertes et notifications

### 5.1 Alerte sur echec
Lorsqu'une execution echoue (code HTTP non attendu, erreur SQL, timeout, process exit non-zero), le systeme :
- Marque l'execution comme "Echec" dans l'historique
- Si la politique de retry est configuree, lance une nouvelle tentative apres le delai
- Si toutes les tentatives echouent, emet une notification aux administrateurs

### 5.2 Canaux de notification
Les notifications d'echec sont envoyees via :
- Notification in-app (toujours, badge sur l'icone Scheduler dans la sidebar)
- Email aux administrateurs (configurable par tache)
- Webhook (Slack, Teams, Discord — configurable par tache)
- PgEventBus : evenement `scheduler.task.failed` pour integration avec signapps-notifications

### 5.3 Notification de succes (optionnel)
Par defaut, les executions reussies ne declenchent pas de notification (trop bruyant). Option par tache : "Notifier aussi en cas de succes". Utile pour les taches critiques ou les taches peu frequentes (ex: backup mensuel).

### 5.4 Alerte de retard
Si une tache n'a pas ete executee depuis plus longtemps que prevu (2x l'intervalle cron), une alerte "Execution en retard" est emise. Utile pour detecter les taches bloquees ou le scheduler en panne.

### 5.5 Resume quotidien
Email quotidien optionnel (configurable) envoye aux administrateurs :
- Nombre d'executions dans les dernieres 24h
- Nombre de succes, d'echecs, de timeouts
- Liste des taches en echec avec le dernier message d'erreur
- Taches inactives depuis plus de 7 jours (potentiellement oubliees)

---

## Categorie 6 — Taches systeme SignApps

### 6.1 Taches pre-configurees
Le scheduler est livre avec des taches systeme pre-configurees (non-supprimables, modifiables uniquement pour la planification) :

| Tache | Planification defaut | Cible | Description |
|---|---|---|---|
| `health-check-all` | `*/10 * * * * *` (10s) | HTTP GET /health sur chaque service | Verification de sante des services (alimente la status page) |
| `cleanup-expired-sessions` | `0 */6 * * *` (toutes les 6h) | SQL DELETE sur sessions expirees | Nettoyage des sessions JWT expirees |
| `cleanup-health-checks` | `0 3 * * *` (3h quotidien) | SQL DELETE health_checks > 90j | Purge des metriques anciennes |
| `cleanup-temp-files` | `0 4 * * *` (4h quotidien) | HTTP POST /api/v1/storage/cleanup | Nettoyage des fichiers temporaires |
| `backup-database` | `0 2 * * *` (2h quotidien) | Commande pg_dump | Sauvegarde PostgreSQL quotidienne |
| `sync-calendar-external` | `*/15 * * * *` (15 min) | PgEventBus: calendar.sync.external | Synchronisation calendriers externes (CalDAV) |
| `email-fetch-all` | `*/5 * * * *` (5 min) | PgEventBus: mail.fetch.all | Recuperation des nouveaux emails IMAP |
| `ai-model-cache-cleanup` | `0 5 * * 0` (dim 5h) | HTTP POST /api/v1/ai/cache/cleanup | Nettoyage du cache des modeles IA |
| `metrics-aggregate` | `0 * * * *` (toutes les heures) | SQL sur metrics tables | Agregation des metriques par minute → heure |
| `certificate-renewal-check` | `0 8 * * *` (8h quotidien) | HTTP GET /api/v1/proxy/certificates | Verification expiration des certificats TLS |

### 6.2 Badge systeme
Les taches systeme sont marquees avec un badge "Systeme" (bleu) dans le tableau pour les distinguer des taches utilisateur. Elles ne peuvent pas etre supprimees, uniquement desactivees (avec avertissement : "Desactiver cette tache peut impacter le fonctionnement de la plateforme").

### 6.3 Taches utilisateur
Les administrateurs peuvent creer des taches personnalisees pour leurs besoins specifiques :
- Appels webhook vers des services tiers (API de CRM, ERP, etc.)
- Requetes SQL de reporting (export quotidien de statistiques)
- Evenements PgEventBus pour orchestrer des workflows internes
- Commandes systeme pour des scripts de maintenance personnalises

---

## Categorie 7 — Configuration et administration

### 7.1 Parametres globaux du scheduler
Page `/admin/scheduler/settings` :
- **Intervalle de tick** : frequence a laquelle le scheduler verifie les taches a executer (defaut 1s, min 1s, max 60s)
- **Workers paralleles** : nombre max d'executions simultanees (defaut 10, ajustable selon les ressources)
- **Timeout global** : timeout par defaut pour les executions (defaut 300s)
- **Retention des logs** : duree de conservation des logs d'execution (defaut 30 jours)
- **Retention de l'historique** : duree de conservation de l'historique d'execution (defaut 90 jours)
- **Catch-up global** : politique par defaut pour les executions manquees (defaut non)
- **Fuseau horaire** : timezone reference pour les expressions cron (defaut UTC, configurable)

### 7.2 Pool de workers
Le scheduler utilise un pool de workers async (tokio tasks) pour executer les taches en parallele. Chaque execution occupe un worker. Si tous les workers sont occupes, les executions sont mises en file d'attente FIFO. Le dashboard affiche l'occupation du pool (ex: "7/10 workers actifs").

### 7.3 RBAC
Les permissions du scheduler sont integrees au RBAC SignApps :
- `scheduler.view` : voir le dashboard et l'historique (operateurs, administrateurs)
- `scheduler.create` : creer des taches (administrateurs uniquement)
- `scheduler.edit` : modifier les taches (administrateurs uniquement)
- `scheduler.delete` : supprimer des taches (administrateurs uniquement)
- `scheduler.execute` : executer manuellement (administrateurs uniquement)
- `scheduler.admin` : modifier les parametres globaux, gerer les taches systeme (super-admin)

### 7.4 Audit trail
Toutes les actions sur le scheduler sont enregistrees dans le journal d'audit :
- Creation, modification, suppression d'une tache (qui, quand, quoi)
- Execution manuelle (qui a declenche)
- Activation/desactivation (qui)
- Modification des parametres globaux (qui, quelles valeurs)

Le journal est consultable depuis `/admin/audit` avec filtre "Scheduler".

### 7.5 Import/Export
- **Export** : export de la configuration des taches en JSON ou YAML. Utile pour la sauvegarde ou la replication vers un autre environnement.
- **Import** : import d'un fichier de configuration JSON/YAML. Validation avant import : detection des conflits de noms, verification des cibles. Mode "dry-run" pour previsualiser les changements sans les appliquer.

---

## Categorie 8 — Architecture backend

### 8.1 Service signapps-scheduler
Le scheduler tourne comme un service independant sur le port 3007. Il est responsable de :
- Charger les taches depuis PostgreSQL au demarrage
- Evaluer les expressions cron a chaque tick (1s)
- Lancer les executions dans le pool de workers
- Enregistrer les resultats dans PostgreSQL
- Exposer l'API REST pour le CRUD des taches et la consultation de l'historique
- Emettre les evenements sur PgEventBus (succes, echec, retard)

### 8.2 Modele de donnees
Tables principales :
- `scheduled_tasks` : id (UUID), name (UNIQUE), description, cron_expression, target_type (ENUM: http, sql, pgeventbus, webhook, command), target_config (JSONB), retry_count (INT, defaut 0), retry_delay_seconds (INT, defaut 60), retry_backoff (BOOL), timeout_seconds (INT, defaut 300), status (ENUM: active, inactive, error), is_system (BOOL), catch_up (BOOL), tags (TEXT[]), created_by (UUID FK), created_at, updated_at
- `task_executions` : id (UUID), task_id (FK), trigger_type (ENUM: schedule, manual, catch_up), started_at (TIMESTAMPTZ), completed_at (TIMESTAMPTZ NULL), duration_ms (INT NULL), status (ENUM: running, success, failure, timeout, cancelled), attempt_number (INT), error_message (TEXT NULL), logs (TEXT), created_by (UUID NULL — pour les executions manuelles)
- Index sur `(task_id, started_at)` pour l'historique rapide
- Index sur `(status)` pour les KPIs
- Retention : purge automatique via la tache systeme `cleanup-task-executions`

### 8.3 Moteur cron
Le moteur cron utilise la crate `cron` (MIT) pour parser les expressions cron et calculer les prochaines executions. A chaque tick (1s), le moteur :
1. Charge les taches actives dont la prochaine execution est passee ou immediate
2. Pour chaque tache eligible, verifie qu'elle n'est pas deja en cours d'execution (sauf si l'execution parallele est autorisee)
3. Spawn une tokio task dans le pool de workers
4. Met a jour la prochaine execution dans la base

Le moteur est resilient aux retards : si un tick est manque (charge CPU), les taches en retard sont executees au tick suivant. Le flag catch-up determine si les executions manquees pendant un downtime sont rattrapees.

### 8.4 Execution HTTP
Pour les cibles HTTP, le worker utilise `reqwest` (MIT/Apache-2.0) :
1. Construit la requete (method, URL, headers, body)
2. Resout les references vault pour les credentials (Bearer token, Basic Auth)
3. Execute la requete avec le timeout configure
4. Verifie le code de reponse (200-299 par defaut, configurable)
5. Stocke la requete envoyee et la reponse recue dans les logs

### 8.5 Execution SQL
Pour les cibles SQL, le worker utilise la connexion `sqlx::PgPool` du service :
1. Parse la requete SQL
2. Verifie les guardrails (pas de DROP/TRUNCATE/DELETE sans WHERE sauf si force)
3. Execute dans une transaction
4. Stocke le nombre de lignes affectees ou le resultat (tronque a 10 000 lignes)
5. En cas d'erreur SQL, la transaction est rollback

### 8.6 Execution PgEventBus
Pour les cibles PgEventBus :
1. Construit l'evenement avec le nom et le payload configure
2. Publie sur le bus via `NOTIFY` PostgreSQL
3. Confirme la publication dans les logs
4. Le service cible consomme l'evenement de maniere asynchrone

### 8.7 Health check du scheduler
Le service expose `/health` avec des metriques specifiques :
- `scheduler_tasks_total` : nombre total de taches
- `scheduler_tasks_active` : nombre de taches actives
- `scheduler_executions_running` : nombre d'executions en cours
- `scheduler_workers_busy` : nombre de workers occupes / total
- `scheduler_last_tick_at` : timestamp du dernier tick (pour detecter un freeze)

### 8.8 Haute disponibilite
En mode multi-instance (si deploye sur plusieurs noeuds), le scheduler utilise un lock distribue PostgreSQL (`pg_advisory_lock`) pour garantir qu'une seule instance execute les taches a un instant donne. Si l'instance active tombe, une autre prend le relais en quelques secondes. Le lock est renouvele toutes les 5 secondes.

---

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **cron** (github.com/zslayton/cron) | **MIT/Apache-2.0** | Crate Rust pour parser les expressions cron et calculer les prochaines executions. Utilisation directe dans le moteur. |
| **tokio-cron-scheduler** (github.com/mvniekerk/tokio-cron-scheduler) | **MIT/Apache-2.0** | Scheduler cron async Rust base sur tokio. Pattern pour l'integration cron + tokio, job management, timezone support. |
| **Ofelia** (github.com/mcuadros/ofelia) | **MIT** | Scheduler cron Docker leger. Pattern pour la configuration declarative et l'execution dans des conteneurs. |
| **Rundeck** (github.com/rundeck/rundeck) | **Apache-2.0** | Orchestration de jobs enterprise. Pattern pour le workflow multi-step, retry policies, RBAC, log streaming. |
| **reqwest** (github.com/seanmonstar/reqwest) | **MIT/Apache-2.0** | Client HTTP Rust async. Pour les cibles HTTP et webhook. Deja dans l'ecosysteme. |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT/Apache-2.0** | Client PostgreSQL Rust async. Deja utilise. Pour l'execution des cibles SQL et le stockage des resultats. |
| **croner** (github.com/hexagon/croner) | **MIT** | Parser d'expressions cron JavaScript avec support etendu (secondes, L, W, #). Pattern pour l'editeur visuel cron cote frontend. |
| **crontab.guru** | N/A (service web) | Pattern d'UX pour l'editeur d'expressions cron : preview, explication en langage naturel, validation temps reel. |
| **react-cron-generator** (github.com/nickmango/react-cron-generator) | **MIT** | Composant React d'editeur cron visuel. Pattern pour le mode visuel de l'editeur de planification. |
| **Recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React. Pour les graphiques de statistiques d'execution et les KPIs. |
| **Temporal** (github.com/temporalio/temporal) | **MIT** | Workflow engine durable. Pattern pour les retries, timeouts, saga pattern. Architecture de reference pour les executions garanties. |

---

## Assertions E2E cles (a tester)

- La page `/scheduler` affiche le titre "Planificateur"
- Les 4 KPIs (Total Taches, Taches Actives, Executions Reussies, En Cours) affichent des valeurs coherentes
- L'etat vide affiche "Aucune tache planifiee" et le bouton "Nouvelle Tache"
- Le tableau des taches affiche les colonnes Etat, Nom, Planification, Cible, Derniere Execution, Dernier Statut
- Le bouton "Nouvelle Tache" ouvre le formulaire de creation
- Le formulaire de creation valide le nom (unicite, caracteres autorises)
- L'editeur cron en mode visuel genere une expression cron valide
- L'editeur cron en mode expert valide la syntaxe en temps reel
- Le preview affiche les 5 prochaines executions correctement calculees
- La creation d'une tache HTTP avec une URL valide l'enregistre et l'active
- La creation d'une tache SQL avec une requete SELECT l'enregistre correctement
- La creation d'une tache PgEventBus avec un nom d'evenement l'enregistre correctement
- Le bouton "Executer maintenant" declenche une execution immediate
- L'execution manuelle est tracee avec trigger_type = "manual" dans l'historique
- L'historique des executions affiche les colonnes ID, Declenchement, Debut, Duree, Statut
- Les logs d'une execution HTTP affichent la requete envoyee et la reponse recue
- Une execution en echec affiche le statut rouge et le message d'erreur
- La politique de retry relance l'execution apres le delai configure
- Le timeout interrompt une execution qui depasse la duree configuree
- Le bouton "Annuler" interrompt une execution en cours
- L'activation/desactivation d'une tache change son etat dans le tableau
- La suppression d'une tache avec confirmation la retire du tableau
- Les taches systeme affichent le badge "Systeme" et ne sont pas supprimables
- Le bouton "Actualiser" recharge les KPIs et le tableau
- Le bouton "Exporter" telecharge un CSV avec la liste des taches
- L'import JSON/YAML cree les taches configurees sans doublon
- Le filtre par statut (actif, inactif, en erreur) restreint la liste
- La recherche par nom trouve la tache correspondante
- Les statistiques par tache affichent le taux de succes et la duree moyenne
- Le RBAC interdit la creation de taches aux utilisateurs non-administrateurs
- L'audit trail enregistre la creation, modification et suppression de taches
- Le scheduler reprend ses taches apres un redemarrage du service
- Le lock distribue empeche les executions en double en mode multi-instance
