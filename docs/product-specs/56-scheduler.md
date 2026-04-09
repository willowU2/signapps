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
Route `/scheduler`. Titre "Planificateur" affiche en haut de la page en `text-2xl font-bold`. Sous-titre "Gerez et automatisez les taches planifiees de votre plateforme" en `text-muted-foreground`. L'acces est restreint aux utilisateurs avec la permission `scheduler.view` (role operateur ou administrateur). Les utilisateurs sans permission sont rediriges vers `/` avec un toast "Acces interdit".

### 1.2 Cartes KPI
Quatre cartes KPI alignees horizontalement en haut du dashboard, utilisant le composant shadcn/ui `Card` :
- **Total Taches** : nombre total de taches enregistrees (actives + inactives). Icone `Calendar` (Lucide). Fond `bg-card`. Valeur en `text-3xl font-bold`. Sous-valeur : "+{N} ce mois" en `text-muted-foreground text-sm`.
- **Taches Actives** : nombre de taches dont le statut est "actif" (scheduling en cours). Icone `Play` (Lucide). Pastille verte a cote du nombre. Sous-valeur : "{N}% du total".
- **Executions Reussies** : nombre d'executions terminees avec succes sur les dernieres 24h. Icone `CheckCircle` (Lucide). Couleur verte. Sous-valeur : "sur {total} executions (taux: {pct}%)". Le taux est colore : vert >= 95%, orange 80-95%, rouge < 80%.
- **En Cours** : nombre d'executions actuellement en train de s'executer. Icone `Loader2` avec `animate-spin` si > 0. Couleur orange si > 0, grise sinon. Sous-valeur : "{N}/{max} workers occupes".

Chaque KPI est rafraichi toutes les 10 secondes par polling `GET /api/v1/scheduler/stats`. Les deltas par rapport a la veille sont affiches si disponibles (ex: "+3 depuis hier" en vert ou "-2 depuis hier" en rouge).

### 1.3 Boutons d'action
Barre d'actions au-dessus du tableau, alignee a droite :
- **Nouvelle Tache** (bouton primaire, icone `Plus`) : ouvre le formulaire de creation (voir categorie 3). Visible uniquement si permission `scheduler.create`.
- **Actualiser** (bouton outline, icone `RefreshCw`) : force le rechargement de la liste et des KPIs. Affiche un spinner pendant le chargement.
- **Exporter** (bouton outline, icone `Download`) : telecharge un CSV de la liste des taches avec colonnes : nom, description, cron_expression, type_cible, statut, derniere_execution, dernier_statut, taux_succes_30j.
- **Filtre** (dropdown outline, icone `Filter`) : filtrer par statut — Tous (defaut), Actifs, Inactifs, En erreur, Systeme. Le filtre selectionne est affiche en chip sous la barre d'actions.

### 1.4 Etat vide
Si aucune tache n'est configuree (premiere utilisation ou tout supprime), affichage centre :
- Icone `Clock` grande (48px) en `text-muted-foreground`
- Texte : "Aucune tache planifiee" en `text-lg font-medium`
- Sous-texte : "Creez votre premiere tache pour automatiser vos operations" en `text-muted-foreground`
- Bouton primaire "Nouvelle Tache" (visible si permission `scheduler.create`)

Note : cet etat ne s'affiche jamais en pratique car les taches systeme sont pre-configurees (voir categorie 6).

---

## Categorie 2 — Tableau des taches

### 2.1 Colonnes du tableau
Le tableau principal liste les taches planifiees avec les colonnes :
- **Etat** (largeur 40px) : pastille coloree 10px — vert `bg-green-500` (actif), gris `bg-muted` (inactif), rouge `bg-red-500` (en erreur — dernieres 3 executions echouees), orange `bg-amber-500` (en cours d'execution, avec `animate-pulse`)
- **Nom** (largeur flexible) : identifiant lisible de la tache, cliquable (lien vers la page de detail `/scheduler/{id}`). Les taches systeme ont un badge "Systeme" (`bg-blue-100 text-blue-800 text-xs`) a cote du nom. Les taches avec tags affichent les tags en chips `text-xs` sous le nom.
- **Planification** : expression cron affichee en format lisible genere par le backend (ex: "Toutes les 5 min", "Chaque jour a 3h00", "Chaque lundi a 9h00"). L'expression cron brute est affichee au survol dans un tooltip (ex: `*/5 * * * *`). La prochaine execution est affichee en `text-xs text-muted-foreground` sous l'expression : "Prochaine : dans 2min 30s".
- **Cible** : icone + texte court selon le type — `Globe` "HTTP POST /api/v1/cleanup", `Database` "SQL query", `Radio` "PgEventBus: maintenance.daily", `Webhook` "Webhook: https://...", `Terminal` "Commande: pg_dump". Le texte est tronque a 50 caracteres avec tooltip pour le texte complet.
- **Derniere Execution** : horodatage en format relatif si < 24h (ex: "il y a 3 min"), absolu sinon (ex: "2026-04-09 14:30"). Tooltip avec le timestamp complet ISO 8601. "Jamais" en `text-muted-foreground italic` si aucune execution.
- **Dernier Statut** : badge colore — Succes (`bg-green-100 text-green-800`), Echec (`bg-red-100 text-red-800`), Timeout (`bg-amber-100 text-amber-800`), En cours (`bg-blue-100 text-blue-800` avec spinner), Annule (`bg-muted text-muted-foreground`). Tooltip avec le message d'erreur pour les echecs.
- **Actions** (largeur 160px) : menu dropdown (`DropdownMenu` shadcn/ui) avec les actions :
  - `Play` Executer maintenant (permission `scheduler.execute`)
  - `Edit` Modifier (permission `scheduler.edit`)
  - `Copy` Dupliquer (permission `scheduler.create`)
  - `Power` Activer/Desactiver (permission `scheduler.edit`)
  - `Trash` Supprimer (permission `scheduler.delete`, desactive pour les taches systeme)

### 2.2 Tri et filtre
Clic sur l'en-tete de colonne pour trier (icone fleche haut/bas) :
- Nom : alphabetique A-Z / Z-A
- Planification : par prochaine execution (plus imminent en premier)
- Derniere Execution : plus recent / plus ancien
- Dernier Statut : tri par gravite (en cours > echec > timeout > succes > annule)

Barre de recherche textuelle au-dessus du tableau : recherche instantanee (debounced 300ms) sur le nom et la description de la tache. Icone `Search` a gauche, bouton clear (X) a droite.

### 2.3 Pagination
Si le nombre de taches depasse la limite par page (defaut 20), pagination en bas du tableau :
- Navigation : premiere page, precedente, numeros de page (max 5 affiches), suivante, derniere page
- Selecteur de taches par page : dropdown 10, 20, 50, 100
- Texte : "Affichage 1-20 sur 45 taches"
- L'URL est mise a jour avec `?page=2&per_page=20` pour le partage

### 2.4 Selection multiple
Checkboxes dans la premiere colonne pour selection multiple. Checkbox dans le header pour tout selectionner/deselectionner. Quand au moins une tache est selectionnee, une barre d'actions flottante apparait au-dessus du tableau :
- **Activer la selection** (bouton vert) : active toutes les taches selectionnees inactives
- **Desactiver la selection** (bouton orange) : desactive toutes les taches selectionnees actives
- **Supprimer la selection** (bouton rouge) : dialog de confirmation "Supprimer {N} taches ?" avec liste des noms. Les taches systeme sont exclues de la suppression (message d'avertissement).
- Texte : "{N} taches selectionnees"

### 2.5 Indicateur visuel d'execution imminente
Si une tache est prevue pour s'executer dans les 60 prochaines secondes, un indicateur subtil apparait :
- L'icone horloge (`Clock`) pulse doucement (`animate-pulse`) a cote du nom de la tache
- La cellule "Planification" affiche un compte a rebours en `text-xs text-amber-600 font-mono` : "dans 45s", "dans 12s"
- Le compte a rebours est mis a jour chaque seconde cote client (`setInterval(1000)`)

Utile pour le debug et le monitoring visuel en temps reel.

---

## Categorie 3 — Creation et edition de taches

### 3.1 Formulaire de creation
Bouton "Nouvelle Tache" ouvre un dialog (shadcn/ui `Dialog`, largeur 640px) avec un formulaire multi-sections :

**Section 1 — Identite :**
- **Nom** (requis) : input texte, caracteres alphanumeriques, tirets, underscores (regex `^[a-zA-Z0-9_-]+$`). Max 100 caracteres. Validation unicite en temps reel (debounced 500ms, appel `GET /api/v1/scheduler/tasks/check-name?name={name}`). Message d'erreur si doublon : "Ce nom est deja utilise".
- **Description** (optionnel) : textarea, max 500 caracteres. Placeholder : "Decrivez ce que fait cette tache et pourquoi elle est necessaire."
- **Tags** (optionnel) : input multi-tag (taper + Enter pour ajouter). Tags existants en autocompletion. Ex: "maintenance", "reporting", "sync", "cleanup".

**Section 2 — Planification :**
- Expression cron avec editeur visuel (voir 3.2).

**Section 3 — Cible :**
- Type et configuration (voir 3.3).

**Section 4 — Politique d'execution :**
- **Retry** : toggle "Retenter en cas d'echec" (defaut non). Si active :
  - Nombre de tentatives : input numerique 1-10 (defaut 3)
  - Strategie de backoff : radio buttons — Fixe (meme delai a chaque retry), Exponentiel (1s, 2s, 4s, 8s, 16s...)
  - Delai initial : input numerique en secondes (defaut 60s pour fixe, 1s pour exponentiel)
  - Delai maximum (pour exponentiel) : input numerique en secondes (defaut 300s)
  - Le backoff exponentiel suit la formule : `min(delay_initial * 2^(attempt-1), delay_max)`. Avec les defauts : 1s, 2s, 4s, 8s, 16s (5 retries max).
- **Timeout** : input numerique en secondes (defaut 300, min 5, max 3600). Texte d'aide : "L'execution sera interrompue si elle depasse cette duree."
- **Catch-up** : toggle "Rattraper les executions manquees" (defaut non). Si active et que le scheduler etait down pendant une execution prevue, l'execution manquee est declenchee au redemarrage. Texte d'aide : "Si le planificateur redemarre, les executions manquees seront rattrapees."
- **Execution parallele** : toggle "Autoriser l'execution parallele" (defaut non). Si desactive et que la tache est deja en cours quand un nouveau declenchement survient, le nouveau declenchement est ignore. Si active, les executions peuvent se chevaucher.
- **Statut initial** : toggle actif/inactif (defaut actif).

Boutons en bas : "Creer la tache" (primaire), "Annuler" (secondaire). Le bouton "Creer" est desactive tant que les champs requis ne sont pas valides.

### 3.2 Editeur d'expression cron (cron builder UI)
L'editeur d'expression cron est un composant React dedie combine deux modes, switchables via un toggle "Visuel" / "Expert" :

**Mode visuel** (defaut) :
Interface de construction etape par etape qui genere l'expression cron. L'utilisateur repond a la question "A quelle frequence ?" avec un dropdown :
- **Toutes les N minutes** : dropdown de N (1, 2, 5, 10, 15, 30). Genere `*/{N} * * * *`.
- **Toutes les heures** : selecteur minute de declenchement (0-59, paliers de 5). Genere `{min} * * * *`.
- **Chaque jour** : selecteur heure (0-23) + minute (0-59, paliers de 5). Genere `{min} {hour} * * *`.
- **Chaque semaine** : checkboxes jour de la semaine (lun-dim) + selecteur heure:minute. Genere `{min} {hour} * * {days}`.
- **Chaque mois** : selecteur jour du mois (1-31) + selecteur heure:minute. Genere `{min} {hour} {dom} * *`.
- **Personnalise** : 5 selecteurs individuels (minute, heure, jour du mois, mois, jour de la semaine) avec des dropdowns multi-selection. Chaque selecteur supporte : valeur unique, liste (1,3,5), plage (1-5), intervalle (*/5), wildcard (*).

**Presets rapides** (boutons sous le mode visuel) :
- "Toutes les minutes" -> `* * * * *`
- "Toutes les 5 minutes" -> `*/5 * * * *`
- "Toutes les heures" -> `0 * * * *`
- "Chaque jour a minuit" -> `0 0 * * *`
- "Chaque lundi a 9h" -> `0 9 * * 1`
- "Le 1er du mois a 3h" -> `0 3 1 * *`

**Mode expert** :
Input texte libre pour saisir l'expression cron a 5 champs (ou 6 avec secondes optionnelles). Validation en temps reel avec coloration syntaxique (chaque champ dans une couleur distincte). Message d'erreur si syntaxe invalide (ex: "Le champ 'heure' doit etre entre 0 et 23"). Support des extensions : `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`.

**Preview (affiche dans les deux modes)** :
- **Explication en langage naturel** : texte dynamique au-dessus du preview — ex: "S'execute toutes les 5 minutes" ou "S'execute chaque lundi a 9h00 UTC". Mis a jour en temps reel a chaque modification. Rendu en `text-sm font-medium`.
- **5 prochaines executions** : liste horodatee des 5 prochaines executions calculees par le backend ou par la librairie `croner` cote client :
  ```
  1. mer. 09 avr. 2026 15:00
  2. mer. 09 avr. 2026 15:05
  3. mer. 09 avr. 2026 15:10
  4. mer. 09 avr. 2026 15:15
  5. mer. 09 avr. 2026 15:20
  ```
  Les dates sont affichees dans le fuseau horaire configure (defaut UTC, affiche le nom du timezone).

### 3.3 Types de cibles

**HTTP** (icone `Globe`) :
- **Methode** : dropdown GET, POST, PUT, DELETE (defaut POST)
- **URL** : input texte. Si commence par `/`, l'URL est relative au service Gateway (`http://localhost:3099`). Si URL complete (http/https), appel externe direct. Validation de format URL.
- **Headers** : tableau dynamique cle/valeur (bouton "+ Ajouter un header"). Headers pre-remplis courants : `Content-Type: application/json`, `Authorization: Bearer {{vault:token-name}}`. Les references vault `{{vault:...}}` sont resolues a l'execution.
- **Body** (pour POST/PUT) : editeur JSON avec coloration syntaxique et validation (doit etre du JSON valide). Placeholder : `{ "action": "cleanup" }`.
- **Auth** : dropdown None, Bearer token, Basic Auth. Pour Bearer : input avec reference vault (`{{vault:api-token-cleanup}}`). Pour Basic : username + password (reference vault).
- **Code de succes attendu** : input multi-valeur (defaut "200-299"). Exemples : "200", "200,201,204", "200-299". Si le code retourne n'est pas dans la liste, l'execution est marquee en echec.

**SQL** (icone `Database`) :
- **Requete SQL** : editeur multi-lignes avec coloration syntaxique SQL. Taille min 4 lignes, max extensible.
- **Base de donnees** : dropdown des bases configurees (defaut : "signapps"). La liste est alimentee par la configuration du service.
- **Mode d'execution** : radio buttons :
  - Execute (defaut) : pas de resultat retourne, seul le nombre de lignes affectees est loge
  - Query : le resultat (lignes retournees) est stocke dans les logs (tronque a 10 000 lignes, 1MB max)
- **Guardrails de securite** : les requetes contenant `DROP`, `TRUNCATE`, ou `DELETE` sans clause `WHERE` sont bloquees par defaut. Un toggle "Autoriser les requetes destructives" est disponible (avec un avertissement rouge : "Cette requete peut modifier ou supprimer des donnees de maniere irreversible"). Les requetes `ALTER TABLE` et `CREATE INDEX` sont autorisees car elles sont courantes en maintenance.

**PgEventBus** (icone `Radio`) :
- **Nom de l'evenement** : input texte avec autocompletion des evenements connus (ex: `maintenance.daily`, `sync.calendar`, `cleanup.storage`, `mail.fetch.all`). Format : `{domain}.{action}` (validation regex `^[a-z]+\.[a-z._]+$`).
- **Payload JSON** (optionnel) : editeur JSON. Variables de template disponibles : `{{task_name}}`, `{{task_id}}`, `{{execution_time}}`, `{{execution_id}}`.
- Texte d'aide : "L'evenement sera publie sur le bus PostgreSQL (NOTIFY). Les services abonnes le traiteront de maniere asynchrone."

**Webhook externe** (icone `Webhook`) :
- **URL** : input texte (doit commencer par https:// pour la production). Validation de format URL.
- **Methode** : dropdown POST (defaut), PUT, PATCH.
- **Payload JSON** : editeur JSON avec variables de template : `{{task_name}}`, `{{task_id}}`, `{{execution_time}}`, `{{execution_id}}`, `{{trigger_type}}`.
- **Headers personnalises** : tableau cle/valeur (meme composant que HTTP).
- **Secret HMAC** (optionnel) : input texte pour la cle de signature. Si configure, le payload est signe avec HMAC-SHA256 et la signature est ajoutee dans le header `X-Signature-256`. Le destinataire peut verifier l'authenticite du webhook.

**Service RPC interne** (icone `Zap`) :
- **Service cible** : dropdown des services SignApps (Identity, Calendar, Mail, etc.)
- **Action** : input texte libre (ex: `cleanup_expired_sessions`, `recalculate_quotas`)
- **Parametres JSON** (optionnel) : editeur JSON
- L'appel est fait via HTTP interne `POST http://localhost:{port}/api/v1/rpc/{action}` avec le body JSON. Ce type simplifie la configuration par rapport au type HTTP en cachant les details de l'URL et du port.

**Commande systeme** (icone `Terminal`, restreint aux super-admins) :
- **Commande** : input texte (ex: `pg_dump signapps > /backups/signapps-$(date +%Y%m%d).sql`)
- **Repertoire de travail** : input texte (defaut : `/tmp`)
- **Variables d'environnement** : tableau cle/valeur additionnelles
- **Timeout specifique** : override du timeout global (defaut 600s pour les commandes, car souvent plus longues)
- Avertissement rouge permanent : "Les commandes systeme s'executent sur le serveur avec les privileges du service scheduler. Cette fonctionnalite est desactivee par defaut. Activation requise dans la configuration serveur (SCHEDULER_ALLOW_SHELL=true)."

### 3.4 Edition d'une tache existante
Meme formulaire que la creation, pre-rempli avec les valeurs actuelles. Le nom est en lecture seule (non modifiable apres creation pour eviter les confusions dans les logs). L'edition ne modifie pas l'historique des executions. Si la planification change, la prochaine execution est recalculee immediatement et affichee dans le preview. Un avertissement s'affiche si la tache est actuellement en cours d'execution : "Cette tache est en cours d'execution. Les modifications seront appliquees a la prochaine execution." Pour les taches systeme, seuls la planification, le timeout et la politique de retry sont modifiables (la cible est en lecture seule).

### 3.5 Duplication de tache
Action "Dupliquer" dans le menu d'actions d'une tache existante : cree une copie avec toutes les memes configurations mais un nom suffixe "-copy" (ou "-copy-2" si deja existant). Le formulaire de creation s'ouvre pre-rempli avec les valeurs dupliquees, permettant a l'utilisateur de modifier avant de sauvegarder. Le flag `is_system` n'est PAS copie (la copie est toujours une tache utilisateur).

---

## Categorie 4 — Execution et monitoring

### 4.1 Execution manuelle
Bouton "Executer maintenant" (icone `Play`) dans le menu d'actions de chaque tache. Clic ouvre un dialog de confirmation : "Executer la tache '{nom}' immediatement ?" avec le resume de la cible (type + URL/query/event). Boutons "Executer" (primaire) et "Annuler". L'execution manuelle est declenchee independamment de la planification cron. Elle est tracee avec `trigger_type = 'manual'` et `created_by = {user_id}` dans l'historique. Le dialog se ferme et un toast s'affiche : "Execution de '{nom}' lancee" avec un lien "Voir les logs" qui ouvre le detail de l'execution.

### 4.2 Historique des executions
Clic sur le nom d'une tache -> page de detail `/scheduler/{id}` avec onglets :

**Onglet "Configuration"** : resume de la configuration de la tache (nom, description, cron, cible, retry, timeout).

**Onglet "Historique"** (defaut) : tableau des executions passe avec les colonnes :
- **ID** : UUID court (8 premiers caracteres), cliquable pour voir les logs
- **Declenchement** : badge "Planifie" (`bg-blue-100`) ou "Manuel" (`bg-purple-100`) ou "Catch-up" (`bg-amber-100`)
- **Debut** : horodatage du debut (format relatif si < 24h, absolu sinon)
- **Fin** : horodatage de fin (ou "En cours..." avec spinner)
- **Duree** : temps d'execution formate (ex: "1.2s", "45s", "2m 30s", "1h 2m"). Couleur orange si > 80% du timeout, rouge si timeout atteint.
- **Statut** : badge — Succes (vert `CheckCircle`), Echec (rouge `XCircle`), Timeout (orange `Clock`), En cours (bleu `Loader2` avec spinner), Annule (gris `Ban`)
- **Tentative** : affiche si retry (ex: "1/3", "2/3", "3/3"). La tentative finale en echec est en gras rouge.

Filtres au-dessus du tableau : statut (multi-select), periode (date range picker), declenchement (tous/planifie/manuel). Pagination : 20 par page. Tri par defaut : debut decroissant (plus recent en premier).

### 4.3 Logs d'execution
Clic sur l'ID d'une execution -> panneau de detail des logs (panneau lateral `Sheet` ou section expandable) :

**HTTP** :
```
--- Request ---
POST http://localhost:3099/api/v1/sessions/cleanup
Content-Type: application/json
Authorization: Bearer ***

{"max_age_hours": 24}

--- Response ---
HTTP 200 OK (1.2s)
Content-Type: application/json

{"deleted_count": 42, "remaining": 156}
```

**SQL** :
```
--- Query ---
DELETE FROM sessions WHERE expires_at < now() - interval '24 hours'

--- Result ---
42 rows affected (0.8s)
```

**PgEventBus** :
```
--- Event ---
Channel: maintenance.daily
Payload: {"source": "scheduler", "task": "daily-maintenance"}

--- Delivery ---
NOTIFY sent successfully (0.3ms)
```

**Webhook** :
```
--- Request ---
POST https://hooks.slack.com/services/T00/B00/xxxx
Content-Type: application/json
X-Signature-256: sha256=abc123...

{"text": "Daily backup completed", "task": "backup-database"}

--- Response ---
HTTP 200 OK (340ms)
ok
```

**Commande** :
```
--- Command ---
pg_dump signapps > /backups/signapps-20260409.sql
Working directory: /tmp

--- stdout ---
(empty)

--- stderr ---
pg_dump: last built-in OID is 16383
pg_dump: reading extensions
pg_dump: saving encoding = UTF8

--- Exit code ---
0 (success, 45.2s)
```

Les logs sont affiches dans un composant `<pre>` avec fond `bg-muted` et coloration syntaxique (JSON highlight, SQL highlight). Taille max : 1 Mo par execution (tronque au-dela avec message "Logs tronques. Telechargez le fichier complet." et lien de telechargement). Bouton "Copier les logs" (icone `Copy`) pour copier dans le presse-papiers.

### 4.4 Annulation d'execution
Si une execution est en cours (statut "En cours"), un bouton "Annuler" (icone `Ban`, rouge) est disponible dans le detail de l'execution et dans la colonne Actions du tableau. Clic ouvre un dialog : "Annuler l'execution en cours de '{nom}' ?" Bouton "Confirmer l'annulation" (destructif). Le mecanisme d'annulation depend du type de cible :
- **HTTP/Webhook** : le client `reqwest` est avorte via `tokio::select!` avec un `CancellationToken`. La requete HTTP en cours est droppee.
- **SQL** : la transaction est annulee via `pg_cancel_backend(pid)`.
- **Commande** : un signal `SIGTERM` est envoye au processus fils. Si le processus ne se termine pas dans les 10 secondes, `SIGKILL` est envoye.
- **PgEventBus** : le NOTIFY est instantane, pas d'annulation possible (le statut passe directement a "Succes" ou "Echec").

L'execution passe en statut "Annule" avec la duree ecoulee et la mention "Annule par {user}" dans les logs.

### 4.5 Statistiques par tache
Onglet "Statistiques" dans le detail d'une tache (`/scheduler/{id}?tab=stats`) :
- **Taux de succes** : pourcentage d'executions reussies. Affiches pour 3 periodes : 24h, 7j, 30j. Graphique de progression circulaire (donut chart) colore : vert >= 95%, orange 80-95%, rouge < 80%.
- **Duree moyenne** : temps moyen d'execution sur 30j. Affiche en `font-mono`.
- **Duree p95** : 95e percentile de la duree d'execution sur 30j. Si p95 > 80% du timeout, un avertissement s'affiche : "Les executions approchent le timeout. Envisagez d'augmenter le timeout ou d'optimiser la tache."
- **Executions par jour** : graphique en barres (Recharts `BarChart`) montrant le nombre d'executions quotidiennes sur 30j. Barres empilees : succes (vert), echec (rouge), timeout (orange), annule (gris).
- **Distribution des statuts** : graphique en camembert (Recharts `PieChart`) — succes, echec, timeout, annule. Legende avec pourcentages.
- **Tendance** : graphique en courbe (Recharts `LineChart`) montrant l'evolution du taux de succes quotidien sur 30j. Ligne de reference a 95% (seuil d'alerte).

### 4.6 Execution en cours (live)
Quand une tache est en cours d'execution :
- Dans le tableau principal : la pastille d'etat pulse en orange, le dernier statut affiche un spinner bleu "En cours"
- Dans le detail de la tache : bandeau bleu en haut "Execution en cours depuis {X}s" avec compteur en temps reel (`setInterval(1000)`) et bouton "Annuler"
- Si le type de cible le permet (commande systeme), les logs s'affichent en streaming via WebSocket (tail -f). Les nouvelles lignes apparaissent en temps reel avec un scroll auto vers le bas. Toggle "Auto-scroll" pour desactiver le scroll automatique.
- Le worker occupation est visible dans la KPI "En Cours" : "{N}/{max} workers occupes"

---

## Categorie 5 — Alertes et notifications

### 5.1 Alerte sur echec
Lorsqu'une execution echoue (code HTTP non attendu, erreur SQL, timeout, process exit non-zero), le systeme :
1. Marque l'execution comme "Echec" dans l'historique avec le message d'erreur
2. Si la politique de retry est configuree, programme une nouvelle tentative apres le delai (fixe ou exponentiel : 1s, 2s, 4s, 8s, 16s...). L'attempt_number est incremente. Les logs de chaque tentative sont stockes separement.
3. Si toutes les tentatives echouent (ou si retry desactive), emet une notification

### 5.2 Alerte sur N echecs consecutifs
Au-dela du retry intra-execution, le systeme detecte les patterns d'echec recurrents :
- Si une tache echoue **3 executions consecutives** (meme apres retries), son etat passe en "erreur" (pastille rouge dans le tableau) et une notification critique est emise aux administrateurs
- Le message : "La tache '{nom}' a echoue {N} fois consecutivement. Derniere erreur : {message}. Action requise."
- La tache continue de s'executer selon son planning (elle ne se desactive pas automatiquement) sauf si un admin la desactive manuellement

### 5.3 Canaux de notification
Les notifications d'echec sont envoyees via :
- **Notification in-app** (toujours) : toast + badge rouge sur l'icone Scheduler dans la sidebar. Compteur : nombre de taches en erreur.
- **Email** : envoye aux administrateurs configures par tache (multi-select dans la section "Notifications" du formulaire). Objet : "[SignApps Scheduler] Echec — {nom}". Corps : nom, cron, cible, erreur, lien vers les logs.
- **Webhook** : URL configurable par tache (Slack, Teams, Discord). Payload JSON : `{ "task_name", "task_id", "execution_id", "status", "error_message", "attempt", "timestamp", "url" }`. Pour Slack : format Block Kit avec barre laterale rouge, titre, erreur, bouton "Voir les logs".
- **PgEventBus** : evenement `scheduler.task.failed` emis pour integration avec `signapps-notifications`. Payload : meme que webhook.

### 5.4 Notification de succes (optionnel)
Par defaut, les executions reussies ne declenchent pas de notification (trop bruyant). Option par tache : toggle "Notifier aussi en cas de succes" dans la section Notifications. Utile pour les taches critiques ou les taches peu frequentes (ex: backup mensuel). Le message de succes inclut la duree d'execution et un resume du resultat.

### 5.5 Alerte de retard
Si une tache n'a pas ete executee depuis plus longtemps que 2x l'intervalle cron prevu, une alerte "Execution en retard" est emise :
- Calcul : si la tache est planifiee toutes les 5 min et qu'aucune execution n'a ete tracee depuis 10 min, l'alerte se declenche
- Message : "La tache '{nom}' est en retard. Derniere execution : il y a {duration}. Prochaine execution prevue : {next}."
- Cause probable : scheduler down, tache bloquee, pool de workers sature
- L'alerte est envoyee une seule fois (pas de repetition tant que la tache ne s'execute pas)

### 5.6 Resume quotidien
Email recapitulatif quotidien optionnel (toggle dans `/admin/scheduler/settings`) envoye aux administrateurs a 8h00 :
- **Resume** : nombre total d'executions dans les dernieres 24h, taux de succes global
- **Succes** : nombre d'executions reussies (vert)
- **Echecs** : nombre d'echecs avec liste des taches en echec (nom, nombre d'echecs, dernier message d'erreur)
- **Timeouts** : nombre de timeouts avec liste des taches concernees
- **Taches en erreur** : taches dont les 3 dernieres executions ont echoue (attention requise)
- **Taches inactives** : taches desactivees depuis plus de 7 jours (potentiellement oubliees)
- **Pool de workers** : utilisation maximale sur 24h (ex: "pic a 8/10 workers a 03:02")
- Lien vers le dashboard `/scheduler` pour plus de details

---

## Categorie 6 — Taches systeme SignApps

### 6.1 Taches pre-configurees
Le scheduler est livre avec 10 taches systeme pre-configurees. Ces taches sont creees automatiquement au premier demarrage du service (migration). Elles sont non-supprimables et seule leur planification, leur politique de retry et leur timeout sont modifiables.

| # | Tache | Planification defaut | Cible | Description |
|---|---|---|---|---|
| 1 | `health-check-all` | `*/10 * * * * *` (10s) | HTTP GET /health sur chaque service | Verification de sante de tous les services. Alimente la status page et les metriques. Les resultats sont stockes dans `metrics.service_health_checks`. |
| 2 | `backup-rotation` | `0 2 * * *` (2h quotidien) | Commande `pg_dump` | Sauvegarde PostgreSQL quotidienne. Rotation : conserve les 7 derniers jours, 4 derniers dimanches, 12 derniers 1ers du mois. |
| 3 | `log-cleanup` | `0 3 * * *` (3h quotidien) | SQL DELETE | Purge des logs d'execution du scheduler de plus de 30 jours. Purge des health checks de plus de 90 jours. Purge des logs applicatifs de plus de 14 jours. |
| 4 | `session-purge` | `0 */6 * * *` (toutes les 6h) | SQL DELETE | Suppression des sessions JWT expirees, des tokens de refresh invalides, et des codes de confirmation expires dans la table `sessions`. |
| 5 | `email-queue-flush` | `*/5 * * * *` (5 min) | PgEventBus: `mail.fetch.all` | Declenchement de la recuperation des nouveaux emails IMAP pour tous les comptes configures. Le service mail (port 3012) consomme l'evenement et synchronise les boites. |
| 6 | `cache-warm` | `0 6 * * *` (6h quotidien) | HTTP POST /api/v1/cache/warm | Pre-chargement des caches frequemment utilises au debut de la journee : contacts, calendriers, permissions RBAC, configurations. Reduit la latence des premieres requetes. |
| 7 | `health-check-services` | `*/30 * * * *` (30 min) | HTTP GET /health sur chaque service | Health check complementaire avec verification approfondie (DB connectivity, disk space, memory usage). Resultat stocke separement pour le dashboard admin. |
| 8 | `certificate-renewal-check` | `0 8 * * *` (8h quotidien) | HTTP GET /api/v1/proxy/certificates | Verification de l'expiration des certificats TLS geres par signapps-proxy. Si un certificat expire dans moins de 14 jours, notification d'alerte aux admins. |
| 9 | `storage-quota-recalculation` | `0 1 * * *` (1h quotidien) | SQL | Recalcul des quotas de stockage par utilisateur et par organisation. Met a jour `storage_quotas.used_bytes` en agregant la taille des fichiers dans `storage_files`. |
| 10 | `search-index-rebuild` | `0 4 * * 0` (dim 4h) | PgEventBus: `search.rebuild` | Reconstruction complete de l'index de recherche full-text (Tantivy). Execute hebdomadairement pour garantir la coherence de l'index apres d'eventuelles corruptions. |

### 6.2 Badge systeme
Les taches systeme sont marquees avec un badge "Systeme" (`bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full`) dans le tableau pour les distinguer des taches utilisateur. Elles ne peuvent pas etre supprimees (le bouton "Supprimer" est desactive avec tooltip : "Les taches systeme ne peuvent pas etre supprimees"). Elles peuvent etre desactivees, mais avec un dialog d'avertissement : "Desactiver cette tache peut impacter le fonctionnement de la plateforme. Etes-vous sur ?" (bouton destructif rouge).

### 6.3 Taches utilisateur
Les administrateurs peuvent creer des taches personnalisees pour leurs besoins specifiques. Exemples :
- Appels webhook vers des services tiers (API de CRM, ERP, etc.) — ex: sync quotidienne des contacts avec Salesforce
- Requetes SQL de reporting (export quotidien de statistiques dans une table dediee)
- Evenements PgEventBus pour orchestrer des workflows internes — ex: generer un rapport PDF chaque vendredi
- Commandes systeme pour des scripts de maintenance personnalises — ex: rotation des fichiers de backup

Les taches utilisateur ont les memes capacites que les taches systeme mais sont entierement modifiables et supprimables. Elles sont marquees sans badge (ou avec un badge "Custom" gris si besoin de distinction).

---

## Categorie 7 — Configuration et administration

### 7.1 Parametres globaux du scheduler
Page `/admin/scheduler/settings` (permission `scheduler.admin` requise) :
- **Intervalle de tick** : frequence a laquelle le scheduler verifie les taches a executer (defaut 1s, min 1s, max 60s). Diminuer augmente la precision mais la charge CPU. Input numerique avec unite "secondes".
- **Workers paralleles** : nombre max d'executions simultanees (defaut 10, min 1, max 100). Ajustable selon les ressources serveur. Input numerique. Texte d'aide : "Utilisation actuelle : {N}/{max} workers."
- **Timeout global** : timeout par defaut pour les executions (defaut 300s, min 5, max 3600). Surcharge possible par tache. Input numerique avec unite "secondes".
- **Retention des logs** : duree de conservation des logs d'execution (defaut 30 jours, min 7, max 365). Input numerique avec unite "jours".
- **Retention de l'historique** : duree de conservation de l'historique d'execution — les entrees dans `task_executions` (defaut 90 jours, min 30, max 730). Input numerique avec unite "jours".
- **Catch-up global** : politique par defaut pour les executions manquees (toggle, defaut desactive). Surcharge possible par tache.
- **Fuseau horaire** : timezone reference pour l'evaluation des expressions cron (defaut UTC). Dropdown avec recherche parmi les timezones IANA (ex: "Europe/Paris", "America/New_York"). Attention : le changement de timezone recalcule toutes les prochaines executions.
- **Resume quotidien** : toggle + multi-select des destinataires email. Heure d'envoi configurable (defaut 8h00).
- **Commandes systeme** : toggle "Autoriser les commandes shell" (defaut desactive). Avertissement rouge si active.

Bouton "Sauvegarder" en bas. Les modifications prennent effet immediatement (hot reload, pas de redemarrage du service).

### 7.2 Pool de workers et moteur d'execution
Le scheduler utilise un pool de workers async (tokio tasks) pour executer les taches en parallele :
- Chaque execution est spawnee dans un `tokio::spawn` dedie
- Un semaphore `tokio::sync::Semaphore` limite le nombre de workers paralleles au max configure
- Si tous les workers sont occupes, les executions sont mises en file d'attente FIFO. La file est bornee (max 100 elements). Si la file est pleine, une alerte "Pool sature" est emise.
- Le dashboard affiche l'occupation du pool dans le KPI "En Cours" : "{N}/{max} workers actifs"
- Les metriques du pool sont exposees sur `/health` : `scheduler_workers_busy`, `scheduler_workers_total`, `scheduler_queue_depth`

Le lock distribue pour la haute disponibilite utilise `pg_advisory_lock` :
1. Au demarrage, le service tente d'acquerir `pg_advisory_lock(hashtext('signapps-scheduler'))`.
2. Si le lock est obtenu, le service devient l'instance active et demarre le moteur cron.
3. Si le lock echoue (une autre instance l'a deja), le service entre en mode standby et tente de reacquerir le lock toutes les 5 secondes.
4. L'instance active renouvelle le lock en maintenant la connexion PostgreSQL. Si la connexion tombe, une autre instance prend le relais en quelques secondes.
5. Le health check du service retourne `"role": "active"` ou `"role": "standby"` pour le monitoring.

### 7.3 RBAC
Les permissions du scheduler sont integrees au RBAC SignApps (gere par `signapps-identity`, port 3001) :
- `scheduler.view` : voir le dashboard, le tableau des taches et l'historique (role : operateur, administrateur)
- `scheduler.create` : creer des taches (role : administrateur)
- `scheduler.edit` : modifier les taches existantes (role : administrateur)
- `scheduler.delete` : supprimer des taches (role : administrateur)
- `scheduler.execute` : executer manuellement une tache (role : administrateur)
- `scheduler.admin` : modifier les parametres globaux, gerer les taches systeme, activer les commandes shell (role : super-admin)

Les permissions sont verifiees a chaque appel API via le middleware auth de `signapps-common`. Les boutons d'action dans l'UI sont affiches/masques selon les permissions de l'utilisateur connecte (store Zustand `useAuthStore`).

### 7.4 Audit trail
Toutes les actions sur le scheduler sont enregistrees dans le journal d'audit (`audit_log` table, gere par `signapps-identity`) :
- **Creation** : `scheduler.task.created` — qui (user_id), quand (timestamp), quoi (task_name, configuration complete en JSON)
- **Modification** : `scheduler.task.updated` — qui, quand, quoi (diff des champs modifies : ancien -> nouveau)
- **Suppression** : `scheduler.task.deleted` — qui, quand, quoi (task_name)
- **Execution manuelle** : `scheduler.task.executed` — qui, quand, quoi (task_name, execution_id)
- **Activation/desactivation** : `scheduler.task.toggled` — qui, quand, quoi (task_name, new_status)
- **Parametres globaux modifies** : `scheduler.settings.updated` — qui, quand, quoi (diff des parametres)

Le journal est consultable depuis `/admin/audit` avec filtre "Scheduler" (dropdown de categorie). Chaque entree affiche le timestamp, l'utilisateur, l'action et les details. Export CSV disponible.

### 7.5 Import/Export
- **Export** : bouton "Exporter" dans `/admin/scheduler/settings`. Genere un fichier JSON contenant la configuration de toutes les taches (sauf les taches systeme, qui sont recreees automatiquement) :
  ```json
  {
    "version": 1,
    "exported_at": "2026-04-09T14:30:00Z",
    "tasks": [
      {
        "name": "sync-crm-contacts",
        "description": "...",
        "cron_expression": "0 */2 * * *",
        "target_type": "webhook",
        "target_config": { ... },
        "retry_count": 3,
        "retry_backoff": true,
        "timeout_seconds": 120,
        "status": "active",
        "tags": ["sync", "crm"]
      }
    ]
  }
  ```
- **Import** : upload d'un fichier JSON. Etape de validation avant import :
  - Detection des conflits de noms (tache existante avec le meme nom)
  - Verification des cibles (URLs accessibles ? Evenements connus ?)
  - Mode **dry-run** (defaut) : affiche un resume des changements sans les appliquer ("3 taches a creer, 1 conflit de nom, 0 erreurs"). Bouton "Appliquer" pour executer l'import.
  - Mode **force** : ecrase les taches existantes avec le meme nom (confirmation requise)

---

## Categorie 8 — Architecture backend

### 8.1 Service signapps-scheduler
Le scheduler tourne comme un service independant sur le port 3007. Il est responsable de :
- Charger les taches depuis PostgreSQL au demarrage (`SELECT * FROM scheduled_tasks WHERE status = 'active'`)
- Evaluer les expressions cron a chaque tick (1s par defaut) via la crate `cron` (MIT)
- Lancer les executions dans le pool de workers (tokio tasks + semaphore)
- Enregistrer les resultats dans PostgreSQL (`task_executions`)
- Exposer l'API REST pour le CRUD des taches et la consultation de l'historique
- Emettre les evenements sur PgEventBus (`scheduler.task.succeeded`, `scheduler.task.failed`, `scheduler.task.started`)
- Maintenir le lock distribue `pg_advisory_lock` pour la haute disponibilite

### 8.2 Schema PostgreSQL

```sql
-- Table des taches planifiees
CREATE TABLE scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL, -- http, sql, pgeventbus, webhook, rpc, command
    target_config JSONB NOT NULL, -- configuration specific to target_type
    retry_count INT NOT NULL DEFAULT 0,
    retry_delay_seconds INT NOT NULL DEFAULT 60,
    retry_backoff BOOLEAN NOT NULL DEFAULT false,
    retry_max_delay_seconds INT NOT NULL DEFAULT 300,
    timeout_seconds INT NOT NULL DEFAULT 300,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, error
    is_system BOOLEAN NOT NULL DEFAULT false,
    catch_up BOOLEAN NOT NULL DEFAULT false,
    allow_parallel BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[] NOT NULL DEFAULT '{}',
    next_execution_at TIMESTAMPTZ,
    last_execution_at TIMESTAMPTZ,
    last_execution_status VARCHAR(20),
    consecutive_failures INT NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_status ON scheduled_tasks (status);
CREATE INDEX idx_tasks_next_exec ON scheduled_tasks (next_execution_at)
    WHERE status = 'active';

-- Table des executions
CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    trigger_type VARCHAR(20) NOT NULL DEFAULT 'schedule', -- schedule, manual, catch_up
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, success, failure, timeout, cancelled
    attempt_number INT NOT NULL DEFAULT 1,
    error_message TEXT,
    logs TEXT,
    created_by UUID, -- for manual executions
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_executions_task_started
    ON task_executions (task_id, started_at DESC);
CREATE INDEX idx_executions_status
    ON task_executions (status);
CREATE INDEX idx_executions_started
    ON task_executions (started_at DESC);

-- Purge automatique via la tache systeme log-cleanup
-- DELETE FROM task_executions WHERE started_at < now() - interval '{retention} days'
```

### 8.3 Moteur cron
Le moteur cron est le coeur du service. Il utilise la crate `cron` (MIT) pour parser les expressions cron et calculer les prochaines executions. Le cycle principal :

```
Boucle infinie (tick = 1s par defaut) :
  1. SELECT * FROM scheduled_tasks
     WHERE status = 'active'
     AND next_execution_at <= now()
     ORDER BY next_execution_at ASC

  2. Pour chaque tache eligible :
     a. Si allow_parallel = false, verifier qu'aucune execution
        n'est en cours (SELECT count(*) FROM task_executions
        WHERE task_id = ? AND status = 'running')
     b. Acquerir un permit du semaphore (max workers)
     c. Spawn un tokio task : execute_task(task)
     d. Mettre a jour next_execution_at avec la prochaine
        execution calculee par la crate cron

  3. tokio::time::sleep(Duration::from_secs(tick_interval))
```

Le moteur est resilient aux retards : si un tick est manque (charge CPU), les taches en retard sont executees au tick suivant car la condition `next_execution_at <= now()` les capture. Le flag `catch_up` determine si les executions manquees pendant un downtime complet sont rattrapees : au demarrage, si `last_execution_at + interval < now()`, les executions manquees sont lancees.

### 8.4 Politique de retry avec backoff exponentiel
Quand une execution echoue et que `retry_count > 0` :

1. Le worker verifie si `attempt_number < retry_count + 1`
2. Si oui, calcule le delai avant la prochaine tentative :
   - **Fixe** (retry_backoff = false) : `retry_delay_seconds`
   - **Exponentiel** (retry_backoff = true) : `min(retry_delay_seconds * 2^(attempt-1), retry_max_delay_seconds)`
   - Avec les defauts (delay=1s, max=300s) : 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 300s
3. `tokio::time::sleep(Duration::from_secs(delay))` puis nouvelle tentative
4. Chaque tentative cree une nouvelle entree dans `task_executions` avec `attempt_number` incremente
5. Si la derniere tentative reussit, `consecutive_failures` est remis a 0
6. Si toutes les tentatives echouent, `consecutive_failures` est incremente. Si >= 3, le statut de la tache passe en "error"

### 8.5 REST API endpoints

**Taches :**
- `GET /api/v1/scheduler/tasks` — Lister les taches. Query params : `status` (active/inactive/error), `is_system` (true/false), `search` (nom), `tags` (comma-separated), `page`, `per_page`, `sort_by` (name/next_execution/last_execution), `sort_order` (asc/desc).
- `GET /api/v1/scheduler/tasks/{id}` — Detail d'une tache avec sa configuration complete et les statistiques (taux succes, duree moyenne, etc.).
- `POST /api/v1/scheduler/tasks` — Creer une tache. Body : `{ "name", "description", "cron_expression", "target_type", "target_config", "retry_count", "retry_delay_seconds", "retry_backoff", "timeout_seconds", "status", "catch_up", "allow_parallel", "tags" }`. Retourne 201 avec la tache creee.
- `PUT /api/v1/scheduler/tasks/{id}` — Modifier une tache. Body partiel.
- `DELETE /api/v1/scheduler/tasks/{id}` — Supprimer. Retourne 409 si `is_system = true`.
- `POST /api/v1/scheduler/tasks/{id}/execute` — Executer maintenant. Retourne 202 avec l'execution_id.
- `POST /api/v1/scheduler/tasks/{id}/toggle` — Activer/desactiver. Retourne la tache mise a jour.
- `GET /api/v1/scheduler/tasks/check-name?name={name}` — Verifier l'unicite du nom. Retourne `{ "available": true/false }`.

**Executions :**
- `GET /api/v1/scheduler/tasks/{id}/executions` — Historique des executions d'une tache. Query params : `status`, `trigger_type`, `from`, `to`, `page`, `per_page`.
- `GET /api/v1/scheduler/executions/{id}` — Detail d'une execution avec logs complets.
- `POST /api/v1/scheduler/executions/{id}/cancel` — Annuler une execution en cours.
- `GET /api/v1/scheduler/executions/{id}/logs/download` — Telecharger les logs complets (fichier texte).

**Stats et admin :**
- `GET /api/v1/scheduler/stats` — KPIs du dashboard (total, actives, succes 24h, en cours, workers).
- `GET /api/v1/scheduler/tasks/{id}/stats` — Statistiques detaillees d'une tache (taux succes, duree, percentiles).
- `GET /api/v1/scheduler/settings` — Parametres globaux actuels.
- `PUT /api/v1/scheduler/settings` — Modifier les parametres globaux (permission `scheduler.admin`).
- `POST /api/v1/scheduler/export` — Exporter les taches en JSON.
- `POST /api/v1/scheduler/import` — Importer des taches. Query param : `dry_run=true` (defaut) ou `dry_run=false`.

### 8.6 Health check du scheduler
Le service expose `GET /health` avec un body JSON detaille :
```json
{
  "status": "healthy",
  "role": "active",
  "scheduler_tasks_total": 15,
  "scheduler_tasks_active": 12,
  "scheduler_executions_running": 3,
  "scheduler_workers_busy": 3,
  "scheduler_workers_total": 10,
  "scheduler_queue_depth": 0,
  "scheduler_last_tick_at": "2026-04-09T14:29:59Z",
  "scheduler_uptime_seconds": 86400,
  "db_connected": true
}
```

Le champ `role` est "active" si cette instance tient le lock distribue, "standby" sinon. Le champ `scheduler_last_tick_at` permet de detecter un freeze du moteur (si > 10s de retard, le health check retourne `"status": "degraded"`).

### 8.7 Haute disponibilite
En mode multi-instance (deploye sur plusieurs noeuds), le scheduler utilise un lock distribue PostgreSQL pour garantir qu'une seule instance execute les taches :

1. Au demarrage : `SELECT pg_try_advisory_lock(hashtext('signapps-scheduler'))`
2. Si true : l'instance devient active, demarre le moteur cron
3. Si false : l'instance entre en mode standby, boucle toutes les 5s pour retenter
4. L'instance active maintient la connexion PostgreSQL ouverte (le lock est libere automatiquement si la connexion tombe)
5. Si l'instance active crash : la connexion PostgreSQL est fermee, le lock est libere. L'instance standby acquiert le lock au prochain tick (max 5s de delai)
6. La transition active -> standby et standby -> active est logee dans tracing (`tracing::info!("Acquired scheduler lock, becoming active")`)

Toutes les instances exposent l'API REST (lecture), mais seule l'instance active execute les taches. Les ecritures (CRUD taches) sont acceptees par toutes les instances car elles passent par PostgreSQL.

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
- L'acces est refuse aux utilisateurs sans permission `scheduler.view`
- Les 4 KPIs (Total Taches, Taches Actives, Executions Reussies, En Cours) affichent des valeurs coherentes
- Les KPIs se rafraichissent toutes les 10 secondes
- Le taux de succes dans le KPI est colore vert >= 95%, orange 80-95%, rouge < 80%
- L'etat vide affiche "Aucune tache planifiee" et le bouton "Nouvelle Tache"
- Le tableau des taches affiche les colonnes Etat, Nom, Planification, Cible, Derniere Execution, Dernier Statut
- Le tri par colonne fonctionne (nom alphabetique, prochaine execution, derniere execution)
- La recherche par nom filtre les taches en temps reel (debounced 300ms)
- Le filtre par statut (actif, inactif, erreur, systeme) restreint la liste
- La pagination affiche 20 taches par page et navigue correctement
- Le bouton "Nouvelle Tache" ouvre le formulaire de creation
- Le bouton est masque pour les utilisateurs sans permission `scheduler.create`
- Le formulaire valide le nom (unicite en temps reel, caracteres autorises)
- Le formulaire rejette un nom contenant des espaces ou des caracteres speciaux
- L'editeur cron en mode visuel genere une expression cron valide pour chaque frequence
- Le preset "Toutes les 5 minutes" genere `*/5 * * * *`
- L'editeur cron en mode expert valide la syntaxe en temps reel
- L'editeur cron en mode expert rejette `99 * * * *` avec un message d'erreur
- Le preview affiche les 5 prochaines executions correctement calculees
- L'explication en langage naturel est coherente avec l'expression cron
- La creation d'une tache HTTP avec URL et methode l'enregistre et l'active
- La creation d'une tache SQL avec une requete SELECT l'enregistre correctement
- La creation d'une tache SQL avec DELETE sans WHERE est bloquee par les guardrails
- La creation d'une tache PgEventBus avec un nom d'evenement l'enregistre correctement
- La creation d'une tache webhook avec URL https et secret HMAC fonctionne
- Le bouton "Executer maintenant" declenche une execution immediate apres confirmation
- L'execution manuelle est tracee avec trigger_type = "manual" dans l'historique
- L'historique des executions affiche les colonnes ID, Declenchement, Debut, Fin, Duree, Statut, Tentative
- Le filtre par statut et par periode fonctionne dans l'historique
- Les logs d'une execution HTTP affichent la requete envoyee et la reponse recue
- Les logs d'une execution SQL affichent la requete et le nombre de lignes affectees
- Les logs de plus de 1MB sont tronques avec un lien de telechargement
- Le bouton "Copier les logs" copie dans le presse-papiers
- Une execution en echec affiche le statut rouge et le message d'erreur
- La politique de retry avec backoff exponentiel relance apres les delais 1s, 2s, 4s, 8s
- Chaque tentative de retry est tracee avec son numero (1/3, 2/3, 3/3)
- Le timeout interrompt une execution qui depasse la duree configuree
- Le bouton "Annuler" interrompt une execution en cours et passe le statut en "Annule"
- Apres 3 echecs consecutifs, la tache passe en etat "erreur" (pastille rouge)
- L'activation/desactivation d'une tache change son etat dans le tableau
- La desactivation d'une tache systeme affiche un avertissement
- La suppression d'une tache avec confirmation la retire du tableau
- Les taches systeme affichent le badge "Systeme" et ne sont pas supprimables
- La duplication d'une tache cree une copie avec le suffixe "-copy"
- L'indicateur d'execution imminente pulse quand une tache s'execute dans les 60s
- Le compte a rebours en secondes se met a jour en temps reel
- Le bouton "Actualiser" recharge les KPIs et le tableau
- Le bouton "Exporter" telecharge un CSV avec la liste des taches
- L'import JSON en mode dry-run affiche un apercu sans modifier les donnees
- L'import JSON en mode force cree les taches et signale les conflits
- Les statistiques par tache affichent le taux de succes, la duree moyenne et le p95
- Le graphique d'executions par jour affiche des barres empilees correctement colorees
- Le RBAC interdit la creation de taches aux utilisateurs non-administrateurs
- L'audit trail enregistre la creation, modification et suppression de taches
- Le scheduler reprend ses taches apres un redemarrage du service
- Le lock distribue empeche les executions en double en mode multi-instance
- Le health check retourne "role: active" pour l'instance qui tient le lock
- Le health check retourne "role: standby" pour les instances en attente
- L'alerte de retard se declenche si une tache n'a pas ete executee depuis 2x son intervalle
- Le resume quotidien email est envoye a 8h avec les statistiques correctes
- Les notifications webhook Slack sont formatees en Block Kit avec la barre de couleur correcte
