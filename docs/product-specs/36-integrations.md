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

Bouton `+ New Automation` en haut a droite. Filtres par statut, par trigger, par module source. Raccourci clavier : `Ctrl+N` cree une nouvelle automatisation. Recherche par nom ou par trigger. Tri par colonnes. Pastilles de statut : vert (ENABLED, aucune erreur recente), jaune (ENABLED, erreurs partielles), rouge (ERROR, plus de 50% d'echecs sur les 24h), gris (DISABLED). Compteur en haut : `24 automatisations | 18 actives | 2 en erreur`.

### 1.2 Assistant de creation
Workflow en 3 etapes :
1. **Trigger** : choisir l'evenement declencheur (liste groupee par module SignApps + webhooks + schedule). Chaque trigger affiche une description, un exemple de payload, et le nombre d'evenements emis dans les 24h. Recherche fuzzy dans la liste. Les triggers les plus utilises sont affiches en premier.
2. **Conditions** (optionnel) : filtres sur les donnees de l'evenement (ex: `file.size > 1048576`, `user.role == "admin"`). Interface de construction visuelle avec drag-and-drop de conditions. Mode avance : editeur texte pour les expressions complexes.
3. **Actions** : une ou plusieurs actions a executer (envoi email, creation tache, appel API, notification push). Ajout d'actions par `+ Ajouter une action`. Reordonnancement par drag-and-drop.

Bouton `Tester` a chaque etape pour valider la configuration. Bouton `Sauvegarder comme brouillon` pour revenir plus tard. Bouton `Activer` pour mettre en production.

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

Chaque trigger fournit un payload JSON type avec la structure de l'evenement. L'interface affiche le schema du payload avec les champs disponibles pour les conditions et les actions de mapping.

### 1.4 Trigger par schedule (cron)
Declenchement periodique sans evenement : toutes les X minutes/heures/jours, expression cron personnalisee. Fuseau horaire configurable (defaut : Europe/Paris). Exemples : "Chaque lundi a 9h, envoyer le rapport hebdomadaire", "Toutes les 15 minutes, verifier les factures en retard". Editeur cron visuel avec preview des 10 prochaines executions. Si le cron est invalide, message d'erreur inline : `Expression cron invalide. Exemple : 0 9 * * MON`.

### 1.5 Trigger par webhook entrant
Generation d'une URL unique `https://app.signapps.com/api/v1/webhooks/<uuid>`. Tout POST sur cette URL declenche l'automatisation avec le body comme payload. Validation optionnelle : HMAC signature (SHA-256 avec secret partage), IP whitelist, schema JSON. Utile pour les integrations externes (GitHub, Stripe, Slack). L'URL est affichee en lecture seule avec un bouton `Copier`. Un bouton `Regenerer` cree une nouvelle URL (l'ancienne est invalidee immediatement). Test : bouton `Envoyer un payload test` avec un editeur JSON inline. L'URL est stable et ne change pas meme si l'automatisation est modifiee (sauf regeneration explicite).

### 1.6 Conditions et filtres
Chaque trigger peut etre filtre par des conditions :
- **Egalite** : `event.user.role == "manager"`
- **Comparaison** : `event.file.size > 5242880`
- **Contient** : `event.email.subject contains "urgent"`
- **Regex** : `event.message.body matches /^ERROR:.*/`
- **Existence** : `event.metadata.priority exists`
- **Logique** : AND, OR, NOT pour combiner les conditions

Interface visuelle de construction de conditions (drag-and-drop) ou editeur texte pour les expressions avancees. Chaque condition affiche une preview du resultat : `Cette condition matcherait 42% des evenements recents`.

### 1.7 Debounce et throttle
Pour eviter les tempetes d'evenements :
- **Debounce** : attendre X secondes apres le dernier evenement avant d'executer (ex: eviter 10 notifications pour 10 modifications rapides d'un fichier). Configurable de 1s a 3600s.
- **Throttle** : maximum N executions par periode (ex: max 1 email par heure pour un meme utilisateur). Configurable par periode (minute, heure, jour).
- **Deduplication** : ignorer les evenements avec un ID deja traite dans les X dernieres minutes.

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

Chaque action affiche un formulaire avec les champs requis et optionnels. Les champs peuvent etre remplis avec des valeurs statiques ou des references au payload du trigger : `{{event.user.email}}`. Autocompletion des variables disponibles.

### 2.2 Actions HTTP (requete externe)
Module HTTP generique : methode (GET/POST/PUT/PATCH/DELETE), URL, headers, body (JSON/form-data/raw), authentification (Bearer, Basic, API Key, OAuth2). Parsing de la reponse : extraction JSON path, mapping vers les variables du workflow. Timeout configurable (defaut : 30s, max : 120s). Retry configurable : nombre de tentatives, delai entre tentatives (backoff exponentiel). Si la reponse est un 4xx, pas de retry (erreur client). Si 5xx ou timeout, retry selon la config.

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

L'interface affiche le workflow en pipeline vertical avec des connecteurs entre les etapes. Chaque etape est cliquable pour configurer les parametres. Les variables disponibles a chaque etape incluent le payload du trigger et les sorties de toutes les etapes precedentes : `{{step1.contact.name}}`, `{{step2.email.message_id}}`.

### 2.5 Branchement conditionnel (paths)
A une etape du workflow, definir des branches selon une condition : si `invoice.amount > 10000` → branche A (alerte manager), sinon → branche B (relance standard). Merge des branches apres execution. L'interface affiche un losange de decision avec les branches qui partent a gauche et a droite. Chaque branche peut contenir N actions. Maximum 5 niveaux d'imbrication.

### 2.6 Boucles (iterators)
Pour traiter une liste d'elements : recevoir un evenement avec un tableau → iterer sur chaque element → executer une action par element. Exemple : formulaire avec liste de participants → creer un contact pour chacun. Limite de securite : maximum 100 iterations par execution (configurable). Au-dela, l'execution est marquee en erreur : `Iteration limit exceeded (100). Increase limit or split data.`.

### 2.7 Gestion des erreurs
Configuration par action : retry (nombre, delai, backoff), action de fallback en cas d'echec definitif, notification d'erreur. Dead letter queue pour les evenements non-traitables. Workflow d'erreur dedie (ex: envoyer un email a l'admin si une automation echoue). Chaque action a un toggle `Continuer en cas d'erreur` : si active, le workflow continue meme si cette action echoue (l'erreur est loggee).

### 2.8 Sous-workflows (callable)
Definir un workflow reutilisable appele par d'autres workflows. Parametres d'entree/sortie types. Exemple : "Envoyer notification multi-canal" = email + push + chat, appele depuis plusieurs automatisations. API : `POST /api/v1/automations/:id/invoke` avec body `{ "params": { ... } }`.

### 2.9 Pre-built connectors (Slack/Teams/Discord)
Connecteurs pre-configures pour les plateformes de messagerie externes :
- **Slack** : poster un message dans un channel, envoyer un DM, reagir a un message. Support de Block Kit pour le formatage riche (sections, boutons, dropdowns, images). Configuration OAuth2 pour l'installation de l'app Slack.
- **Microsoft Teams** : poster dans un channel/chat, creer une Adaptive Card, mentionner un utilisateur. Webhook entrant Teams pour la simplification.
- **Discord** : poster via webhook Discord, support d'embeds riches (titre, description, couleur, champs, image, footer).

Chaque connecteur a un formulaire de configuration dedie avec preview du message. Les tokens et secrets sont stockes dans le vault (jamais en clair). API de test : `POST /api/v1/integrations/connectors/:type/test`.

### 2.10 Zapier-style recipe templates
Bibliotheque de templates d'automatisation pre-construits :
- **Onboarding employe** : `user.created` → creer email + agenda + espace Drive + tache de bienvenue
- **Relance facture** : `invoice.overdue` → email de relance + tache commerciale
- **Alerte securite** : `user.login` (IP inhabituelle) → notification admin + log
- **Rapport hebdomadaire** : cron lundi 9h → compiler stats → envoyer par email
- **Archivage automatique** : `file.uploaded` (type: facture) → copier vers archive + taguer
- **Suivi de formulaire** : `form.submitted` → creer contact + email confirmation + notifier equipe
- **Slack digest** : cron 17h → compiler les evenements du jour → poster dans #general
- **Welcome email** : `user.created` → email de bienvenue personnalise

Chaque template est cliquable pour voir la description, les etapes, et un bouton `Utiliser ce template`. Le template pre-remplit l'automatisation, l'utilisateur personnalise les details (channel, emails, textes) puis active.

---

## Categorie 3 — Webhooks sortants

### 3.1 Configuration de webhooks (CRUD)
Interface de creation : URL de destination, evenements a ecouter (selection multiple depuis la liste des triggers), format (JSON), methode (POST), headers custom, secret pour la signature HMAC. Bouton `+ Nouveau webhook`. Formulaire avec validation inline : l'URL doit commencer par `https://` (HTTP non-securise bloque sauf pour localhost en dev). Le secret est genere automatiquement (256 bits) si non fourni. Bouton `Copier le secret` (affiche une seule fois a la creation, non recuperable ensuite).

CRUD complet : creer, lire, modifier, supprimer. La suppression demande confirmation : `Supprimer le webhook "Stripe events" ? Aucune notification ne sera envoyee a cette URL.`. Activation/desactivation par toggle sans suppression. Liste des webhooks avec colonnes : nom, URL, evenements (badges), statut (actif/inactif), derniere livraison, taux de succes. API : `POST /api/v1/webhooks/outbound`, `GET /api/v1/webhooks/outbound`, `PATCH /api/v1/webhooks/outbound/:id`, `DELETE /api/v1/webhooks/outbound/:id`.

### 3.2 Signature HMAC
Chaque webhook sortant est signe avec un secret partage (HMAC-SHA256). Header `X-Signature-256` contient la signature. Le destinataire peut verifier l'authenticite. Documentation du processus de verification fournie dans l'interface : code d'exemple en Node.js, Python, Go, Rust pour valider la signature.

### 3.3 Retry et delivery
En cas d'echec de livraison (timeout, 5xx) : retry automatique avec backoff exponentiel (1s, 5s, 30s, 5min, 30min, 2h). Maximum 6 tentatives. Notification apres echec definitif via PgEventBus `webhook.delivery.failed`. Option de replay manuel depuis l'historique. Si le destinataire repond systematiquement en erreur (10 echecs consecutifs), le webhook est automatiquement desactive avec notification au proprietaire.

### 3.4 Historique des livraisons (execution log)
Log de chaque webhook envoye : timestamp, URL, payload (masque pour les secrets), reponse (status code, body tronque a 1000 chars), duree, tentative numero. Filtres par webhook, par statut, par date. Rejeu en un clic (bouton `Rejouer`). Detail complet : headers envoyes, headers recus, body complet de la requete et de la reponse. Retention des logs : 30 jours. API : `GET /api/v1/webhooks/outbound/:id/deliveries`.

### 3.5 Webhook de test
Bouton `Envoyer un test` avec un payload d'exemple pre-genere par type d'evenement. Verification que le destinataire recoit et repond correctement. Affichage de la reponse dans l'interface (status code, headers, body). Si le test echoue, message d'erreur : `Test echoue : 502 Bad Gateway — verifiez que l'URL est accessible.`.

---

## Categorie 4 — Webhooks entrants et recepteur JSON

### 4.1 Webhooks entrants
Chaque automatisation avec un trigger webhook genere une URL unique. Le recepteur accepte les payloads JSON sur POST. Validation optionnelle : schema JSON (rejet si le payload ne correspond pas), HMAC verification (si un secret est configure), IP whitelist. Taille maximale du payload : 1 Mo. Au-dela, reponse `413 Payload Too Large`.

### 4.2 Parsing JSON automatique
Le payload JSON recu est automatiquement parse et les champs sont disponibles dans les conditions et les actions via dot notation : `body.user.name`, `body.items[0].id`. Si le Content-Type n'est pas `application/json`, le body est traite comme texte brut et disponible dans `body.raw`. Headers disponibles via `headers.X-Custom-Header`.

### 4.3 Reponse configuree
Par defaut, le webhook repond `200 OK` avec `{ "status": "accepted" }`. L'utilisateur peut configurer une reponse custom : status code, body JSON, headers. Utile pour les services qui attendent une reponse specifique (ex: Slack challenge verification).

### 4.4 Securite des webhooks entrants
- **HMAC** : verification de `X-Signature-256` avec le secret configure
- **IP whitelist** : liste d'adresses IP autorisees (CIDR supportee : `10.0.0.0/8`)
- **Rate limiting** : maximum 100 requetes par minute par URL webhook (configurable)
- **Expiration** : option de date d'expiration pour les URL temporaires

---

## Categorie 5 — API Key Management

### 5.1 Gestion des API Keys (generate/revoke)
Interface de creation : nom, permissions (scopes), expiration, IP whitelist. Generation d'une cle aleatoire (256 bits, format `sk_live_xxxx...`). Affichage unique a la creation (non-stockee en clair ensuite — seul le hash est conserve). Copie en un clic. Avertissement : `Cette cle ne sera plus affichee. Copiez-la maintenant.`. Liste des cles : nom, date de creation, dernier usage, expiration, scopes (badges), statut (active/revoquee). Bouton `Revoquer` avec confirmation. API : `POST /api/v1/api-keys`, `GET /api/v1/api-keys`, `DELETE /api/v1/api-keys/:id`.

### 5.2 Scopes granulaires (permissions)
Chaque API key a des permissions fines : `read:contacts`, `write:calendar`, `admin:users`. Matrice de permissions par module SignApps. Principe du moindre privilege. Interface : grille de checkboxes par module (lecture, ecriture, admin). Presets : `Read Only`, `Read/Write`, `Full Access`. Si une requete utilise une cle sans le scope requis, reponse `403 Forbidden` avec `{ "error": "insufficient_scope", "required": "write:calendar" }`.

### 5.3 Rate limiting par API key
Limites configurables par API key : requetes par minute (defaut : 60), par heure (defaut : 1000), par jour (defaut : 10000). Limites differentes selon le scope. Reponse `429 Too Many Requests` avec headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Dashboard de consommation par cle : graphique des requetes par heure, top endpoints utilises.

### 5.4 OAuth2 App Registration
Configuration d'applications OAuth2 : client_id, client_secret, redirect URIs, scopes autorises. Flux supportes : Authorization Code (recommande pour les apps web), Client Credentials (pour les services machine-to-machine). Token refresh automatique. Interface d'enregistrement : formulaire avec nom de l'app, description, redirect URIs (un par ligne), logo optionnel. Apres creation, affichage du client_id et client_secret (une seule fois). API : `POST /api/v1/oauth/apps`, `GET /api/v1/oauth/apps`.

### 5.5 Audit des acces API
Log de chaque appel API : timestamp, cle utilisee (hash), endpoint, methode, IP source, reponse (status code), duree. Dashboard du trafic par cle. Detection d'anomalies (pic de requetes, IP inhabituelle). Alerte si une cle est utilisee depuis une IP non-whitelistee. Retention des logs : 90 jours. Export CSV.

### 5.6 Revocation de cle
Revocation immediate d'une API key. Toutes les requetes subsequentes retournent `401 Unauthorized`. Notification optionnelle au proprietaire de la cle par email. Historique des revocations. La revocation est irreversible — une nouvelle cle doit etre generee.

---

## Categorie 6 — Automation Builder (trigger→action)

### 6.1 Interface visuelle when X → do Y
Ecran de construction d'automatisations en mode visuel : colonne gauche pour le trigger (WHEN), colonne droite pour les actions (DO). Connexion visuelle par une fleche. Clic sur le trigger ouvre le panneau de configuration. Clic sur l'action ouvre le formulaire. Bouton `+ Ajouter une action` sous la derniere action. Les actions sont numerotees (1, 2, 3...) et connectees en sequence.

### 6.2 Editeur de code inline
Pour les cas avances : un noeud `Code` dans le workflow. Editeur Monaco (syntaxe JavaScript/TypeScript) avec autocompletion des variables du workflow. Exemple : `const amount = event.invoice.amount; return amount > 10000 ? "high" : "normal";`. Le resultat est disponible pour les actions suivantes via `{{code_step.result}}`. Sandbox securisee : pas d'acces au filesystem, pas de requetes reseau (utiliser le noeud HTTP pour ca), timeout 10 secondes.

### 6.3 Variables et mapping
Chaque etape du workflow produit des variables accessibles dans les etapes suivantes. Panneau lateral `Variables disponibles` avec arborescence navigable. Clic sur une variable l'insere dans le champ en cours d'edition. Syntaxe : `{{trigger.user.email}}`, `{{step1.response.body.id}}`, `{{env.CUSTOM_VAR}}`. Preview en temps reel : affichage de la valeur resolue a cote de la variable (basee sur la derniere execution ou les donnees de test).

---

## Categorie 7 — Evenements et bus

### 7.1 Event Explorer
Interface de consultation des evenements du PgEventBus en temps reel. Flux scrollable avec filtre par type, par service source, par periode. Detail de chaque evenement : type, timestamp, payload JSON (formatage syntaxique), consommateurs (qui a consomme cet evenement). Actualisation temps reel via SSE. Bouton pause pour figer le flux. Recherche par mot-cle dans les payloads.

### 7.2 Schema des evenements
Chaque type d'evenement a un schema JSON documente : champs obligatoires, optionnels, types, exemples. Validation du payload avant emission. Versioning des schemas (v1, v2). Interface : liste des types d'evenements avec schema, exemple de payload, et nombre d'emissions recentes.

### 7.3 Event replay
Rejouer un evenement specifique pour re-declencher les automatisations associees. Utile pour le debug et les corrections. Option : replay avec dry-run (pas d'execution reelle). API : `POST /api/v1/events/:id/replay?dry_run=true`.

### 7.4 Dead letter queue
Les evenements qui echouent apres tous les retries sont stockes dans une DLQ. Interface de consultation avec le motif d'echec. Actions : retry manuel, supprimer, envoyer a une autre destination. Compteur dans le dashboard : `DLQ : 3 evenements en attente`. Alerte si la DLQ depasse un seuil (defaut : 10).

### 7.5 Metriques d'evenements
Dashboard : evenements emis par minute/heure, par type, par service. Latence de traitement (temps entre emission et execution de l'action). Taux d'echec. Graphiques temps reel.

---

## Categorie 8 — Testing et debug

### 8.1 Mode test (dry-run)
Executer une automatisation avec des donnees fictives sans effet reel. Les actions internes (email, notification, tache) sont simulees et le resultat est affiche sans envoi/creation effectifs. Badge `TEST` dans l'historique des executions. L'API retourne le meme resultat mais avec `"dry_run": true` dans la reponse.

### 8.2 Execution pas a pas
Mode debug : executer le workflow action par action. A chaque etape, voir les donnees d'entree, le resultat, et choisir de continuer ou d'annuler. Modification des donnees a la volee pour tester differents scenarios. Interface : panneau de debug avec le workflow en vue pipeline, chaque etape coloree (gris: pas execute, bleu: en cours, vert: succes, rouge: erreur). Bouton `Etape suivante` pour avancer.

### 8.3 Historique des executions (execution log)
Pour chaque automatisation : log de toutes les executions avec timestamp, trigger data, actions executees, duree, statut (success/error/skipped). Drill-down dans chaque execution pour voir les details etape par etape : input, output, duree, status code pour les actions HTTP. Retention : 30 jours. Filtres : par statut, par date, par duree (>1s pour les executions lentes). API : `GET /api/v1/automations/:id/executions`.

Le log affiche pour chaque execution :
- **Request** : payload du trigger (masque pour les champs sensibles)
- **Response** : resultat de chaque action (headers, body, status)
- **Duree** : temps total et temps par etape
- **Erreurs** : stack trace si une action a echoue

### 8.4 Simulateur de payload
Editeur JSON pour creer un payload de test. Templates pre-remplis par type d'evenement (ex: payload `user.created` avec des donnees fictives). Validation contre le schema. Bouton `Simuler` pour voir le chemin d'execution sans declenchement reel.

### 8.5 Notifications de debug
Option par automatisation : recevoir une notification (email/push) a chaque execution avec le resume (trigger, actions, resultat, duree). Utile pendant le developpement. Desactivable en production.

---

## Categorie 9 — Scheduler

### 9.1 Planification visuelle
Calendrier affichant toutes les taches planifiees : backups, rapports, automatisations, maintenance. Vue journaliere, hebdomadaire, mensuelle. Couleurs par type. Integration avec le module Calendar.

### 9.2 Expression cron avancee
Editeur visuel de cron : selecteurs pour minutes, heures, jours du mois, mois, jours de la semaine. Preview des 10 prochaines executions. Validation de l'expression. Fuseau horaire explicite. Erreur inline si l'expression est invalide.

### 9.3 Taches systeme
Taches internes planifiees : purge des logs, nettoyage du cache, rotation des tokens, verification des certificats TLS, mise a jour des taux de change. Configurables mais pas supprimables. Badge `Systeme` pour les distinguer des taches utilisateur.

### 9.4 Execution manuelle
Bouton `Executer maintenant` sur toute tache planifiee. N'affecte pas la prochaine execution prevue. Log de l'execution manuelle distincte de l'execution planifiee.

### 9.5 Dependencies entre taches
Definir des dependances : "Executer la tache B uniquement apres la fin de la tache A". Graphe de dependances visuel. Timeout si une dependance ne se termine pas dans le delai imparti.

---

## Categorie 10 — Templates et marketplace

### 10.1 Templates pre-construits
Voir section 2.10 pour la liste complete des templates.

### 10.2 Import/Export d'automatisations
Export d'une automatisation en JSON (definition complete sans secrets). Import dans une autre instance SignApps. Partage entre organisations. Bouton `Exporter` genere un fichier `.signapps-automation.json`. Bouton `Importer` accepte ce fichier et cree l'automatisation en mode brouillon. Les credentials references sont marques comme `<non-configure>` et doivent etre remplies avant activation.

### 10.3 Versioning des automatisations
Chaque modification d'une automatisation cree une version. Historique des versions avec diff (quels champs ont change entre v3 et v4). Rollback a une version precedente en un clic. Branche de test avant deploiement.

---

## Schema PostgreSQL

```sql
-- Automatisations
CREATE TABLE automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('event', 'webhook', 'schedule')),
    trigger_config JSONB NOT NULL,
    conditions JSONB,
    actions JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled', 'error', 'draft')),
    debounce_seconds INTEGER DEFAULT 0,
    throttle_max INTEGER,
    throttle_period VARCHAR(10),
    version INTEGER NOT NULL DEFAULT 1,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_execution_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_automations_org ON automations(org_id);
CREATE INDEX idx_automations_status ON automations(org_id, status);
CREATE INDEX idx_automations_trigger ON automations(trigger_type);

-- Versions d'automatisations
CREATE TABLE automation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    definition JSONB NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(automation_id, version)
);

-- Executions d'automatisations
CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id),
    trigger_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'skipped', 'cancelled')),
    is_dry_run BOOLEAN NOT NULL DEFAULT false,
    is_manual BOOLEAN NOT NULL DEFAULT false,
    steps JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_automation_executions_auto ON automation_executions(automation_id);
CREATE INDEX idx_automation_executions_status ON automation_executions(status);
CREATE INDEX idx_automation_executions_started ON automation_executions(started_at DESC);

-- Webhooks sortants
CREATE TABLE webhooks_outbound (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    url VARCHAR(2000) NOT NULL,
    events TEXT[] NOT NULL,
    secret_hash VARCHAR(128) NOT NULL,
    headers JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failure_count INTEGER NOT NULL DEFAULT 0,
    auto_disabled BOOLEAN NOT NULL DEFAULT false,
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status INTEGER,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_outbound_org ON webhooks_outbound(org_id);

-- Livraisons de webhooks
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks_outbound(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    request_url VARCHAR(2000) NOT NULL,
    request_headers JSONB NOT NULL,
    request_body JSONB NOT NULL,
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    duration_ms INTEGER,
    attempt_number SMALLINT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'pending', 'retrying')),
    error_message TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);

-- Webhooks entrants
CREATE TABLE webhooks_inbound (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    url_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    secret_hash VARCHAR(128),
    ip_whitelist TEXT[],
    json_schema JSONB,
    rate_limit_per_minute INTEGER DEFAULT 100,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    scopes TEXT[] NOT NULL,
    ip_whitelist TEXT[],
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    rate_limit_per_day INTEGER DEFAULT 10000,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- OAuth2 Applications
CREATE TABLE oauth_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    client_id VARCHAR(64) NOT NULL UNIQUE,
    client_secret_hash VARCHAR(128) NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    scopes TEXT[] NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dead letter queue
CREATE TABLE integration_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    event_payload JSONB NOT NULL,
    automation_id UUID REFERENCES automations(id),
    error_message TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 6,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retried', 'discarded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_dead_letters_status ON integration_dead_letters(status);

-- API access log
CREATE TABLE api_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id),
    oauth_app_id UUID REFERENCES oauth_apps(id),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address INET NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_access_log_key ON api_access_log(api_key_id, created_at DESC);
```

---

## PgEventBus Events

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `automation.created` | `{ org_id, automation_id, name, trigger_type }` | Integrations | Audit |
| `automation.enabled` | `{ org_id, automation_id }` | Integrations | Audit |
| `automation.disabled` | `{ org_id, automation_id, reason }` | Integrations | Audit |
| `automation.executed` | `{ automation_id, execution_id, status, duration_ms }` | Integrations | Dashboard, Metrics |
| `automation.error` | `{ automation_id, execution_id, error_message }` | Integrations | Alerts, Notifications |
| `webhook.delivery.success` | `{ webhook_id, delivery_id, event_type }` | Integrations | Metrics |
| `webhook.delivery.failed` | `{ webhook_id, delivery_id, error, attempts }` | Integrations | Alerts, Notifications |
| `webhook.auto_disabled` | `{ webhook_id, consecutive_failures }` | Integrations | Notifications |
| `api_key.created` | `{ org_id, key_id, name, scopes }` | Integrations | Audit |
| `api_key.revoked` | `{ org_id, key_id, revoked_by }` | Integrations | Audit, Notifications |
| `api_key.rate_limited` | `{ key_id, endpoint, limit }` | Integrations | Metrics, Alerts |
| `dead_letter.added` | `{ dlq_id, event_type, error }` | Integrations | Alerts |

---

## REST API Endpoints

```
# Automations
GET    /api/v1/automations                              — List automations (filter: status, trigger_type)
POST   /api/v1/automations                              — Create automation
GET    /api/v1/automations/:id                           — Get automation details
PATCH  /api/v1/automations/:id                           — Update automation
DELETE /api/v1/automations/:id                           — Delete automation
POST   /api/v1/automations/:id/enable                    — Enable automation
POST   /api/v1/automations/:id/disable                   — Disable automation
POST   /api/v1/automations/:id/test                      — Test automation (dry-run)
POST   /api/v1/automations/:id/invoke                    — Invoke sub-workflow
GET    /api/v1/automations/:id/executions                — List executions
GET    /api/v1/automations/:id/versions                  — List versions
POST   /api/v1/automations/:id/rollback                  — Rollback to version
POST   /api/v1/automations/import                        — Import from JSON
GET    /api/v1/automations/:id/export                    — Export to JSON

# Webhooks Outbound
GET    /api/v1/webhooks/outbound                         — List outbound webhooks
POST   /api/v1/webhooks/outbound                         — Create outbound webhook
PATCH  /api/v1/webhooks/outbound/:id                     — Update webhook
DELETE /api/v1/webhooks/outbound/:id                     — Delete webhook
POST   /api/v1/webhooks/outbound/:id/test                — Send test payload
GET    /api/v1/webhooks/outbound/:id/deliveries          — List delivery history
POST   /api/v1/webhooks/outbound/:id/deliveries/:did/replay — Replay a delivery

# Webhooks Inbound
POST   /api/v1/webhooks/:token                           — Receive inbound webhook

# API Keys
GET    /api/v1/api-keys                                  — List API keys
POST   /api/v1/api-keys                                  — Create API key
GET    /api/v1/api-keys/:id                              — Get key details (no secret)
DELETE /api/v1/api-keys/:id                              — Revoke API key
GET    /api/v1/api-keys/:id/usage                        — Usage statistics

# OAuth Apps
GET    /api/v1/oauth/apps                                — List OAuth applications
POST   /api/v1/oauth/apps                                — Register OAuth app
PATCH  /api/v1/oauth/apps/:id                            — Update OAuth app
DELETE /api/v1/oauth/apps/:id                            — Delete OAuth app
POST   /api/v1/oauth/authorize                           — OAuth2 Authorization endpoint
POST   /api/v1/oauth/token                               — OAuth2 Token endpoint

# Event Bus
GET    /api/v1/events/stream                             — SSE stream of events (filter: type)
GET    /api/v1/events/types                              — List all event types with schemas
POST   /api/v1/events/:id/replay                         — Replay an event

# Dead Letter Queue
GET    /api/v1/integrations/dlq                          — List dead letters
POST   /api/v1/integrations/dlq/:id/retry                — Retry a dead letter
DELETE /api/v1/integrations/dlq/:id                      — Discard a dead letter

# Connectors
GET    /api/v1/integrations/connectors                   — List available connectors
POST   /api/v1/integrations/connectors/:type/test        — Test connector config

# Templates
GET    /api/v1/automations/templates                     — List automation templates
POST   /api/v1/automations/templates/:id/use             — Create automation from template
```

Auth JWT. Rate limiting : 100 req/min per API key.

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
| **Automatisch** (github.com/automatisch/automatisch) | **AGPL-3.0 / MIT** | La partie MIT (frontend) est etudiable. Pattern de workflow visuel, nodes, triggers. Verifier chaque fichier. |
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
- Workflow multi-etapes : 3 actions en sequence avec passage de variables
- Branchement conditionnel : execution de la bonne branche
- Iterator : traitement de 5 elements d'un tableau
- Webhook entrant : POST sur l'URL → automatisation declenchee
- Webhook entrant avec validation HMAC (rejet si signature invalide)
- Webhook sortant CRUD : creation, modification, suppression
- Webhook sortant : evenement → POST vers URL externe avec signature HMAC
- Historique des livraisons webhook avec request/response
- Rejeu d'une livraison webhook depuis l'historique
- Retry sur echec d'une action HTTP (simuler un 500)
- Auto-desactivation d'un webhook apres 10 echecs consecutifs
- Dead letter queue : evenement en echec apres tous les retries
- Scheduler : execution cron a l'heure prevue
- Mode test : execution sans effet reel
- Execution pas a pas en mode debug
- Historique des executions avec detail etape par etape et request/response
- API key : creation, utilisation, revocation
- API key : scopes respectes (403 si scope manquant)
- Rate limiting : reponse 429 au-dela de la limite avec headers corrects
- OAuth2 : enregistrement d'app, authorization code flow, token refresh
- Connecteur Slack : poster un message avec Block Kit
- Connecteur Discord : poster un embed riche
- Template pre-construit : import et activation
- Export/import d'une automatisation en JSON
- Versioning : rollback a une version precedente
- Event Explorer : flux temps reel avec filtre par type
- Simulateur de payload : test avec donnees fictives
