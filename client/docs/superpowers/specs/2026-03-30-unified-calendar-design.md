# Calendrier Unifié SignApps — Design Spec

## Objectif

Fusionner les deux systèmes parallèles (signapps-calendar + signapps-scheduler) en un calendrier unifié basé sur `signapps-calendar` (port 3011). Le calendrier gère tout ce qui touche au temps : événements, tâches, congés, shifts, réservations de ressources, CRON jobs, projets, et présence RH. Un système de layers superposables permet de visualiser n'importe quelle combinaison de contextes.

## Décisions architecturales

- **Backend unique** : `signapps-calendar` absorbe tout. `signapps-scheduler` est supprimé (ses CRON jobs et TimeItems migrent vers calendar).
- **Schema unique** : `calendar` absorbe les tables utiles de `scheduling`. Le schema `scheduling` est abandonné après migration.
- **Store unique** : `calendar-store.ts` absorbe tout. Les stores scheduling sont supprimés.
- **API unique** : `lib/api/calendar.ts` est enrichi. Les APIs `lib/scheduling/api/*` sont supprimées.
- **Frontend** : les composants legacy `calendar/` gardent les vues Day/Week/Month/Agenda. Les composants `scheduling/` fournissent Timeline, Kanban, Heatmap, Roster, Tasks. Les doublons scheduling sont supprimés. Deux vues nouvelles : Disponibilité et Tableau de présence.

---

## 1. Modèle de données — Event unifié

### Extension de `calendar.events`

Nouveaux champs ajoutés au modèle Event existant :

| Champ | Type | Description |
|-------|------|-------------|
| `event_type` | enum | `event`, `task`, `leave`, `shift`, `booking`, `milestone`, `blocker`, `cron` |
| `scope` | enum | `personal`, `team`, `org` |
| `status` | enum | `draft`, `pending`, `approved`, `rejected`, `completed` |
| `priority` | enum | `low`, `medium`, `high`, `urgent` |
| `parent_event_id` | UUID nullable | Hiérarchie (sous-tâches, événements liés) |
| `resource_id` | UUID nullable | Ressource réservée (salle, matériel, véhicule) |
| `category_id` | UUID nullable | Catégorie personnalisée |
| `leave_type` | enum nullable | `cp`, `rtt`, `sick`, `unpaid`, `other` (quand event_type=leave) |
| `presence_mode` | enum nullable | `office`, `remote`, `absent` (pour shifts/présence) |
| `approval_by` | UUID nullable | Manager approbateur pour congés |
| `approval_comment` | text nullable | Raison du refus ou commentaire |
| `energy_level` | enum nullable | `low`, `medium`, `high` |
| `cron_expression` | text nullable | Expression CRON (quand event_type=cron) |
| `cron_target` | text nullable | Host/container cible |

### Nouvelles tables dans le schema `calendar`

#### `calendar.categories`
Catégories personnalisées avec règles.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | |
| `name` | text | Nom (ex: "Astreinte", "Formation") |
| `color` | text | Couleur hex |
| `icon` | text nullable | Nom d'icône Lucide |
| `owner_id` | UUID nullable | Propriétaire (null = catégorie org) |
| `org_id` | UUID nullable | Organisation |
| `rules` | JSONB | Règles applicables (ex: `{"counts_as": "overtime", "budget": "training"}`) |
| `created_at` | timestamptz | |

#### `calendar.presence_rules`
Règles de présence RH par équipe.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | |
| `org_id` | UUID | Organisation |
| `team_id` | UUID nullable | Équipe (null = règle globale org) |
| `rule_type` | enum | `min_onsite`, `mandatory_days`, `max_remote_same_day`, `min_coverage` |
| `rule_config` | JSONB | Configuration (ex: `{"days_per_week": 3}`, `{"days": ["tue","thu"]}`, `{"max": 2}`, `{"role": "technicien", "min": 2}`) |
| `enforcement` | enum | `soft` (avertissement jaune), `hard` (blocage rouge) |
| `active` | bool | |
| `created_at` | timestamptz | |

#### `calendar.leave_balances`
Soldes de congés par employé.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | |
| `user_id` | UUID | Employé |
| `leave_type` | enum | `cp`, `rtt`, `sick`, `unpaid`, `other` |
| `year` | int | Année |
| `total_days` | decimal | Solde total alloué |
| `used_days` | decimal | Jours consommés (approved) |
| `pending_days` | decimal | Jours en attente (pending) |
| `updated_at` | timestamptz | |

#### `calendar.timesheet_entries`
Fiches d'heures générées depuis le calendrier.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | |
| `user_id` | UUID | Employé |
| `event_id` | UUID nullable | Événement source |
| `date` | date | Jour |
| `hours` | decimal | Nombre d'heures |
| `category_id` | UUID nullable | Catégorie (détermine type d'heure) |
| `auto_generated` | bool | true si calculé depuis le calendrier, false si saisi manuellement |
| `validated` | bool | Validé par l'employé en fin de semaine |
| `validated_at` | timestamptz nullable | |
| `exported_at` | timestamptz nullable | Date d'export vers RH/paie |
| `created_at` | timestamptz | |

#### `calendar.approval_workflows`
Workflow d'approbation configurable.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | |
| `org_id` | UUID | Organisation |
| `trigger_type` | enum | `leave_long` (>N jours), `leave_sensitive_period`, `shift_change` |
| `trigger_config` | JSONB | Ex: `{"min_days": 5}` ou `{"periods": [{"start": "07-01", "end": "08-31"}]}` |
| `approvers` | JSONB | Liste ordonnée d'approbateurs (ex: `[{"role": "manager"}, {"role": "hr"}]`) |
| `active` | bool | |

---

## 2. Système de Layers superposables

### Layers natifs

| Layer | Filtre | Couleur défaut |
|-------|--------|---------------|
| Mes événements | `event_type=event`, owner=moi | bleu primaire |
| Mes tâches | `event_type=task`, assigned=moi | violet |
| Congés équipe | `event_type=leave`, scope=team | orange |
| Salles | `event_type=booking`, resource_type=room | vert |
| Matériel | `event_type=booking`, resource_type=equipment | cyan |
| Véhicules | `event_type=booking`, resource_type=vehicle | jaune |
| Projets | `event_type in (milestone, task)`, lié à un projet | indigo |
| Planning équipe | `event_type=shift`, scope=team | rose |
| Collègues | events d'utilisateurs sélectionnés | couleur par user |
| Calendriers externes | events synchronisés (provider_connection_id not null) | gris |
| Catégories custom | filtre par `category_id` | couleur de la catégorie |

### Comportement UI

- **Panneau latéral gauche** : liste des layers avec checkbox on/off, couleur, opacité (100%/50%/25%)
- **Superposition** : les événements de layers différents se superposent dans la grille temporelle
- **Détection de conflits** : zones où 2+ layers occupent le même créneau surlignées en rouge léger
- **Layer "Collègues"** : picker multi-utilisateurs, chaque collègue reçoit une couleur distincte
- **Persistance** : config layers sauvée en localStorage, restaurée au chargement
- **Layer catégorie custom** : créer via `[+] Ajouter un layer...` qui ouvre le gestionnaire de catégories

---

## 3. Les 11 vues

| # | Vue | Description | Layers pertinents |
|---|-----|-------------|-------------------|
| 1 | **Day** | Grille horaire journée, événements en blocs | Tous |
| 2 | **Week** | Grille horaire semaine 7 colonnes | Tous |
| 3 | **Month** | Grille mois, événements en chips | Tous |
| 4 | **Agenda** | Liste chronologique texte, groupée par jour | Tous |
| 5 | **Timeline/Gantt** | Barres horizontales sur axe temporel, dépendances | Projets, tâches, collègues |
| 6 | **Kanban** | Colonnes par statut (draft→pending→approved→completed) | Tâches, projets |
| 7 | **Heatmap** | Grille personnes × jours, intensité = charge | Planning équipe, tâches |
| 8 | **Roster** | Planning shifts par employé, lignes = personnes | Planning équipe, congés |
| 9 | **Tasks** | Liste filtrable avec tri, recherche, assignation | Tâches, projets |
| 10 | **Disponibilité** | Colonnes multi-ressources (personnes + salles), zones libres en vert | Collègues, salles, matériel, véhicules |
| 11 | **Tableau de présence** | Grille employés × jours (bureau/remote/absent) + diagramme step-chart effectifs par poste | Congés, planning équipe, shifts |

### Vue Tableau de présence — Diagramme step-chart

Panneau supérieur de la vue : diagramme d'effectifs par poste.

- **Axe X** = heures de la journée (ou jours de la semaine en vue hebdo)
- **Axe Y** = nombre de personnes présentes
- **Une courbe par poste** (technicien, vendeur, admin, etc.) en step-chart (escalier)
- **Front montant** = arrivée d'un employé, **front descendant** = départ ou pause
- **Seuils min/max** affichés en ligne pointillée par poste — zone rouge si en dessous du minimum
- **Filtrable** par équipe, département, site
- **Interactif** : clic sur un point = liste des personnes présentes à ce moment

Panneau inférieur : grille employés × jours avec cellule colorée par statut (bureau=vert, remote=bleu, congé=orange, absent=rouge). Cellule bordée rouge si violation d'une règle de présence.

---

## 4. Gestion des congés

### Flux employé

1. L'employé crée un événement `event_type=leave` dans son calendrier, sélectionne `leave_type`
2. Au moment de la création : affichage immédiat de qui d'autre est absent dans l'équipe sur la même période, et si ça viole les règles de couverture min
3. Affichage du solde prédictif : "Si tu poses ces 3 jours, il te restera 8 CP au 31/12"
4. L'événement est créé en `status=pending` — visible en semi-transparent
5. Notification au manager

### Flux manager

1. Le manager voit les demandes dans son layer "Congés équipe" (semi-transparent = pending)
2. Approuve/refuse depuis le calendrier (clic droit ou panneau latéral)
3. Peut ajouter un commentaire (`approval_comment`)
4. Si approuvé : `status=approved`, opaque, `leave_balances.used_days` incrémenté
5. Si refusé : `status=rejected`, événement barré avec raison

### Workflow en cascade

Configurable via `approval_workflows` :
- Congés > 5 jours : approbation manager + RH
- Périodes sensibles (été, fêtes) : approbation manager + N+2
- Le premier approbateur voit la demande. Une fois approuvée par lui, elle passe au suivant.

### Délégation automatique

Quand un congé est approuvé :
- Le système liste les tâches/événements de l'employé sur la période
- Propose de réassigner à un collègue (suggestion basée sur la charge via heatmap)
- L'employé ou le manager confirme la délégation
- Les tâches réassignées apparaissent dans le calendrier du collègue

---

## 5. Présence et règles RH

### Déclaration de présence

- Chaque employé a un shift implicite ou explicite avec `presence_mode` : office/remote/absent
- Peut être déclaré manuellement (événement de type shift dans le calendrier)
- Ou déduit automatiquement : shift existant = office, leave approuvé = absent, pas de shift = selon défaut équipe
- Le pointage (`clock-in.tsx` existant) alimente les heures réelles et confirme la présence effective

### Règles de présence

Configurées par admin/manager dans `presence_rules` :

| Type | Exemple | Enforcement |
|------|---------|-------------|
| `min_onsite` | 3 jours/semaine au bureau | soft ou hard |
| `mandatory_days` | mardi et jeudi obligatoires | soft ou hard |
| `max_remote_same_day` | max 2 personnes remote le même jour dans l'équipe | soft ou hard |
| `min_coverage` | minimum 2 techniciens présents de 8h à 18h | soft ou hard |

### Validation automatique

- Quand un employé crée un congé ou déclare remote : vérification temps réel des règles
- `soft` = avertissement jaune, l'employé peut quand même soumettre
- `hard` = blocage rouge, impossible de soumettre sans dérogation manager
- Le Tableau de présence affiche les violations (cellules rouges) pour que le manager voie d'un coup d'oeil

---

## 6. Fiches d'heures

### Génération automatique

- Chaque événement avec durée crée automatiquement une `timesheet_entry` (`auto_generated=true`)
- La catégorie de l'événement détermine le type d'heure via les règles de la catégorie :
  - Catégorie "Astreinte" → `counts_as: overtime`
  - Catégorie "Formation" → `counts_as: training`, `budget: formation`
  - Événement sans catégorie → heures normales
- Les shifts (event_type=shift) alimentent les heures de présence
- Le pointage (clock-in/out) corrige les heures réelles vs planifiées

### Validation hebdomadaire

- En fin de semaine, l'employé voit ses timesheet_entries auto-générées
- Il peut corriger (ajouter du temps, modifier la catégorie) et valider (`validated=true`)
- Le manager peut consulter les fiches de son équipe

### Export RH

- Les entries validées sont exportables vers le module RH/paie (`exported_at` marqué)
- Format configurable (CSV, intégration directe paie)

---

## 7. Ressources (salles, matériel, véhicules)

### Modèle unifié

Les ressources existantes dans `calendar.resources` sont conservées. Elles deviennent des layers dans le calendrier.

Réserver une ressource = créer un événement `event_type=booking` avec `resource_id`. L'événement apparaît dans le layer de la ressource ET dans le calendrier personnel du réservant.

### Floor plan

Le floor plan existant (`scheduling/resources/FloorPlan.tsx`) est intégré comme mode de visualisation dans le calendrier. En vue Day ou Week, un toggle "Plan" affiche le plan d'étage avec les salles colorées selon disponibilité (vert=libre, rouge=occupé, orange=bientôt libre).

### Vue Disponibilité

La vue #10 affiche les ressources (personnes + salles + matériel + véhicules) en colonnes côte à côte. Chaque colonne est une grille horaire. Les zones libres sont vertes. Permet de trouver un créneau où tout fitte en un coup d'oeil.

---

## 8. Suppression des doublons

### Frontend — Composants supprimés

| Dossier | Composants supprimés | Raison |
|---------|---------------------|--------|
| `scheduling/views/` | DayView, WeekView, MonthView, AgendaView | Doublons des vues calendar/ |
| `scheduling/calendar/` | RecurrenceEditor | Doublon de calendar/RecurrenceEditor |
| `scheduling/calendar/` | AttendeeManager | Doublon de calendar/AttendeeList |
| `scheduling/core/` | SchedulingHub | Remplacé par le CalendarHub unifié |
| `stores/scheduling/` | Tous les stores | Absorbés par calendar-store.ts |
| `lib/scheduling/api/` | Tous les modules API | Absorbés par lib/api/calendar.ts |
| `hr/leave-management.tsx` | leave-management | Absorbé par la vue Tableau de présence |
| `hr/leave-calendar-blocker.tsx` | leave-calendar-blocker | Absorbé par le layer Congés |
| `workforce/leave-calendar.tsx` | leave-calendar | Absorbé par la vue Tableau de présence |
| `workforce/leave-request.tsx` | leave-request | Absorbé par la création d'événement leave |

### Frontend — Composants conservés et migrés depuis scheduling/

| Composant scheduling/ | Migré vers calendar/ | Raison |
|----------------------|---------------------|--------|
| `views/TimelineView.tsx` | `calendar/TimelineView.tsx` | Vue unique, pas de doublon |
| `views/KanbanView.tsx` | `calendar/KanbanView.tsx` | Vue unique |
| `views/HeatmapView.tsx` | `calendar/HeatmapView.tsx` | Vue unique |
| `views/RosterView.tsx` | `calendar/RosterView.tsx` | Vue unique |
| `views/TasksView.tsx` | `calendar/TasksView.tsx` | Vue unique |
| `resources/FloorPlan.tsx` | `calendar/FloorPlan.tsx` | Vue unique |
| `resources/ResourcesView.tsx` | `calendar/ResourcesView.tsx` | Vue unique |
| `tasks/TaskKanban.tsx` | `calendar/TaskKanban.tsx` | Vue unique |
| `team/WorkloadDashboard.tsx` | `calendar/WorkloadDashboard.tsx` | Vue unique |
| `meeting-scheduler/` | `calendar/meeting-scheduler/` | Find-a-time |
| `command-palette/` | `calendar/command-palette/` | Cmd+K quick create |
| `analytics/` | `calendar/analytics/` | Analytique temps |
| `productivity/` | `calendar/productivity/` | Pomodoro, NLP |

### Backend — Suppression signapps-scheduler

- Les handlers `time_items.rs`, `tasks.rs`, `events.rs`, `resources.rs`, `projects.rs` sont absorbés par signapps-calendar
- Le handler `jobs.rs` (CRON jobs) est absorbé par signapps-calendar comme `event_type=cron`
- Le schema `scheduling` est abandonné après migration des données existantes vers `calendar`
- Le service `signapps-scheduler` est retiré du workspace Cargo et des scripts de démarrage

### Pages supprimées/redirigées

| Page | Action |
|------|--------|
| `/scheduling` | Redirige vers `/cal` |
| `/resources` | Redirige vers `/cal` (vue Disponibilité, layer Ressources activé) |
| `/resources/my-reservations` | Redirige vers `/cal` (layer Mes événements filtré sur bookings) |

---

## 9. Migration des données

### Schema scheduling → calendar

1. Migrer `scheduling.time_items` → `calendar.events` avec mapping :
   - `time_item.item_type` → `event.event_type`
   - `time_item.scope` → `event.scope`
   - `time_item.status` → `event.status`
   - Créer un `calendar` par défaut pour les items orphelins
2. Migrer `scheduling.resources` → `calendar.resources` (dédupliquer par nom)
3. Migrer `scheduling.recurrence_rules` → `calendar.events.rrule` (convertir en RFC 5545)
4. Migrer `scheduling.time_item_users` → `calendar.event_attendees`
5. Migrer `scheduling.booking_rules` → config dans `calendar.resources` (JSONB)
6. Marquer le schema `scheduling` comme deprecated (ne pas DROP immédiatement)

### CRON jobs

Les jobs existants dans `scheduling.time_items` (type=cron) migrent vers `calendar.events` avec `event_type=cron`. L'exécution CRON est gérée par un worker background dans signapps-calendar.

---

## 10. Résumé des endpoints à ajouter à signapps-calendar

### Congés
- `POST /api/v1/events` (event_type=leave) — existant, enrichi
- `PUT /api/v1/events/:id/approve` — nouveau
- `PUT /api/v1/events/:id/reject` — nouveau
- `GET /api/v1/leave/balances` — nouveau
- `GET /api/v1/leave/balances/predict?days=N&date=YYYY-MM-DD` — nouveau (solde prédictif)
- `GET /api/v1/leave/team-conflicts?start=&end=` — nouveau
- `POST /api/v1/leave/delegate` — nouveau (réassignation tâches)

### Présence
- `GET /api/v1/presence/rules` — nouveau
- `POST /api/v1/presence/rules` — nouveau
- `PUT/DELETE /api/v1/presence/rules/:id` — nouveau
- `POST /api/v1/presence/validate` — nouveau (vérifier si une action viole des règles)
- `GET /api/v1/presence/team-status?date=` — nouveau (statut présence équipe)
- `GET /api/v1/presence/headcount?date=&team_id=` — nouveau (step-chart data)

### Catégories
- `GET/POST /api/v1/categories` — nouveau
- `PUT/DELETE /api/v1/categories/:id` — nouveau

### Fiches d'heures
- `GET /api/v1/timesheets?user_id=&week=` — nouveau
- `PUT /api/v1/timesheets/:id` — nouveau (correction manuelle)
- `POST /api/v1/timesheets/validate` — nouveau (validation hebdo)
- `POST /api/v1/timesheets/export` — nouveau (export RH)

### Approbation
- `GET/POST /api/v1/approval-workflows` — nouveau
- `PUT/DELETE /api/v1/approval-workflows/:id` — nouveau

### CRON (absorbé du scheduler)
- `GET/POST /api/v1/cron-jobs` — migré depuis scheduler
- `PUT/DELETE /api/v1/cron-jobs/:id` — migré
- `POST /api/v1/cron-jobs/:id/run` — migré

### Layers
- `GET/PUT /api/v1/layers/config` — nouveau (persistance serveur de la config layers)
