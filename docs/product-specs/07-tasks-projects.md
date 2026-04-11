# Module Tasks / Projects — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Linear** | Keyboard-first obsessionnel, cycles/sprints, triage inbox, issue templates, Git integration (linked PRs auto-close), roadmap, projects, initiatives, milestones, views filtrables sauvegardables, issue states customisables, slash commands partout |
| **Asana** | Multiple views (list, board, timeline, calendar, workflow), project templates, milestones, dependencies, workload (team capacity), goals, portfolios, custom fields, forms intake, rules & automations |
| **Monday.com** | Boards workflow builder visuel, colonnes typées (status, people, timeline, numbers, formula, time tracking), automations, dashboards, integrations, mirror columns, workdocs |
| **ClickUp** | Tout-en-un (docs, chat, goals, time tracking, mind maps), hierarchical (space > folder > list > task), 15+ views, custom fields, templates, dashboards, CRM, whiteboards |
| **Jira (Atlassian)** | Leader dev teams, Scrum/Kanban boards, backlog, sprints, epics, story points, velocity, burndown charts, workflow customization, JQL query language, Advanced roadmaps, Jira Automation |
| **Notion (Projects)** | Databases polymorphes, templates, relations, rollups, inline views, docs+tasks hybride |
| **Trello** | Simplicité Kanban first, power-ups, butler automations, card cover, checklist |
| **Height** | AI-first PM, Copilot, pull request bundling, workflow automations, multi-view |
| **Smartsheet** | Gantt enterprise, critical path, dependencies, resource management, proofing workflows |
| **Todoist** | Natural language input, projects+labels+filters+priorities, Karma gamification, smart scheduling |
| **TickTick** | Todoist alternative avec calendar view et habit tracker |
| **Things 3** | Apple-only, design parfait, today/upcoming/anytime/someday workflow |
| **OmniFocus** | GTD methodology, perspectives personnalisées, Apple ecosystem |
| **Basecamp** | Projets complets (to-dos + docs + schedule + chat + files), hill charts, anti-sprawl |
| **Shortcut** | Startup-friendly, simple workflow, iterations |

## Principes directeurs

1. **Input rapide** — créer une tâche en 2 secondes avec langage naturel ("Appeler Jean demain 10h") et l'oublier.
2. **Plusieurs vues, mêmes données** — les tâches peuvent être affichées en list, board, calendar, gantt, timeline. Changer de vue n'affecte pas les autres.
3. **Hiérarchie flexible** — Workspace > Projet > Section > Tâche > Sous-tâche sans imposer une structure rigide.
4. **Keyboard-first pour les power users** — raccourcis exhaustifs, quick switcher, slash commands.
5. **Visibilité équipe** — qui fait quoi, qui est bloqué, quelle est la charge de chacun, en un coup d'œil.
6. **Dependencies et planification réaliste** — tenir compte de la capacité, des dépendances, de la saisonnalité.

---

## Catégorie 1 — Création et édition de tâches

### 1.1 Création rapide (quick add)
Input en haut ou shortcut `c` ouvrant un popover avec un seul champ : titre + natural language parsing. "Appeler Jean demain 10h !3 @john #projet-x" crée :
- Titre : "Appeler Jean"
- Due : demain 10h
- Priority : 3
- Assignee : john
- Project : projet-x

### 1.2 Création détaillée
Dialog ou page avec tous les champs :
- Titre
- Description (rich text)
- Projet / Liste / Section
- Assignee(s)
- Due date + Start date
- Priority (aucune, low, medium, high, urgent)
- Status (To do, In progress, Done, Blocked, Cancelled)
- Tags / Labels
- Custom fields
- Sub-tasks
- Dependencies
- Attachments
- Estimate (time or story points)
- Recurring rule

### 1.3 Task template
Appliquer un template à une nouvelle tâche : "Onboarding nouveau dev" remplit automatiquement avec une checklist de 15 sous-tâches, assignee par défaut, tags.

### 1.4 Duplication de tâche
`Ctrl+D` ou clic droit `Dupliquer` crée une copie avec un nouveau title. Pratique pour les tâches récurrentes non planifiées.

### 1.5 Import CSV
Upload de CSV avec mapping des colonnes vers les champs de tâche. Création bulk.

### 1.6 Import depuis un email
Depuis le module Mail, bouton `Créer une tâche` qui prend le sujet de l'email comme titre et le corps comme description. Lien vers l'email dans l'activité.

### 1.7 Création depuis un message chat
Dans le module Chat, `/task` ou `@` sur un message transforme le message en tâche. Conserve l'auteur et le lien vers le message.

### 1.8 Création depuis un doc
Dans le module Docs, `@tâche` insère un smart chip qui crée la tâche et la lie au paragraphe.

### 1.9 Multi-assignees
Une tâche peut être assignée à plusieurs personnes. Responsabilité partagée visible par avatars.

### 1.10 Sub-tasks imbriquées
Sous-tâches jusqu'à 5 niveaux de profondeur. Chacune peut avoir ses propres due date, assignee, status. Progression du parent basée sur celle des enfants.

### 1.11 Bulk edit
Sélectionner plusieurs tâches (multi-select avec checkbox ou Shift+clic) → édition de masse : changer status, assignee, priority, tag, déplacer vers un autre projet.

### 1.12 Undo après action
Toast en bas "Tâche créée · Annuler" pendant 5s.

---

## Catégorie 2 — Vues et organisation

### 2.1 Vue Liste (list view)
Tâches en lignes verticales groupées par section/projet. Chaque ligne : checkbox, titre, assignee, due date, priority, tags. Expansion de sous-tâches.

### 2.2 Vue Kanban (board view)
Colonnes = statuts (`To do`, `In progress`, `Review`, `Done`). Cartes = tâches. Drag entre colonnes pour changer le statut. WIP limits configurables par colonne.

### 2.3 Vue Calendrier
Tâches avec due date affichées sur un calendrier mensuel/hebdo. Drag-drop pour reprogrammer. Intégration avec le module Calendar (affichage unifié possible).

### 2.4 Vue Timeline (gantt)
Tâches avec start + end date affichées sur une timeline horizontale. Dépendances visibles comme flèches. Drag des bords pour resize, drag du milieu pour déplacer. Filtres et zoom (jour/semaine/mois/trimestre).

### 2.5 Vue Gantt
Comme timeline mais avec hiérarchie (parent/enfant), critical path calculé automatiquement, progression, baseline (plan original vs réel).

### 2.6 Vue Workload (charge d'équipe)
Barres horizontales par personne montrant leur charge semaine par semaine. Dépassement de capacité en rouge. Drag-drop pour répartir.

### 2.7 Vue My tasks (mes tâches)
Filtre automatique sur les tâches assignées à l'utilisateur courant, groupées par due date (Aujourd'hui, Cette semaine, Prochaine semaine, Pas de date).

### 2.8 Vue Backlog
Liste plate des tâches non démarrées, non assignées à un sprint/cycle. Triage rapide.

### 2.9 Vue Sprint / Cycle
Sélection d'un sprint (ex: "Sprint 42") → vue des tâches du sprint uniquement, avec burndown chart.

### 2.10 Vue Goals / Objectifs
Vue hiérarchique des goals → initiatives → projets → tâches. Progression agrégée.

### 2.11 Vue Projets (portfolio)
Liste de tous les projets avec progression, owner, deadline, statut (à l'heure, en retard, bloqué). Dashboard niveau portfolio.

### 2.12 Vue Mind map
Brainstorming visuel : tâches organisées en arbre radial. Drag pour restructurer.

### 2.13 Vue personnalisée sauvegardée
Chaque vue peut être sauvegardée comme "Ma vue prioritaire" avec filtres, groupements, tris spécifiques. Partageable avec l'équipe.

---

## Catégorie 3 — Hiérarchie et organisation

### 3.1 Workspace
Top level : un workspace par organisation (ex: `Acme Corp`). Isolation entre workspaces. Utilisateurs peuvent appartenir à plusieurs.

### 3.2 Space / Team
Sous-division du workspace : `Engineering`, `Marketing`, `Sales`. Accès par équipe configurable.

### 3.3 Projet
Conteneur pour les tâches d'un effort : `Refonte du site web`, `Lancement produit Q2`. Avec owner, description, dates, icône, couleur.

### 3.4 Section / List
Sous-division d'un projet : `Backlog`, `Sprint courant`, `Terminé`. Ou thématique : `Design`, `Dev`, `QA`.

### 3.5 Tâche
Item de base. Peut contenir des sous-tâches, des commentaires, des fichiers, des liens.

### 3.6 Sous-tâche
Tâche enfant d'une autre tâche. Hérite du projet parent par défaut. Peut avoir son propre assignee, due, status.

### 3.7 Labels / Tags
Étiquettes cross-project : `urgent`, `bug`, `feature`, `design`, `blocked`. Couleur associée. Multi-label par tâche.

### 3.8 Milestone
Jalons importants avec date (lancement, démo client, fin de phase). Tâches peuvent être liées à un milestone. Visible dans les vues timeline et gantt.

### 3.9 Épic / Story / Task (Jira-like)
Pour les équipes agiles : `Epic` (gros chantier) > `Story` (incrément utilisateur) > `Task` (étape technique). Hierarchie configurable.

### 3.10 Favoris / Pinned
Épingler un projet ou une vue dans la sidebar pour accès rapide.

### 3.11 Archives
Projets terminés archivés (cachés par défaut mais restaurables). Nettoie la sidebar sans perdre les données historiques.

### 3.12 Déplacement entre projets
Drag-drop d'une tâche d'un projet vers un autre. Historique préservé.

---

## Catégorie 4 — Collaboration

### 4.1 Commentaires sur une tâche
Panneau de commentaires en bas de la tâche. Rich text, attachments, @mentions. Thread chronologique.

### 4.2 @mentions
Taper `@` pour suggérer les membres. L'utilisateur mentionné reçoit notif email + push + in-app.

### 4.3 Réactions émoji sur les commentaires
Quick reactions (👍, ❤️, 🎉) sur les commentaires pour feedback rapide sans polluer le thread.

### 4.4 Watching a task
Bouton `Suivre` : recevoir toutes les mises à jour de cette tâche sans en être assignee. Useful pour les stakeholders.

### 4.5 Activity log
Timeline de toutes les modifications : créé par X, assigné à Y, statut changé, commentaire ajouté. Filtrable.

### 4.6 Mention d'une autre tâche
Taper `#` + numéro/titre → suggestion des tâches. Insertion comme lien vers la tâche mentionnée. Backlinks automatiques.

### 4.7 Lien vers un PR / commit (Git integration)
Coller une URL GitHub/GitLab → smart chip avec titre PR, auteur, statut. Si le PR est mergé/closed, le statut de la tâche peut changer automatiquement.

### 4.8 Shared drafts
Brouillons de tâches partagés : proposer une tâche à une équipe avant création formelle. Review et approbation.

### 4.9 Team calendar d'événements projet
Vue calendrier partagée d'un projet montrant les milestones, deadlines, meetings projet.

### 4.10 Notifications intelligentes
Notif uniquement pour ce qui me concerne : mes assignations, mes mentions, mes suivis. Pas de spam global.

### 4.11 Notifications groupées
Plusieurs notifs sur la même tâche en peu de temps → une seule notif agrégée.

### 4.12 Mute d'une tâche
Désactiver les notifs d'une tâche spécifique sans se désassigner.

---

## Catégorie 5 — Dépendances et planification

### 5.1 Dépendances entre tâches
Définir `Tâche B ne peut commencer qu'après Tâche A`. Types : `Finish-to-Start` (par défaut), `Start-to-Start`, `Finish-to-Finish`, `Start-to-Finish`.

### 5.2 Visualisation des dépendances
Flèches sur la vue Gantt/Timeline. Surlignage des dépendances sur clic d'une tâche.

### 5.3 Blocking / Blocked by
`Cette tâche bloque : [X, Y]`, `Cette tâche est bloquée par : [Z]`. Changement de status automatique : une tâche ne peut pas être "In progress" si ses blockers sont ouvertes (ou warning).

### 5.4 Critical path
Calcul automatique du chemin critique dans un projet : les tâches sans marge qui déterminent la date de fin. Mise en surbrillance dans la vue Gantt.

### 5.5 Slack time
Marge de manœuvre calculée pour chaque tâche (temps avant qu'elle n'impacte le critical path).

### 5.6 Auto-scheduling
Option `Replanifier automatiquement` : si une tâche prend du retard, ses dépendants sont automatiquement décalés pour maintenir les dates cohérentes.

### 5.7 Baseline
Enregistrer un snapshot de la planification ("baseline v1") pour comparer plus tard avec le réel. Visible en comparaison sur la vue Gantt.

### 5.8 Resource leveling
Si un assignee est surchargé, l'algorithme propose de décaler certaines tâches pour lisser la charge.

### 5.9 Estimated vs actual time
Estimate en heures ou story points. Tracking du temps réel passé (time tracking). Comparaison.

### 5.10 Velocity (pour les équipes agiles)
Vitesse d'équipe mesurée en points complétés par sprint. Prédiction des sprints futurs basée sur la velocity historique.

---

## Catégorie 6 — Sprints et cycles (agile)

### 6.1 Création de sprint
`Nouveau sprint` avec durée (1-4 semaines), dates, nom (Sprint 42), capacité en heures/points, goal.

### 6.2 Sprint planning
Drag de tâches depuis le backlog vers le sprint courant. Vérification de la capacité (ne dépasser 100% de velocity historique).

### 6.3 Sprint active
Un sprint est actif à la fois. Toutes les tâches du sprint sont affichées sur le board principal par défaut.

### 6.4 Daily standup view
Vue optimisée pour le stand-up : tâches de chaque membre groupées en `Hier terminées`, `Aujourd'hui en cours`, `Bloqueurs`.

### 6.5 Burndown chart
Graphique d'évolution des tâches restantes jour par jour sur la durée du sprint. Ligne idéale vs ligne réelle.

### 6.6 Burnup chart
Alternative au burndown : ligne de scope (avec scope changes visibles) + ligne de tâches faites.

### 6.7 Velocity chart
Points complétés par sprint passés. Moyenne mobile, tendance.

### 6.8 Sprint review / démo
Liste des tâches terminées dans le sprint pour la démo. Export en PDF pour présentation.

### 6.9 Sprint retrospective
Template de rétrospective attaché au sprint : What went well, What to improve, Actions. Liens vers actions dans le prochain sprint.

### 6.10 Sprint carry-over
Tâches non terminées à la fin d'un sprint → proposition de carry-over vers le prochain sprint ou retour backlog. Avec raison de non-complétion.

---

## Catégorie 7 — Workflows et automations

### 7.1 Règles simples
`If status = "Done" THEN add tag "completed"`. Interface simple.

### 7.2 Workflows visuels
Builder drag-drop : triggers → conditions → actions avec branches.

### 7.3 Triggers
- Tâche créée
- Statut changé
- Assignee changé
- Date due approchée
- Date due dépassée
- Commentaire ajouté
- Sub-tâche complétée
- Champ custom changé

### 7.4 Actions
- Changer statut
- Assigner à quelqu'un
- Ajouter un tag
- Copier dans un autre projet
- Créer une sous-tâche
- Envoyer une notif
- Send Slack/email
- Webhook
- Update d'un champ

### 7.5 Exemples de workflows
- Tâche avec tag `bug` → assignée automatiquement au team `QA`
- Tâche passée à `Done` → notification au Product Owner
- Tâche en retard de 2 jours → escalation au manager
- Tâche créée depuis un formulaire externe → triage automatique et assignment

### 7.6 Scheduled automations
Déclenchement à heure fixe : `Tous les lundis matin, créer les tâches récurrentes de l'équipe`.

### 7.7 Forms → tâches
Formulaire intake qui crée automatiquement une tâche avec les champs du formulaire mappés.

### 7.8 Status workflow custom
Définir les états custom (ex: `Draft`, `Review`, `Approved`, `In dev`, `Testing`, `Deployed`, `Closed`) et les transitions autorisées. Workflow type Jira.

### 7.9 Required fields par statut
`Pour passer à "In progress", le champ "Estimate" est requis`. Force la qualité des données.

### 7.10 Auto-assignment round-robin
Tickets incoming distribués automatiquement aux membres de l'équipe support à tour de rôle.

---

## Catégorie 8 — Reporting et analytics

### 8.1 Dashboard personnalisable
Widgets configurables : tâches par statut, tâches par assignee, burndown, velocity, tâches en retard, temps moyen de résolution.

### 8.2 Rapports standards
- Tâches créées vs terminées (par période)
- Temps moyen de résolution (lead time)
- Cycle time (temps entre `In progress` et `Done`)
- Throughput (tâches terminées par semaine)
- Distribution par priority/type/tag
- Backlog health (âge des tâches, taille)
- Team workload

### 8.3 Rapport custom
Builder visuel pour créer ses propres rapports : entité, filtres, groupements, agrégations, type de chart.

### 8.4 Export CSV / PDF
Exporter toute vue ou rapport.

### 8.5 Goals tracking
Définir des goals avec métrique cible. Progression automatique basée sur les tâches complétées.

### 8.6 Portfolio view
Vue d'ensemble de tous les projets d'un workspace avec progression, owner, santé (à l'heure, en retard, bloqué).

### 8.7 Capacity planning
Vue à long terme (3-6 mois) de la capacité de l'équipe vs les projets prévus. Détection des overloads.

### 8.8 Time tracking reports
Temps passé par tâche, par projet, par personne. Export pour facturation client ou paie.

### 8.9 Cumulative flow diagram
Visualisation CFD pour détecter les bottlenecks : tâches accumulées dans un statut spécifique.

### 8.10 Lead / cycle time distribution
Histogramme du temps de résolution pour identifier les outliers.

---

## Catégorie 9 — IA intégrée

### 9.1 Création de tâche depuis langage naturel
"Prépare la démo pour vendredi 14h avec Sarah" → création avec titre, due, assignee automatiquement extraits.

### 9.2 Smart priorisation
L'IA suggère les tâches à traiter en priorité basée sur : due date, dépendances, impact, estimation de l'effort. Ordre quotidien optimal.

### 9.3 Breakdown de tâche
Une tâche trop grosse ? `IA > Décomposer en sous-tâches` génère 5-8 sous-tâches cohérentes avec estimation.

### 9.4 Duplicate detection
Détection automatique des tâches qui semblent être la même (titre similaire, description, tags). Suggestion de fusion.

### 9.5 Estimate suggestion
Basé sur l'historique des tâches similaires, l'IA suggère un estimate (en heures ou points) pour une nouvelle tâche.

### 9.6 Sprint planning assistant
L'IA suggère les tâches à inclure dans le sprint en fonction de la velocity, des dépendances, et des priorités.

### 9.7 Summary de projet
Bouton `Résumer le projet` génère un executive summary : status, key milestones done/upcoming, risques, prochaines étapes.

### 9.8 Daily standup generator
Chaque matin, génération automatique du standup : "Hier : X fermé, Y commencé. Aujourd'hui : Z en cours. Blockers : W".

### 9.9 Meeting notes → tasks
Depuis un compte-rendu de réunion (dans Docs), extraction automatique des action items et création des tâches associées.

### 9.10 Predicted delays
Détection des tâches qui vont probablement être en retard basée sur : estimate vs temps passé, activity récente, blockers. Alertes proactives.

### 9.11 Assistant conversationnel
Panneau `Ask AI` : "Quelles tâches sont en retard ?", "Qui a le plus de travail cette semaine ?", "Montre-moi les bugs critiques".

---

## Catégorie 10 — Intégrations

### 10.1 Intégration Mail
Créer une tâche depuis un email. L'email est lié, visible dans l'activité.

### 10.2 Intégration Calendar
Tâches avec due date apparaissent dans le calendrier. Tâches marquées "bloc" sont des événements.

### 10.3 Intégration Docs
Mention `@tâche` dans un doc crée un lien bidirectionnel. Les tâches du doc sont visibles.

### 10.4 Intégration Chat
`/task` dans un chat crée une tâche. Mentions de tâches rendues comme smart chips.

### 10.5 Intégration CRM
Tâches liées à un contact ou deal CRM, visibles dans les deux.

### 10.6 Git integration (GitHub, GitLab, Bitbucket)
Lier une tâche à un PR/commit. Statut de la tâche mis à jour automatiquement quand le PR est merged.

### 10.7 Slack / Microsoft Teams
Notifications push dans les channels. Création de tâches depuis les messages.

### 10.8 Figma / Design tools
Lier une tâche à un design Figma. Preview inline.

### 10.9 Time tracking (Toggl, Harvest)
Sync bidirectionnelle du temps passé.

### 10.10 API REST complète
Endpoints pour toutes les entités. Webhooks pour les events.

### 10.11 Zapier / Make
Triggers et actions pour l'automation inter-outils.

---

## Catégorie 11 — Mobile et accessibilité

### 11.1 Application mobile native
iOS et Android avec toutes les fonctionnalités essentielles. Mode offline.

### 11.2 Quick capture
Widget d'écran d'accueil pour ajouter rapidement une tâche.

### 11.3 Voice capture
Bouton micro pour dicter une tâche. STT + parsing natural language.

### 11.4 Notifications push intelligentes
Seulement pour les assignations, mentions, due approaching, blockers.

### 11.5 Keyboard shortcuts exhaustifs
- `c` : nouvelle tâche
- `/` : recherche
- `j/k` : naviguer
- `Enter` : ouvrir
- `Ctrl+Enter` : marquer comme fait
- `a` : assigner
- `d` : due date
- `p` : priority
- `l` : label
- `m` : déplacer vers un projet
- `e` : archiver
- `?` : aide

### 11.6 Quick switcher
`Ctrl+K` pour naviguer entre tâches, projets, views.

### 11.7 Accessibilité WCAG AA
Navigation clavier, lecteur d'écran, contrastes.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Linear Help** (linear.app/docs) — keyboard-first, cycles, triage.
- **Asana Guide** (asana.com/guide) — multi-view, portfolios, goals, templates.
- **Monday Help** (support.monday.com) — workflow builder, formulas.
- **ClickUp University** (university.clickup.com) — hierarchical, custom views.
- **Jira Cloud Support** (support.atlassian.com/jira-cloud) — agile, JQL, automations.
- **Notion Help** (notion.so/help) — databases, templates, relations.
- **Todoist Help** (todoist.com/help) — natural language, filters, productivity.
- **Height Docs** (height.app/docs) — AI Copilot, multi-view.
- **GitHub Projects** (docs.github.com/issues/planning-and-tracking-with-projects) — issues + projects + roadmap.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Plane** (getplane.so, github.com/makeplane/plane) | **AGPL v3** | **INTERDIT**. Alternative Jira open source. Étudier uniquement via démos publiques. |
| **Focalboard** (github.com/mattermost/focalboard) | **MIT** | Kanban board de Mattermost. Excellent pattern pour les boards. Référence principale. |
| **OpenProject Community** (openproject.org) | **GPL v3** | **INTERDIT**. Étudier via docs publiques. |
| **Taiga** (taiga.io) | **MPL v2** | **Weak copyleft OK comme consommateur**. Agile scrum/kanban. Bon pattern. |
| **Wekan** (wekan.github.io) | **MIT** | Trello clone open source. Pattern simple pour les boards. |
| **Restyaboard** (restya.com) | **OSL v3** | **Attention licence non-standard**. Trello clone. |
| **Leantime** (leantime.io) | **AGPL v3** | **INTERDIT**. |
| **Kanboard** (kanboard.org) | **MIT** | Kanban simple en PHP. Pattern pour la logique de base. |
| **Taskwarrior** (taskwarrior.org) | **MIT** | CLI task manager avec syntaxe puissante. Pattern pour le natural language. |
| **Tasks.org** (tasks.org) | **GPL v3** | **INTERDIT** (Android app). |
| **Super Productivity** (github.com/johannesjo/super-productivity) | **MIT** | Pomodoro + tasks + time tracking. Pattern UI desktop. |
| **todotxt** (todotxt.org) | **GPL v3** | **INTERDIT pour copie**. Format spec libre. |
| **@dnd-kit/core** (dndkit.com) | **MIT** | Déjà utilisé pour les drag-drop. |
| **react-big-calendar** (github.com/jquense/react-big-calendar) | **MIT** | Pour la vue calendrier. |
| **gantt-schedule-timeline-calendar** (github.com/neuronetio/gantt-schedule-timeline-calendar) | **GPL v3** | **INTERDIT**. |
| **dhtmlx-gantt** (dhtmlx.com/docs/products/dhtmlxGantt) | **GPL v2 (free)** / **commercial** | **INTERDIT free version**. Commercial disponible. |
| **frappe-gantt** (github.com/frappe/gantt) | **MIT** | Gantt simple et bon pour l'intégration. Alternative permissive. |
| **@rsuite/react-gantt** | **MIT** | React Gantt component. |
| **Tantivy** (quickwit.io) | **MIT** | Full-text search pour les tâches. |
| **chrono-node** (github.com/wanasit/chrono) | **MIT** | Natural language date parsing (Today, demain, next week). |
| **nlp.js** (github.com/axa-group/nlp.js) | **MIT** | NLP library pour le parsing d'intents. |

### Pattern d'implémentation recommandé
1. **Board drag-drop** : `@dnd-kit/core` (MIT) + pattern Focalboard (MIT).
2. **Gantt chart** : `frappe-gantt` (MIT) ou composant custom React avec `d3-scale` (BSD-3).
3. **Timeline view** : composant custom avec `@tanstack/react-virtual` (MIT).
4. **Calendar view** : `react-big-calendar` (MIT) ou `fullcalendar` (MIT).
5. **Natural language parsing** : `chrono-node` (MIT) pour les dates, parser custom pour les mentions/priorities/projects.
6. **Sub-task tree** : composant custom recursive. Pattern Notion-like.
7. **Real-time updates** : Yjs (MIT) pour la collab temps réel sur les commentaires.
8. **Search** : Tantivy (MIT) ou client-side avec Fuse.js (Apache-2.0).
9. **Burndown/burnup charts** : Chart.js (MIT) ou ECharts (Apache-2.0).
10. **Integrations Git** : webhook receivers + API clients (octokit.js MIT pour GitHub).

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Plane, OpenProject, Leantime (AGPL/GPL).
- **Pas de `gantt-schedule-timeline-calendar`** (GPL).
- **Pas de dhtmlx-gantt free** (GPL, il faut la commercial).
- Préférer `frappe-gantt` (MIT) ou composants custom.

---

## Assertions E2E clés (à tester)

- Création rapide d'une tâche avec titre
- Natural language parsing ("demain 10h !3 @john")
- Édition détaillée : tous les champs
- Sub-tâches imbriquées
- Drag-drop d'une tâche entre colonnes (board view)
- Drag-drop d'une tâche dans le temps (calendar/gantt view)
- Assignation à plusieurs personnes
- Due date avec reminders
- Dépendances entre tâches
- Marquer comme terminée (checkbox)
- Undo après complétion
- Commentaires avec @mentions
- Activity log d'une tâche
- Recherche avec filtres
- Vues sauvegardées (filtres + groupements + tris)
- Import CSV de tâches
- Bulk edit (multi-sélection)
- Workflow automation déclenchée
- Sprint planning : drag backlog → sprint
- Burndown chart de sprint
- Export en CSV/PDF
- Keyboard shortcuts
- Mobile : création, édition, complétion
