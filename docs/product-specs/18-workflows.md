# Module Workflows / Automation — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Zapier** | Leader avec 5000+ intégrations, no-code, multi-step, Paths (branches), Filter, Delay, Webhooks, OpenAI native, AI transforms, scheduled, instant triggers |
| **Make (Integromat)** | Visual builder très puissant, scenarios complexes, router, iterator, aggregator, error handling, advanced operations, Team, 1700+ apps |
| **n8n** | Open source (Apache-2.0 → Sustainable Use License now), self-hostable, fair-code, 400+ nodes, complex workflows, custom nodes, JavaScript code nodes |
| **Workato** | Enterprise, low-code, recipes, bots, connectors, RPA, data pipelines |
| **Pipedream** | Developer-first, unlimited code, 2000+ apps, open source components, TypeScript, scheduled |
| **Airflow** (Apache) | Data engineering, DAGs, Python, Kubernetes executor, scheduler, XCom, plugins |
| **Temporal** | Durable workflows for developers, code-first, long-running tasks, signals, queries |
| **Automate.io** | Simple, acquired by Notion |
| **Tray.io** | Enterprise iPaaS, advanced logic, data transformations |
| **Parabola** | Data workflows for non-technical, steps, transforms |
| **IFTTT** | Personal automations, smart home, simple if-this-then-that |
| **Huginn** (open source) | Ruby, self-hosted, agents, no UI builder |

## Principes directeurs

1. **No-code + pro-code hybride** — visual builder pour les flux simples, code inline (JS/Python) pour les cas complexes.
2. **Triggers et actions riches** — beaucoup d'intégrations built-in avec les autres modules SignApps et avec les services externes.
3. **Debugging facile** — exécution step-by-step, logs clairs, replay d'exécution.
4. **Résilience** — retry, error handling, timeouts, idempotency pour les workflows long-running.
5. **Versioning** — historique des versions du workflow, rollback possible.
6. **Collaboration** — plusieurs utilisateurs peuvent éditer un workflow, commentaires, approbations.

---

## Catégorie 1 — Builder visuel

### 1.1 Canvas drag-drop
Canvas infini où on place les nodes (triggers, actions, conditions) et on les connecte par des lignes. Zoom, pan, grid snap.

### 1.2 Palette des nodes
Sidebar gauche avec la liste des nodes disponibles : triggers, actions, logic (condition, loop, delay, code), apps (intégrations avec les autres modules SignApps et les services externes).

### 1.3 Configuration d'un node
Clic sur un node → panneau de configuration à droite avec ses paramètres. Formulaires dynamiques selon le type.

### 1.4 Connexions entre nodes
Drag depuis le connecteur de sortie d'un node vers l'entrée d'un autre. Les données passent automatiquement d'un node au suivant.

### 1.5 Multi-branches
Un trigger peut mener à plusieurs branches parallèles. Un condition peut router vers différentes branches selon la valeur.

### 1.6 Merge branches
Re-merger plusieurs branches avant une action suivante.

### 1.7 Loop (iterator)
Un node `Loop` pour itérer sur une collection (ex: pour chaque item d'une liste, faire une action).

### 1.8 Sub-workflows
Extraire une séquence en sub-workflow réutilisable. Appeler un sub-workflow depuis un autre.

### 1.9 Undo / Redo
Historique des modifications du workflow. Ctrl+Z/Y.

### 1.10 Save drafts
Sauvegarder un brouillon non publié. Travail en cours sans impact sur le workflow en production.

### 1.11 Templates
Galerie de templates : "New lead to CRM", "Send Slack when deal won", "Daily report to email", etc.

### 1.12 Copy/paste nodes
Copier un node ou une sélection de nodes et les coller ailleurs.

### 1.13 Minimap
Mini-vue d'ensemble pour naviguer dans les gros workflows.

### 1.14 Auto-layout
Bouton pour arranger automatiquement les nodes dans une disposition propre.

### 1.15 Comments sur les nodes
Ajouter des commentaires sur un node ou une zone du canvas pour documenter.

### 1.16 Group nodes
Grouper plusieurs nodes dans une zone nommée (pour la lisibilité des gros workflows).

---

## Catégorie 2 — Triggers

### 2.1 Scheduled (cron)
Déclenchement à une heure fixe : daily, weekly, monthly, custom cron expression.

### 2.2 Webhook entrant
Génération d'une URL unique qui, quand elle reçoit un POST/GET, déclenche le workflow avec les données du body.

### 2.3 Email received
Trigger sur la réception d'un email dans un dossier ou avec un filtre.

### 2.4 Form submitted
Trigger sur la soumission d'un formulaire (module Forms).

### 2.5 Record created / updated / deleted
Trigger sur les CRUD d'une base signapps-db : contact, deal, task, ticket, etc.

### 2.6 Message received (chat)
Trigger sur un nouveau message dans un channel ou une mention.

### 2.7 Calendar event
Trigger sur : nouveau meeting, meeting dans X minutes, meeting cancelled.

### 2.8 Manual trigger
Bouton pour déclencher manuellement. Utilisé pour les workflows one-shot.

### 2.9 Polling
Polling régulier d'une API externe pour détecter des changements.

### 2.10 Watch file (drive)
Trigger sur un nouveau fichier dans un dossier drive ou modification d'un fichier existant.

### 2.11 Slack / Teams message
Trigger sur un message dans un channel externe (Slack, Teams).

### 2.12 GitHub / GitLab webhook
Trigger sur : push, PR, issue, release. Via webhook de l'outil Git.

### 2.13 HTTP request
Trigger sur un call HTTP vers une URL spécifique.

### 2.14 Database change
Trigger sur un change direct en DB (polling ou CDC).

### 2.15 Time-based (delay)
Trigger après X temps (ex: 24h après la création d'un ticket).

---

## Catégorie 3 — Actions

### 3.1 Actions internes (modules SignApps)
- **Mail** : envoyer un email, créer un brouillon, archiver, déplacer
- **Calendar** : créer un événement, inviter, modifier
- **Docs** : créer un doc, commenter, partager
- **Drive** : upload, download, partager, supprimer
- **Tasks** : créer une tâche, assigner, marquer terminée
- **CRM** : créer contact/deal/activité, update, assigner
- **Helpdesk** : créer ticket, assigner, escalate
- **Chat** : envoyer message, créer channel, inviter
- **Forms** : pré-remplir, soumettre
- **Vault** : stocker un secret, générer un password
- **HR** : créer un employé, déclencher onboarding
- **Billing** : créer facture, envoyer, relancer
- **Contacts** : créer, mettre à jour, merger

### 3.2 HTTP request
Faire un call HTTP (GET, POST, PUT, DELETE) vers n'importe quelle API. Headers, body, auth (basic, bearer, OAuth).

### 3.3 Webhook sortant
Envoyer les données vers une URL externe.

### 3.4 Transform data
Transformer les données (regex, JSON path, formatting). Langage d'expressions simple.

### 3.5 JavaScript / Python code
Node "code" pour écrire du JS ou Python inline. Sandbox sécurisé. Input = données précédentes, output = données pour les nodes suivants.

### 3.6 LLM prompt
Node AI : appeler un LLM avec un prompt (statique ou dynamique) et récupérer la réponse. Models : Claude, GPT-4, Gemini, ou local.

### 3.7 AI extract data
Extraire des champs structurés depuis du texte (email, formulaire libre) via un LLM.

### 3.8 AI classify
Classifier un item dans une catégorie (spam/not spam, positif/négatif) via LLM ou modèle ML.

### 3.9 AI summarize
Résumer un texte long en quelques phrases.

### 3.10 AI translate
Traduire un texte dans une autre langue.

### 3.11 OCR
Extraire le texte d'une image ou d'un PDF scanné.

### 3.12 Send SMS
Envoyer un SMS via Twilio ou autre provider.

### 3.13 Send push notification
Notification push à un utilisateur SignApps ou externe.

### 3.14 Post to Slack / Teams / Discord
Envoyer un message à un channel externe.

### 3.15 Create calendar event
Créer un événement (Google Calendar, Outlook, SignApps Calendar).

### 3.16 Database query
Exécuter une query SQL sur une DB externe.

### 3.17 File manipulation
Créer, lire, modifier, copier, supprimer des fichiers.

### 3.18 CSV/JSON/XML parse et generate
Parser et générer des formats de données courants.

### 3.19 Email send (raw SMTP)
Envoyer un email via un SMTP custom (pour les cas où on ne passe pas par le module Mail).

### 3.20 FTP/SFTP upload/download
Transfert de fichiers FTP.

---

## Catégorie 4 — Logic / Control flow

### 4.1 Condition (if/else)
Node condition : `Si champ X == Y ALORS branche A, SINON branche B`. Opérateurs : =, !=, >, <, contains, starts with, ends with, exists, is empty.

### 4.2 Multiple conditions
`If (X=Y AND Z>5) OR (W contains "bug")`. Group d'opérandes.

### 4.3 Switch / Route
Plusieurs cases comme un switch : `Si type = A → branche 1, si B → branche 2, sinon → default`.

### 4.4 Loop (for each)
Itérer sur une liste d'items. Chaque itération exécute la séquence suivante.

### 4.5 While loop
Boucle tant qu'une condition est vraie. Avec limite max pour éviter les infinite loops.

### 4.6 Delay
Attendre X secondes/minutes/heures avant de continuer. Utilisé pour le rate limiting ou les workflows différés.

### 4.7 Scheduled wait
Attendre jusqu'à une date/heure spécifique (ex: "Attendre jusqu'au lundi 9h").

### 4.8 Wait for event
Mettre le workflow en pause jusqu'à un event externe (ex: réception d'un email, signature d'un document).

### 4.9 Manual approval
Pause jusqu'à ce qu'un humain approuve via un bouton dans une notification ou un email.

### 4.10 Parallel execution
Lancer plusieurs actions en parallèle et attendre qu'elles terminent toutes.

### 4.11 Try/Catch (error handling)
Branche alternative en cas d'erreur d'un node. Récupération ou notification.

### 4.12 Retry
En cas d'échec d'un node (HTTP timeout par exemple), retry X fois avec backoff exponentiel.

### 4.13 Timeout
Limite de temps sur un node ou un workflow. Après timeout, échec.

### 4.14 Aggregator
Aggréger les résultats de plusieurs itérations d'un loop en un seul dataset pour la suite.

### 4.15 Filter
Filtrer une liste d'items selon un critère. Seuls ceux qui matchent passent au node suivant.

### 4.16 Rate limit
Limiter le nombre d'exécutions par minute/heure pour respecter les limites d'une API externe.

### 4.17 Break / Continue
Dans une loop, sauter l'itération courante ou sortir de la loop.

### 4.18 Dead letter queue
Si un item échoue trop de fois, le placer dans une DLQ pour traitement manuel ultérieur.

---

## Catégorie 5 — Data handling

### 5.1 Expressions engine
Langage d'expressions pour référencer les données des nodes précédents : `{{$node["Get customer"].json.email}}`. Autocomplétion des champs disponibles.

### 5.2 JSON path
Sélectionner des champs dans des objets imbriqués : `$.customer.addresses[0].zipcode`.

### 5.3 Functions built-in
Fonctions utilisables dans les expressions : string manipulation (upper, lower, trim, replace, split, substring), math, date formatting, array operations (map, filter, reduce), type casts.

### 5.4 Variables
Définir des variables dans un workflow pour réutilisation.

### 5.5 Static data
Sauvegarder des données persistantes entre les exécutions (ex: dernière ID traitée pour le polling).

### 5.6 Environment variables
Variables d'env accessibles dans les workflows (ex: `{{$env.API_KEY}}`). Chiffrées, gestion centralisée.

### 5.7 Secrets
Intégration avec le module Vault pour les secrets (API keys, tokens). Pas en clair dans le workflow.

### 5.8 Data transformation templates
Templates visuels pour reformater des données : "de JSON à CSV", "extraire noms depuis une liste d'objets".

### 5.9 Merge / join data
Combiner les outputs de plusieurs nodes (ex: joindre les contacts d'un CRM avec leurs tickets du helpdesk).

### 5.10 Split data
Diviser un tableau en plusieurs items à traiter individuellement.

---

## Catégorie 6 — Intégrations externes

### 6.1 OAuth connections
Connexions OAuth pour les services externes (Google, Microsoft, Slack, Dropbox, GitHub, etc.). Token refresh automatique.

### 6.2 API key connections
Connexions via clé API pour les services qui ne supportent pas OAuth.

### 6.3 Custom connectors
Créer un connecteur custom pour une API interne : définir les endpoints, l'auth, les champs de sortie.

### 6.4 Integration marketplace
Catalogue des intégrations pré-construites (Google Workspace, Microsoft 365, Salesforce, HubSpot, Slack, GitHub, Jira, Stripe, etc.).

### 6.5 Connected services management
Page pour gérer les connexions actives, révoquer, renouveler, voir les permissions.

### 6.6 Rate limiting respect
Respect automatique des limites de rate des APIs externes. Queue et retry.

### 6.7 Pagination handling
Gestion automatique de la pagination quand une API retourne des données en plusieurs pages.

### 6.8 Error handling par provider
Gestion des erreurs spécifiques aux providers : token expiré, rate limit, invalid request.

### 6.9 Versioning d'API
Support des différentes versions d'API d'un même service.

---

## Catégorie 7 — Exécution et monitoring

### 7.1 Run history
Liste de toutes les exécutions passées d'un workflow : date, durée, statut (success, error, partial), items traités.

### 7.2 Execution detail
Clic sur une exécution → vue step-by-step avec input/output de chaque node. Utile pour le debug.

### 7.3 Replay
Re-exécuter une exécution passée avec les mêmes données. Utile pour tester des corrections.

### 7.4 Logs
Logs détaillés : debug, info, warn, error. Filtrage et recherche.

### 7.5 Metrics
Métriques agrégées : nombre d'exécutions, taux de succès, durée moyenne, erreurs les plus fréquentes.

### 7.6 Alertes
Notification quand un workflow échoue ou dépasse un seuil de temps/erreurs.

### 7.7 Test mode
Exécuter un workflow en mode test avec des données factices sans effet sur les systèmes réels.

### 7.8 Step-by-step debugger
Exécution pas à pas avec pause entre chaque node pour inspecter les données.

### 7.9 Trigger manually
Bouton "Run now" pour lancer un workflow manuellement (indépendamment du trigger normal).

### 7.10 Execute with custom input
Lancer avec un input spécifique pour tester des cas particuliers.

### 7.11 Pause / Resume
Mettre un workflow en pause (plus de nouvelles exécutions) sans le supprimer.

### 7.12 Disable / Enable
Activer/désactiver un workflow.

---

## Catégorie 8 — Versioning et collaboration

### 8.1 Versioning automatique
Chaque sauvegarde crée une nouvelle version. Rollback vers une version antérieure possible.

### 8.2 Draft vs Production
Deux modes : draft (édition en cours, pas actif) et production (publié, actif). Publication explicite.

### 8.3 Compare versions
Diff visuel entre deux versions d'un workflow.

### 8.4 Commentaires inline
Commentaires sur les nodes pour la collaboration.

### 8.5 Multi-user editing
Plusieurs utilisateurs peuvent éditer un workflow simultanément (avec Yjs pour la collab temps réel).

### 8.6 Approval workflow
Pour les workflows critiques, approbation obligatoire avant publication.

### 8.7 Audit log
Log : qui a créé/modifié/activé/désactivé un workflow.

### 8.8 Export / Import JSON
Exporter un workflow en JSON pour backup ou partage. Import pour cloner.

### 8.9 Sharing
Partager un workflow avec d'autres utilisateurs (lecture/édition).

### 8.10 Templates partagés
Publier son workflow comme template dans le catalogue organisation.

---

## Catégorie 9 — AI dans les workflows

### 9.1 AI as a node
Inclure un node "AI" qui appelle un LLM avec un prompt. Input/output structuré.

### 9.2 Content generation
Générer du contenu (emails, descriptions, rapports) depuis les données du workflow.

### 9.3 Data extraction
Extraire des champs structurés depuis du texte libre via LLM.

### 9.4 Classification
Classifier des items (emails en catégories, tickets par intent, sentiments).

### 9.5 Decision making
Utiliser un LLM pour prendre une décision ("Faut-il escalader ce ticket ?").

### 9.6 Summarization
Résumer des longs textes (comptes rendus, threads d'emails).

### 9.7 Translation
Traduire des contenus dans plusieurs langues.

### 9.8 AI-generated workflows
Générer un workflow à partir d'une description en langage naturel : "Quand un client soumet un formulaire, créer un contact, envoyer un email de bienvenue et créer une tâche pour le sales".

### 9.9 Explain workflow
L'IA explique ce que fait un workflow en langage naturel.

### 9.10 Suggest optimizations
Suggestions d'améliorations : dédoublonner des nodes, parallelizer, ajouter du retry.

---

## Catégorie 10 — Sécurité et gouvernance

### 10.1 Permissions granulaires
- Viewer : peut voir le workflow et ses logs
- Editor : peut éditer le draft
- Publisher : peut activer/désactiver et publier
- Admin : peut supprimer, gérer permissions

### 10.2 Secrets management
Secrets (API keys, tokens) stockés dans le Vault, référencés par alias dans les workflows.

### 10.3 Audit log
Log immuable : qui a fait quoi dans les workflows.

### 10.4 Data retention
Combien de temps les logs d'exécution sont conservés (configurable, minimum 30 jours).

### 10.5 PII handling
Option pour anonymiser/masquer les données personnelles dans les logs (RGPD).

### 10.6 Rate limiting par user/org
Limite du nombre d'exécutions par période pour éviter les abus.

### 10.7 Approval requis pour certains triggers
Certains triggers (email received all, CRM new contact) demandent une approbation admin à la première utilisation.

### 10.8 Restricted domains
Les HTTP requests sortantes peuvent être limitées à certains domaines (pour la sécurité).

### 10.9 Code review pour code nodes
Les nodes contenant du code JS/Python custom peuvent nécessiter une review avant activation.

### 10.10 Sandbox execution
Les code nodes s'exécutent dans un sandbox sécurisé (pas d'accès fs, network limité).

---

## Sources d'inspiration

### Aides utilisateur publiques
- **Zapier Learn** (zapier.com/learn) — tutoriels, use cases, templates.
- **Zapier Help** (zapier.com/help) — docs complètes, troubleshooting.
- **Make Help** (make.com/help) — scenarios, modules, advanced features.
- **n8n Docs** (docs.n8n.io) — self-hosting, nodes, workflows.
- **Pipedream Docs** (pipedream.com/docs) — code-first, examples.
- **Apache Airflow Docs** (airflow.apache.org/docs) — DAGs, scheduling, Python.
- **Temporal Docs** (docs.temporal.io) — durable workflows patterns.
- **Workato Academy** (workato.com/academy) — certifications iPaaS.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, Sustainable Use License (non-OSI)**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **n8n** (github.com/n8n-io/n8n) | **Sustainable Use License** (depuis 2022) | **NON-OSI**. Interdit pour copie. Étudier via docs et démos. Pre-2022 était Apache-2.0. |
| **Activepieces** (activepieces.com) | **MIT Community / Commercial** | OK pour la partie community MIT. Alternative moderne à Zapier. **À étudier**. |
| **Huginn** (github.com/huginn/huginn) | **MIT** | Agent-based automation Ruby. Pattern pour les agents. |
| **Node-RED** (nodered.org) | **Apache-2.0** | Flow-based programming visuel. Leader IoT. **À étudier**. |
| **Apache Airflow** (airflow.apache.org) | **Apache-2.0** | Data pipelines, DAGs Python. Pour les workflows de données lourds. |
| **Temporal** (temporal.io) | **MIT** | Durable workflows code-first. Très robuste pour les cas complexes. |
| **Camunda BPMN** (camunda.com) | **Apache-2.0** (Community) | Workflow engine BPMN standard. |
| **Zeebe** (camunda.io/zeebe) | **BSL 1.1** (since) | **Attention** — BSL, non-OSI. |
| **Windmill** (windmill.dev) | **AGPL v3** | **INTERDIT**. Workflow engine moderne. |
| **Budibase** (budibase.com) | **GPL v3** | **INTERDIT**. |
| **Trigger.dev** (trigger.dev) | **MIT** | Code-first workflows pour devs. **À étudier**. |
| **Inngest** (inngest.com) | **Apache-2.0** / Source-available (depuis) | Event-driven workflows. Attention à la licence récente. |
| **BullMQ** (bullmq.io) | **MIT** | Queue Node.js + Redis. Base pour les jobs. |
| **Bull** | **MIT** | Prédécesseur de BullMQ. |
| **Celery** (celeryq.dev) | **BSD-3-Clause** | Queue Python distribuée. |
| **Apache Kafka** | **Apache-2.0** | Streaming events. Pour les triggers à grande échelle. |
| **Jayveree Expr** / **jsonnet** / **CEL** | **Apache-2.0** | Langages d'expressions pour les conditions. |
| **Monaco Editor** (microsoft.github.io/monaco-editor) | **MIT** | Code editor (VS Code engine) pour les code nodes. |
| **React Flow** (reactflow.dev) | **MIT** | Library pour les diagrammes flow-based. **Utilisable directement**. |
| **LangChain** (langchain.com) | **MIT** | Orchestration LLM. Pour les workflows AI. |
| **LangGraph** | **MIT** | Workflow engine pour agents LangChain. |

### Pattern d'implémentation recommandé
1. **Workflow engine** : Temporal (MIT) pour les workflows durables, ou système custom basé sur une queue (BullMQ MIT + state machine).
2. **Canvas builder** : React Flow (MIT) comme base du visual builder. Très mature.
3. **Code editor** : Monaco Editor (MIT) pour les code nodes (JS/Python).
4. **Expression language** : CEL (Common Expression Language) ou jsonata (MIT) pour les expressions dynamiques.
5. **JS sandbox** : `vm2` (MIT, mais abandoned) ou `isolated-vm` (MIT) ou Deno sandbox pour l'exécution sécurisée de JS custom.
6. **Python sandbox** : RustPython ou Pyodide (Mozilla) pour JS-sandboxed Python. Ou container Docker avec timeout.
7. **Queue backend** : BullMQ (MIT) + Redis, ou `tokio` (MIT) + PostgreSQL pour un backend Rust natif.
8. **HTTP requests** : `axios` (MIT) ou `fetch` natif. `reqwest` (MIT) en Rust.
9. **OAuth** : `passport.js` (MIT) ou `next-auth` (ISC), ou implémentation custom.
10. **Secrets** : intégration Vault SignApps.
11. **Scheduler** : cron expressions via `node-cron` (ISC) ou tokio-cron-scheduler (MIT) en Rust.
12. **Monitoring** : metrics Prometheus-compatible, dashboards Grafana.
13. **Workflow templates** : stockage JSON, import/export.
14. **AI node** : intégration avec le module AI SignApps (LLM interne).

### Ce qu'il ne faut PAS faire
- **Pas de fork** de n8n post-2022 (Sustainable Use License), Windmill (AGPL), Budibase (GPL).
- **Pas de vm2** pour le sandbox (library abandonée et bypassable) — utiliser `isolated-vm` ou containers.
- **Attention à Inngest** post-licence change — valider la licence actuelle.
- **Pas de code arbitraire non sandboxé** — toujours dans une VM isolée.

---

## Assertions E2E clés (à tester)

- Création d'un workflow depuis template
- Drag-drop d'un trigger sur le canvas
- Configuration d'un node action
- Connection entre deux nodes
- Publication d'un workflow (draft → production)
- Trigger manuel (Run now)
- Exécution réussie visible dans l'historique
- Debug step-by-step avec input/output de chaque node
- Condition branching (if/else)
- Loop sur une collection
- Scheduled trigger (cron)
- Webhook trigger
- Action vers un module interne (CRM, Mail, etc.)
- HTTP request sortante
- Code node JS (sandbox)
- AI node (LLM)
- Error handling avec try/catch
- Retry sur échec
- Export/Import JSON
- Versioning et rollback
- Multi-user editing
- Monitoring : métriques et alertes
- Pause/Resume d'un workflow
- Secrets depuis le Vault
- AI generation d'un workflow depuis prompt
