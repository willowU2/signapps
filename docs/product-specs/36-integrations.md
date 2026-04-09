# Module Integrations & Automatisations — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Zapier** | 6000+ integrations, trigger/action/filter model simple, multi-step zaps, paths (branching conditionnel), formatter (data transformation), tables (base de donnees interne), AI actions, webhooks, schedule trigger, 15+ filtres logiques |
| **Make (Integromat)** | Visual workflow builder (canvas drag-and-drop), routers (multi-branch), iterators/aggregators, error handling par module, data stores, HTTP module universel, watch/instant triggers, execution history detaillee |
| **n8n** | Open source (fair-code), 400+ nodes, visual workflow editor, code nodes (JS/Python), sub-workflows, error workflows, credential sharing, self-hosted, webhooks bidirectionnels, expressions JavaScript inline |
| **Tray.io** | Universal Automation Cloud, connector SDK, nested workflows, boolean logic builder, data mapper visuel, enterprise governance (approval workflows), large-scale parallel execution |
| **Workato** | Enterprise iPaaS, recipes (workflows), compound actions, callable recipes (sub-workflows), Workbot (Slack/Teams integration), data tables, API management, governance policies, AI-powered mapping |
| **Pipedream** | Developer-first, Node.js/Python/Go code steps, 1000+ API integrations, HTTP triggers, cron scheduler, connected accounts (OAuth), event history, SQL steps, key-value store |
| **IFTTT** | Simplicite extreme (if-this-then-that), applets communautaires, 800+ services, multi-action pro, filtres, queries, AI triggers |

## Principes directeurs

1. **Event-driven par defaut** — toutes les automatisations sont declenchees par des evenements internes (PgEventBus) ou externes (webhooks). Pas de polling sauf pour les sources qui ne supportent pas les events.
2. **No-code d'abord, code ensuite** — l'interface visuelle permet de creer des automatisations sans code. Pour les cas avances, un editeur de code inline (JavaScript/TypeScript) est disponible.
3. **Interne d'abord** — les triggers et actions couvrent d'abord les 33 services SignApps, puis les APIs externes. Chaque module SignApps expose ses evenements et ses actions via le bus d'evenements.
4. **Securise et audite** — chaque execution est loggee avec les donnees d'entree/sortie (masquage des secrets). Les credentials sont stockees dans le vault. Les permissions respectent le RBAC existant.
5. **Idempotent et resilient** — chaque action est idempotente (re-execution sans effet de bord). Retry automatique avec backoff exponentiel sur echec. Dead letter queue pour les evenements non-traitables.
6. **Testable** — chaque automatisation peut etre testee avec des donnees fictives avant activation. Dry-run sans effet reel.

---

## Categorie 1 — Trigger Builder (constructeur de declencheurs)

### 1.1 Liste des automatisations
Tableau principal : nom, trigger (evenement declencheur), statut (ENABLED/DISABLED/ERROR), derniere execution, nombre d'executions (24h/7j/30j), taux de succes. Exemples pre-affiches :
- **Notify on new user** — trigger `user.created` — ENABLED
- **Log large uploads** — trigger `file.uploaded` (condition: size > 1 Mo) — ENABLED

Bouton `+ New Automation` en haut a droite. Filtres par statut, par trigger, par module source.

### 1.2 Assistant de creation
Workflow en 3 etapes :
1. **Trigger** : choisir l'evenement declencheur (liste groupee par module SignApps + webhooks + schedule)
2. **Conditions** (optionnel) : filtres sur les donnees de l'evenement (ex: `file.size > 1048576`, `user.role == "admin"`)
3. **Actions** : une ou plusieurs actions a executer (envoi email, creation tache, appel API, notification push)

### 1.3 Triggers internes (PgEventBus)
Chaque service SignApps emet des evenements sur le PgEventBus. Liste des triggers disponibles par module :

**Identity** : `user.created`, `user.updated`, `user.deleted`, `user.login`, `user.logout`, `role.assigned`, `group.member.added`
**Drive** : `file.uploaded`, `file.downloaded`, `file.deleted`, `file.shared`, `file.moved`, `folder.created`
**Mail** : `email.received`, `email.sent`, `email.bounced`, `email.opened`
**Calendar** : `event.created`, `event.updated`, `event.deleted`, `event.reminder`
**Chat** : `message.sent`, `message.edited`, `channel.created`, `mention.received`
**Forms** : `form.submitted`, `form.created`, `form.updated`
**Tasks** : `task.created`, `task.completed`, `task.overdue`, `task.assigned`
**Billing** : `invoice.created`, `invoice.paid`, `invoice.overdue`, `payment.received`
**Contacts** : `contact.created`, `contact.updated`, `contact.deleted`
**Docs** : `document.created`, `document.updated`, `document.shared`

Chaque trigger fournit un payload JSON type avec la structure de l'evenement.

### 1.4 Trigger par schedule (cron)
Declenchement periodique sans evenement : toutes les X minutes/heures/jours, expression cron personnalisee. Fuseau horaire configurable. Exemples : "Chaque lundi a 9h, envoyer le rapport hebdomadaire", "Toutes les 15 minutes, verifier les factures en retard".

### 1.5 Trigger par webhook entrant
Generation d'une URL unique `https://app.signapps.com/api/v1/webhooks/<uuid>`. Tout POST sur cette URL declenche l'automatisation avec le body comme payload. Validation optionnelle : HMAC signature, IP whitelist, schema JSON. Utile pour les integrations externes (GitHub, Stripe, Slack).

### 1.6 Conditions et filtres
Chaque trigger peut etre filtre par des conditions :
- **Egalite** : `event.user.role == "manager"`
- **Comparaison** : `event.file.size > 5242880`
- **Contient** : `event.email.subject contains "urgent"`
- **Regex** : `event.message.body matches /^ERROR:.*/`
- **Existence** : `event.metadata.priority exists`
- **Logique** : AND, OR, NOT pour combiner les conditions

Interface visuelle de construction de conditions (drag-and-drop) ou editeur texte pour les expressions avancees.

### 1.7 Debounce et throttle
Pour eviter les tempetes d'evenements :
- **Debounce** : attendre X secondes apres le dernier evenement avant d'executer (ex: eviter 10 notifications pour 10 modifications rapides d'un fichier)
- **Throttle** : maximum N executions par periode (ex: max 1 email par heure pour un meme utilisateur)
- **Deduplication** : ignorer les evenements avec un ID deja traite

---

## Categorie 2 — Actions et workflows

### 2.1 Actions internes SignApps
Chaque module expose des actions invocables :
- **Mail** : envoyer un email (to, subject, body, attachments)
- **Chat** : poster un message (channel, text, mentions)
- **Notifications** : push notification (user, title, body)
- **Tasks** : creer une tache (title, description, assignee, due_date)
- **Calendar** : creer un evenement (title, start, end, attendees)
- **Drive** : copier un fichier, creer un dossier, partager
- **Contacts** : creer/mettre a jour un contact
- **Forms** : generer un formulaire pre-rempli
- **Docs** : creer un document depuis un template

### 2.2 Actions HTTP (requete externe)
Module HTTP generique : methode (GET/POST/PUT/PATCH/DELETE), URL, headers, body (JSON/form-data/raw), authentification (Bearer, Basic, API Key, OAuth2). Parsing de la reponse : extraction JSON path, mapping vers les variables du workflow.

### 2.3 Actions de transformation de donnees
- **Mapper** : transformer les champs (`event.user.full_name` → `"Bonjour {{first_name}}"`)
- **Formatter** : date format, number format, uppercase/lowercase, trim, split, join
- **Aggreger** : collecter plusieurs evenements et produire un resume
- **Template** : Handlebars/Mustache pour generer du texte riche

### 2.4 Workflows multi-etapes
Enchainer plusieurs actions en sequence. La sortie d'une action est disponible comme entree de la suivante. Exemple :
1. Trigger : `invoice.overdue`
2. Action 1 : rechercher le contact dans Contacts
3. Action 2 : envoyer un email de relance avec les details
4. Action 3 : creer une tache de suivi pour le commercial
5. Action 4 : poster un message dans le channel #comptabilite

### 2.5 Branchement conditionnel (paths)
A une etape du workflow, definir des branches selon une condition : si `invoice.amount > 10000` → branche A (alerte manager), sinon → branche B (relance standard). Merge des branches apres execution.

### 2.6 Boucles (iterators)
Pour traiter une liste d'elements : recevoir un evenement avec un tableau → iterer sur chaque element → executer une action par element. Exemple : formulaire avec liste de participants → creer un contact pour chacun.

### 2.7 Gestion des erreurs
Configuration par action : retry (nombre, delai, backoff), action de fallback en cas d'echec definitif, notification d'erreur. Dead letter queue pour les evenements non-traitables. Workflow d'erreur dedie (ex: envoyer un email a l'admin si une automation echoue).

### 2.8 Sous-workflows (callable)
Definir un workflow reutilisable appele par d'autres workflows. Parametres d'entree/sortie types. Exemple : "Envoyer notification multi-canal" = email + push + chat, appele depuis plusieurs automatisations.

---

## Categorie 3 — API et endpoints

### 3.1 Documentation des APIs internes
Page listant toutes les APIs REST des services SignApps avec leur Swagger UI. Groupees par service. Lien vers `/swagger-ui/` de chaque service. Recherche par endpoint, par methode, par tag.

### 3.2 API Explorer interactif
Interface type Swagger UI integree : choisir un endpoint, remplir les parametres, envoyer la requete, voir la reponse. Authentification automatique avec le token de l'utilisateur connecte. Historique des requetes.

### 3.3 Rate limiting des APIs
Configuration par endpoint ou globale : nombre de requetes par minute/heure, par utilisateur/IP/API key. Reponse `429 Too Many Requests` avec header `Retry-After`. Dashboard du trafic API.

### 3.4 Versioning des APIs
Convention de versioning : `/api/v1/`, `/api/v2/`. Documentation des breaking changes entre versions. Deprecation notices avec date de fin de support. Header `X-API-Deprecated` sur les endpoints en fin de vie.

### 3.5 Health checks
Endpoint `/health` sur chaque service retournant `{ "status": "ok", "version": "1.0.0", "uptime": 3600 }`. Endpoint `/ready` pour la readiness probe (database, cache, dependencies). Monitoring centralise dans le dashboard.

---

## Categorie 4 — Webhooks sortants

### 4.1 Configuration de webhooks
Interface de creation : URL de destination, evenements a ecouter (selection multiple), format (JSON), methode (POST), headers custom, secret pour la signature HMAC.

### 4.2 Signature HMAC
Chaque webhook sortant est signe avec un secret partage (HMAC-SHA256). Header `X-Signature-256` contient la signature. Le destinataire peut verifier l'authenticite. Documentation du processus de verification.

### 4.3 Retry et delivery
En cas d'echec de livraison (timeout, 5xx) : retry automatique avec backoff exponentiel (1s, 5s, 30s, 5min, 30min, 2h). Maximum 6 tentatives. Notification apres echec definitif. Option de replay manuel depuis l'historique.

### 4.4 Historique des livraisons
Log de chaque webhook envoye : timestamp, URL, payload (masque pour les secrets), reponse (status code, body), duree, tentative numero. Filtres par webhook, par statut, par date. Rejeu en un clic.

### 4.5 Webhook de test
Bouton `Envoyer un test` avec un payload d'exemple. Verification que le destinataire recoit et repond correctement. Affichage de la reponse dans l'interface.

---

## Categorie 5 — Evenements et bus

### 5.1 Event Explorer
Interface de consultation des evenements du PgEventBus en temps reel. Flux scrollable avec filtre par type, par service source, par periode. Detail de chaque evenement : type, timestamp, payload JSON, consommateurs.

### 5.2 Schema des evenements
Chaque type d'evenement a un schema JSON documente : champs obligatoires, optionnels, types, exemples. Validation du payload avant emission. Versioning des schemas.

### 5.3 Event replay
Rejouer un evenement specifique pour re-declencher les automatisations associees. Utile pour le debug et les corrections. Option : replay avec dry-run (pas d'execution reelle).

### 5.4 Dead letter queue
Les evenements qui echouent apres tous les retries sont stockes dans une DLQ. Interface de consultation avec le motif d'echec. Actions : retry manuel, supprimer, envoyer a une autre destination.

### 5.5 Metriques d'evenements
Dashboard : evenements emis par minute/heure, par type, par service. Latence de traitement (temps entre emission et execution de l'action). Taux d'echec. Graphiques temps reel.

---

## Categorie 6 — Testing et debug

### 6.1 Mode test
Executer une automatisation avec des donnees fictives sans effet reel. Les actions internes (email, notification, tache) sont simulees et le resultat est affiche sans envoi/creation effectifs.

### 6.2 Execution pas a pas
Mode debug : executer le workflow action par action. A chaque etape, voir les donnees d'entree, le resultat, et choisir de continuer ou d'annuler. Modification des donnees a la volee pour tester differents scenarios.

### 6.3 Historique des executions
Pour chaque automatisation : log de toutes les executions avec timestamp, trigger data, actions executees, duree, statut (success/error/skipped). Drill-down dans chaque execution pour voir les details etape par etape.

### 6.4 Simulateur de payload
Editeur JSON pour creer un payload de test. Templates pre-remplis par type d'evenement. Validation contre le schema. Bouton `Simuler` pour voir le chemin d'execution sans declenchement reel.

### 6.5 Notifications de debug
Option par automatisation : recevoir une notification (email/push) a chaque execution avec le resume (trigger, actions, resultat, duree). Utile pendant le developpement.

---

## Categorie 7 — Scheduler

### 7.1 Planification visuelle
Calendrier affichant toutes les taches planifiees : backups, rapports, automatisations, maintenance. Vue journaliere, hebdomadaire, mensuelle. Couleurs par type.

### 7.2 Expression cron avancee
Editeur visuel de cron : selecteurs pour minutes, heures, jours du mois, mois, jours de la semaine. Preview des 10 prochaines executions. Validation de l'expression. Fuseau horaire explicite.

### 7.3 Taches systeme
Taches internes planifiees : purge des logs, nettoyage du cache, rotation des tokens, verification des certificats TLS, mise a jour des taux de change. Configurables mais pas supprimables.

### 7.4 Execution manuelle
Bouton `Executer maintenant` sur toute tache planifiee. N'affecte pas la prochaine execution prevue. Log de l'execution manuelle distincte de l'execution planifiee.

### 7.5 Dependencies entre taches
Definir des dependances : "Executer la tache B uniquement apres la fin de la tache A". Graphe de dependances visuel. Timeout si une dependance ne se termine pas.

---

## Categorie 8 — API Keys et securite

### 8.1 Gestion des API Keys
Interface de creation : nom, permissions (scopes), expiration, IP whitelist. Generation d'une cle aleatoire (256 bits). Affichage unique a la creation (non-stockee en clair ensuite). Copie en un clic.

### 8.2 Scopes granulaires
Chaque API key a des permissions fines : `read:contacts`, `write:calendar`, `admin:users`. Matrice de permissions par module SignApps. Principe du moindre privilege.

### 8.3 OAuth2 pour les integrations
Configuration d'applications OAuth2 : client_id, client_secret, redirect URIs, scopes autorises. Flux supportes : Authorization Code, Client Credentials. Token refresh automatique.

### 8.4 Credential vault
Stockage securise des credentials tiers (tokens API, mots de passe SMTP, cles SSH). Chiffrement au repos (AES-256). Acces restreint aux automatisations qui les utilisent. Rotation manuelle ou automatique.

### 8.5 Audit des acces API
Log de chaque appel API : timestamp, cle utilisee, endpoint, methode, IP source, reponse (status code), duree. Dashboard du trafic par cle. Detection d'anomalies (pic de requetes, IP inhabituelle).

### 8.6 Revocation de cle
Revocation immediate d'une API key. Toutes les requetes subsequentes retournent `401 Unauthorized`. Notification optionnelle au proprietaire de la cle. Historique des revocations.

### 8.7 Rate limiting par cle
Limites configurables par API key : requetes par minute, par heure, par jour. Limites differentes selon le scope. Dashboard de consommation par cle.

---

## Categorie 9 — Templates et marketplace

### 9.1 Templates pre-construits
Bibliotheque de templates d'automatisation prets a l'emploi :
- **Onboarding employe** : user.created → creer email, agenda, espace Drive, tache de bienvenue
- **Relance facture** : invoice.overdue → email de relance + tache commerciale
- **Alerte securite** : user.login (IP inhabituelle) → notification admin
- **Rapport hebdomadaire** : schedule lundi 9h → compiler stats → envoyer par email
- **Archivage automatique** : file.uploaded (type: facture) → copier vers dossier archive + taguer
- **Suivi de formulaire** : form.submitted → creer contact + envoyer confirmation + notifier equipe

### 9.2 Import/Export d'automatisations
Export d'une automatisation en JSON (definition complete sans secrets). Import dans une autre instance SignApps. Partage entre organisations.

### 9.3 Versioning des automatisations
Chaque modification d'une automatisation cree une version. Historique des versions avec diff. Rollback a une version precedente en un clic. Branche de test avant deploiement.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Zapier Learn** (zapier.com/learn) — guides pour construire des automatisations, best practices, tutorials par use case.
- **Make Academy** (academy.make.com) — cours sur les scenarios complexes, routers, error handling, data transformation.
- **n8n Documentation** (docs.n8n.io) — architecture des workflows, nodes reference, expressions, sub-workflows, error handling.
- **Pipedream Documentation** (pipedream.com/docs) — developer-first patterns, code steps, triggers, HTTP endpoints, event sources.
- **Workato Docs** (docs.workato.com) — enterprise automation patterns, recipes, governance, API management.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **n8n** (github.com/n8n-io/n8n) | **Sustainable Use License** | **INTERDIT** (license proprietaire). Reference pedagogique uniquement via la documentation publique. |
| **Automatisch** (github.com/automatisch/automatisch) | **AGPL-3.0 / MIT** | La partie MIT (frontend) est etudiant. Pattern de workflow visuel, nodes, triggers. Verifier chaque fichier. |
| **Huginn** (github.com/huginn/huginn) | **MIT** | Pattern d'agents autonomes, event propagation, scheduling, credential management. |
| **Windmill** (github.com/windmill-labs/windmill) | **AGPL-3.0** | **INTERDIT** (AGPL). Reference pedagogique uniquement. |
| **Temporal** (github.com/temporalio/temporal) | **MIT** | Pattern de workflow engine durable (retry, compensation, timeouts, versioning). Reference pour la resilience. |
| **Bull** (github.com/OptimalBits/bull) | **MIT** | Pattern de job queue avec retry, delay, backoff, rate limiting. Inspire notre gestion des executions. |
| **pg-boss** (github.com/timgit/pg-boss) | **MIT** | Job queue basee sur PostgreSQL. Pattern ideal pour notre PgEventBus + scheduling. |
| **jsonschema-rs** (github.com/Stranger6667/jsonschema-rs) | **MIT** | Validation JSON Schema en Rust. Pour valider les payloads d'evenements et de webhooks. |
| **reqwest** (github.com/seanmonstar/reqwest) | **MIT/Apache-2.0** | Client HTTP Rust async. Pour les actions HTTP et webhooks sortants. |
| **handlebars-rust** (github.com/sunng87/handlebars-rust) | **MIT** | Template engine Handlebars en Rust. Pour le templating des messages et des transformations. |
| **cron** (github.com/zslayton/cron) | **MIT/Apache-2.0** | Parser cron en Rust. Scheduling des taches periodiques. |

### Pattern d'implementation recommande
1. **Event bus** : PgEventBus existant (PostgreSQL LISTEN/NOTIFY + table d'evenements). Chaque service emet via `INSERT INTO events`. Les consumers lisent via NOTIFY ou polling.
2. **Workflow engine** : inspire de Temporal (MIT) — chaque workflow est une machine a etats persistee en base. Retry, compensation, timeouts geres au niveau du framework.
3. **Execution** : job queue PostgreSQL (pattern `pg-boss`, MIT). Chaque action est un job avec retry, backoff, dead letter.
4. **Templating** : `handlebars-rust` (MIT) pour le rendu des messages. Variables injectees depuis le payload de l'evenement.
5. **HTTP actions** : `reqwest` (MIT) avec timeout, retry, circuit breaker. Validation de la reponse (schema JSON, status code attendu).
6. **Webhooks** : signature HMAC-SHA256 avec secret par webhook. Retry exponentiel. Historique en base.
7. **Scheduler** : `cron` crate (MIT) pour le parsing. Execution via tokio avec `tokio::time::interval` ou job queue.

### Ce qu'il ne faut PAS faire
- **Pas de polling frequent** — utiliser les events du PgEventBus, pas un poll toutes les secondes.
- **Pas d'execution synchrone** — toutes les actions sont asynchrones avec timeout. Jamais de blocage du trigger.
- **Pas de secrets dans les payloads** — les credentials sont resolus au moment de l'execution, jamais stockes dans la definition du workflow.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque).
- **Pas d'execution non-auditee** — chaque execution est loggee avec les inputs/outputs (secrets masques).

---

## Assertions E2E cles (a tester)

- Creation d'une automatisation avec trigger `user.created` et action email
- Activation/desactivation d'une automatisation
- Declenchement effectif d'une automatisation lors d'un evenement reel
- Condition de filtre respectee (l'automatisation ne se declenche pas si la condition est fausse)
- Workflow multi-etapes : 3 actions en sequence
- Branchement conditionnel : execution de la bonne branche
- Webhook entrant : POST sur l'URL → automatisation declenchee
- Webhook sortant : evenement → POST vers URL externe avec signature HMAC
- Retry sur echec d'une action HTTP (simuler un 500)
- Dead letter queue : evenement en echec apres tous les retries
- Scheduler : execution cron a l'heure prevue
- Mode test : execution sans effet reel
- Execution pas a pas en mode debug
- Historique des executions avec detail etape par etape
- API key : creation, utilisation, revocation
- Rate limiting : reponse 429 au-dela de la limite
- Template pre-construit : import et activation
- Export/import d'une automatisation en JSON
