# Calendrier Unifié — signapps-calendar

> Documentation technique interne — dernière mise à jour : 2026-03-30

---

## 1. Contexte et historique

### Fusion calendar + scheduler

Initialement, la plateforme possédait deux services séparés :
- **signapps-scheduler** (port 3007) — CRON jobs, planification, items temporels
- **signapps-calendar** (port 3011) — Calendrier personnel et d'équipe

La **migration 098** (`098_migrate_scheduling_to_calendar.sql`) a absorbé `signapps-scheduler` dans `signapps-calendar`. Le schéma `scheduling` est désormais **déprécié** (annoté en base avec `COMMENT ON SCHEMA`). Toutes les données ont été migrées de manière idempotente vers le schéma `calendar`.

### Motivations

- Un seul service à maintenir et déployer
- Vue unifiée : événements, tâches, congés, CRON dans la même interface
- Modèle de données extensible via `event_type` plutôt que des tables séparées
- Workflow d'approbation unifié pour congés, shifts, bookings

---

## 2. Modèle de données

### Table centrale : `calendar.events`

La table `events` est le pivot du système. Tous les types d'entrées temporelles y sont stockés.

```sql
CREATE TABLE calendar.events (
    id                UUID PRIMARY KEY,
    calendar_id       UUID NOT NULL REFERENCES calendar.calendars(id),
    title             VARCHAR(500) NOT NULL,
    description       TEXT,
    location          VARCHAR(500),
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ NOT NULL,
    rrule             VARCHAR(500),       -- RFC 5545 RRULE
    rrule_exceptions  UUID[],             -- IDs des exceptions
    timezone          VARCHAR(100),
    created_by        UUID NOT NULL,
    is_all_day        BOOLEAN DEFAULT FALSE,
    -- Champs unifiés (migration 093)
    event_type        calendar.event_type DEFAULT 'event',
    scope             calendar.event_scope DEFAULT 'personal',
    status            calendar.event_status,
    priority          calendar.event_priority,
    parent_event_id   UUID,               -- hiérarchie
    resource_id       UUID,               -- ressource réservée
    category_id       UUID,               -- catégorie personnalisée
    leave_type        calendar.leave_type,
    presence_mode     calendar.presence_mode,
    approval_by       UUID,               -- qui a approuvé
    approval_comment  TEXT,
    energy_level      calendar.energy_level,
    cron_expression   VARCHAR(100),       -- pour event_type='cron'
    cron_target       TEXT,
    assigned_to       UUID,
    project_id        UUID,
    tags              VARCHAR(50)[]
);
```

### Types énumérés

**event_type** — 8 valeurs :

| Valeur | Description | Champs spécifiques |
|--------|-------------|-------------------|
| `event` | Événement calendrier standard | — |
| `task` | Tâche avec statut et priorité | `status`, `priority`, `assigned_to` |
| `leave` | Demande de congé | `leave_type`, `status` (flux approbation) |
| `shift` | Permanence / astreinte | `scope=team`, `resource_id` optionnel |
| `booking` | Réservation de ressource | `resource_id` (obligatoire) |
| `milestone` | Jalon de projet | `project_id`, `priority` |
| `blocker` | Temps bloqué (pas de dérangement) | `scope`, `energy_level` |
| `cron` | Job CRON planifié | `cron_expression`, `cron_target` |

**Autres enums :**

```
leave_type:     cp | rtt | sick | unpaid | other
event_scope:    personal | team | org
event_status:   draft | pending | approved | rejected | completed
event_priority: low | medium | high | urgent
presence_mode:  office | remote | absent
energy_level:   low | medium | high
rule_type:      min_onsite | mandatory_days | max_remote_same_day | min_coverage
enforcement:    soft | hard
```

### Tables complémentaires

**`calendar.categories`** — Catégories personnalisées :
```sql
id, name, color (hex), icon, owner_id, org_id, rules (JSONB), created_at, updated_at
```

**`calendar.presence_rules`** — Règles de présence RH :
```sql
id, org_id, team_id, rule_type, rule_config (JSONB), enforcement, active
```

**`calendar.leave_balances`** — Soldes de congés par utilisateur et par année :
```sql
id, user_id, leave_type, year, total_days, used_days, pending_days, updated_at
UNIQUE(user_id, leave_type, year)
```

**`calendar.timesheet_entries`** — Fiches d'heures :
```sql
id, user_id, event_id, date, hours, category_id, auto_generated, validated,
validated_at, exported_at, created_at, updated_at
```

**`calendar.approval_workflows`** — Workflows d'approbation :
```sql
id, org_id, trigger_type, trigger_config (JSONB), approvers (JSONB), active
```

---

## 3. Système de layers

Les layers permettent à chaque utilisateur de contrôler la visibilité des différents types de données dans le calendrier. La configuration est stockée en JSONB dans `identity.user_preferences` sous la clé `calendar_layers`.

### 11 layers natifs

| ID | Label | Visible par défaut | Couleur |
|----|-------|--------------------|---------|
| `events` | Événements | Oui | `#3b82f6` (bleu) |
| `tasks` | Tâches | Oui | `#8b5cf6` (violet) |
| `leave` | Congés | Oui | `#f59e0b` (ambre) |
| `shifts` | Permanences | Oui | `#10b981` (vert) |
| `resources` | Ressources | Non | `#6366f1` (indigo) |
| `presence` | Présence | Oui | `#06b6d4` (cyan) |
| `ooo` | Hors du bureau | Oui | `#ef4444` (rouge) |
| `milestones` | Jalons | Non | `#f97316` (orange) |
| `cron` | CRON jobs | Non | `#64748b` (gris) |
| `birthdays` | Anniversaires | Non | `#ec4899` (rose) |
| `external` | Sync externe | Oui | `#a855f7` (pourpre) |

### Comportement

- `visible: true` — le layer s'affiche dans toutes les vues
- `visible: false` — les événements du layer sont masqués (ne sont pas filtrés côté serveur, le filtre est côté client)
- Le backend stocke et retourne la config opaque — le frontend en est propriétaire
- Endpoint : `GET/PUT /api/v1/layers/config`

### Panneau latéral

Le panneau des layers (sidebar droite) affiche :
- Toggle par layer (couleur + icône)
- Filtres rapides par équipe, par personne
- Mini-légende des statuts (draft/pending/approved)

---

## 4. 11 vues du calendrier

| Vue | Description | Types d'événements visibles |
|-----|-------------|----------------------------|
| **Day** | Grille horaire sur 24h | Tous (positionnés dans la grille) |
| **Week** | Grille 7 colonnes × 24h | Tous |
| **Month** | Grille mensuelle classique | Tous (compressés) |
| **Agenda** | Liste chronologique | Tous |
| **Timeline** | Gantt horizontal multi-ressources | events, booking, shift, milestone |
| **Kanban** | Colonnes par statut | task (prioritairement) |
| **Heatmap** | Carte de chaleur par jour | Densité d'événements / congés |
| **Roster** | Tableau équipe × jours | leave, presence, shift |
| **Tasks** | Arbre de tâches hiérarchique | task uniquement |
| **Disponibilité** | Créneaux libres / occupés | Calcul inverse depuis events |
| **Tableau présence** | Grille présence RH step-chart | presence, leave |

---

## 5. Gestion des congés

### Types de congés

| Code | Libellé |
|------|---------|
| `cp` | Congés payés |
| `rtt` | RTT |
| `sick` | Maladie |
| `unpaid` | Congés sans solde |
| `other` | Autre |

### Flux employé

1. L'employé crée un événement `event_type='leave'`, `status='draft'`
2. Il soumet sa demande → `status='pending'`
3. Notification automatique au(x) manager(s)

### Flux manager

1. Visualisation des demandes en attente dans la vue Roster / vue Calendrier (layer congés)
2. Vérification des conflits d'équipe via `GET /api/v1/leave/team-conflicts?start=&end=`
3. Approbation : `PUT /api/v1/events/:id/approve` → `status='approved'`
4. Rejet : `PUT /api/v1/events/:id/reject` + commentaire obligatoire → `status='rejected'`

### Workflow cascade

Si le manager est absent (lui-même en congé), `approval_workflows` configure :
- Des approbateurs alternatifs (`approvers: [primary, fallback1, fallback2]`)
- Un escalier temporel (approbation automatique après N jours si non traité)

### Délégation automatique

Lors de l'approbation d'un congé, `POST /api/v1/leave/delegate` permet de réassigner les tâches de l'employé absent :

```json
{
  "event_id": "uuid-du-conge",
  "assignments": [
    { "task_id": "uuid-tache-1", "assign_to": "uuid-collègue" }
  ]
}
```

### Soldes prédictifs

`GET /api/v1/leave/balances/predict?days=5&leave_type=cp` retourne :

```json
{
  "leave_type": "cp",
  "year": 2026,
  "total_days": 25.0,
  "used_days": 10.0,
  "pending_days": 2.0,
  "requested_days": 5.0,
  "predicted_remaining": 8.0
}
```

---

## 6. Présence RH

### Règles de présence

Les règles définissent des contraintes sur la présence au bureau. Elles sont configurées par `org_id` et optionnellement par `team_id`.

| rule_type | Description | Exemple de rule_config |
|-----------|-------------|----------------------|
| `min_onsite` | Jours minimum en présentiel par semaine | `{"days_per_week": 2}` |
| `mandatory_days` | Jours obligatoires en présentiel | `{"days": ["tuesday", "thursday"]}` |
| `max_remote_same_day` | Maximum d'absents simultanés dans l'équipe | `{"max_percent": 50}` |
| `min_coverage` | Couverture minimum garantie | `{"min_count": 3, "time_slots": ["09:00", "17:00"]}` |

### Niveaux d'enforcement

- **`soft`** : Avertissement affiché à l'utilisateur, mais l'action est autorisée
- **`hard`** : Blocage de l'action, retour d'erreur 422

### Validation

`POST /api/v1/presence/validate` — vérifie une action planifiée contre toutes les règles actives :

```json
{
  "event_type": "leave",
  "start_date": "2026-04-07",
  "end_date": "2026-04-11",
  "presence_mode": "remote"
}
```

Retour :
```json
{
  "violations": [
    {
      "rule_id": "uuid",
      "rule_type": "min_onsite",
      "enforcement": "soft",
      "message": "Vous avez prévu moins de 2 jours en présentiel cette semaine."
    }
  ]
}
```

### Statut d'équipe

`GET /api/v1/presence/team-status?date=2026-04-07` retourne la liste de chaque membre avec son mode de présence (`office | remote | absent`) pour le jour donné.

### Headcount (step-chart)

`GET /api/v1/presence/headcount?date=2026-04-07` retourne la présence par créneau horaire, utilisé pour le step-chart dans la vue "Tableau de présence" :

```json
[
  { "time": "09:00", "role": "developer", "count": 12 },
  { "time": "14:00", "role": "developer", "count": 8 }
]
```

---

## 7. Fiches d'heures (Timesheets)

### Auto-génération

À la fin de chaque journée (ou à la demande via `POST /api/v1/timesheets/generate`), le système parcourt les événements calendrier de l'utilisateur et génère automatiquement des entrées `timesheet_entries` (`auto_generated=true`).

Le calcul : durée de l'événement en heures, arrondie au quart d'heure. Les événements de type `leave` et `cron` sont exclus.

### Validation hebdomadaire

`POST /api/v1/timesheets/validate` avec `{"week": "2026-W13"}` :
- Marque toutes les entrées de la semaine comme `validated=true`
- Enregistre `validated_at`
- Retourne `{"week": "2026-W13", "rows_validated": 35}`

### Export

`POST /api/v1/timesheets/export` avec `{"start": "2026-01-01", "end": "2026-03-31"}` :
- Marque les entrées comme `exported_at=now()`
- Retourne les entrées pour génération CSV/PDF côté client

### Consultation

`GET /api/v1/timesheets?week=2026-W13` — retourne les entrées de la semaine de l'utilisateur connecté. Un admin peut filtrer par `?user_id=uuid`.

---

## 8. Catégories personnalisées

### Structure

Chaque catégorie a :
- `name` — libellé (ex. "Projets clients")
- `color` — couleur hexadécimale (ex. "#f59e0b")
- `icon` — icône (ex. "briefcase", nom Lucide)
- `owner_id` — catégorie personnelle, ou
- `org_id` — catégorie partagée à l'organisation
- `rules` — JSONB de règles optionnelles (ex. durée max, notification)

### Portée

- Les catégories `owner_id` sont visibles uniquement par leur créateur
- Les catégories `org_id` sont visibles par tous les membres de l'organisation
- `list_categories` retourne les deux types accessibles à l'utilisateur

### Application

Les catégories s'appliquent à :
- Les événements via `event.category_id`
- Les entrées de fiches d'heures via `timesheet_entries.category_id`

---

## 9. Synchronisation externe

### Fournisseurs supportés

Google Calendar, Microsoft 365 / Outlook, CalDAV générique.

### Flux OAuth

1. `POST /api/v1/external-sync/oauth/init` — initialise le flux OAuth, retourne l'URL
2. `POST /api/v1/external-sync/oauth/callback` — traite le callback, crée la connexion
3. `GET /api/v1/external-sync/connections/:id/calendars` — liste les calendriers distants
4. `POST /api/v1/external-sync/connections/:connection_id/discover` — découverte automatique

### CalDAV natif

Le service expose également un endpoint CalDAV compatible :
- `PROPFIND /caldav/principals/:user_id`
- `PROPFIND /caldav/calendars/:calendar_id`
- `GET /caldav/calendars/:calendar_id/events/:event_id.ics`

---

## 10. Endpoints API — tableau récapitulatif des nouveaux endpoints

Endpoints ajoutés avec la fusion calendar + scheduler (absents dans la version initiale) :

| Méthode | Chemin | Description |
|---------|--------|-------------|
| PUT | `/api/v1/events/:id/approve` | Approuver un congé / shift |
| PUT | `/api/v1/events/:id/reject` | Rejeter avec commentaire |
| GET | `/api/v1/leave/balances` | Soldes de congés |
| GET | `/api/v1/leave/balances/predict` | Solde prévisionnel |
| GET | `/api/v1/leave/team-conflicts` | Conflits d'équipe sur période |
| POST | `/api/v1/leave/delegate` | Déléguer les tâches |
| GET | `/api/v1/presence/rules` | Lister les règles RH |
| POST | `/api/v1/presence/rules` | Créer une règle |
| PUT | `/api/v1/presence/rules/:id` | Modifier une règle |
| DELETE | `/api/v1/presence/rules/:id` | Supprimer une règle |
| POST | `/api/v1/presence/validate` | Valider une action vs règles |
| GET | `/api/v1/presence/team-status` | Statut présence équipe |
| GET | `/api/v1/presence/headcount` | Effectif par créneau |
| GET | `/api/v1/categories` | Lister les catégories |
| POST | `/api/v1/categories` | Créer une catégorie |
| PUT | `/api/v1/categories/:id` | Modifier une catégorie |
| DELETE | `/api/v1/categories/:id` | Supprimer une catégorie |
| GET | `/api/v1/timesheets` | Lister les fiches d'heures |
| PUT | `/api/v1/timesheets/:id` | Modifier une entrée |
| POST | `/api/v1/timesheets/validate` | Valider une semaine |
| POST | `/api/v1/timesheets/export` | Exporter |
| POST | `/api/v1/timesheets/generate` | Générer depuis événements |
| GET | `/api/v1/layers/config` | Config layers utilisateur |
| PUT | `/api/v1/layers/config` | Sauvegarder config layers |
| GET | `/api/v1/approval-workflows` | Workflows d'approbation |
| POST | `/api/v1/approval-workflows` | Créer un workflow |
| PUT | `/api/v1/approval-workflows/:id` | Modifier |
| DELETE | `/api/v1/approval-workflows/:id` | Supprimer |
| GET | `/api/v1/cron-jobs` | CRON jobs (ex-scheduler) |
| POST | `/api/v1/cron-jobs` | Créer un CRON job |
| PUT | `/api/v1/cron-jobs/:id` | Modifier |
| DELETE | `/api/v1/cron-jobs/:id` | Supprimer |
| POST | `/api/v1/cron-jobs/:id/run` | Exécuter immédiatement |

---

*Pour l'API complète, voir `docs/API_REFERENCE.md`. Pour l'architecture générale, voir `docs/ARCHITECTURE.md`.*
