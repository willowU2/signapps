---
stepsCompleted: [1, 2, 3]
inputDocuments: ['prd-unified-scheduling-ui.md', 'ux-architecture-unified-scheduling.md']
workflowType: 'epics-stories'
status: 'draft'
version: '1.0'
totalStoryPoints: 233
phases: 4
---

# Epics & Stories
## Unified Scheduling UI - Tasks, Calendar, Resource Booking

**Author:** Etienne
**Date:** 2026-03-18
**Version:** 1.0
**Status:** Draft

---

## Summary

| Phase | Epic | Stories | Points | Duration |
|-------|------|---------|--------|----------|
| MVP | Core Infrastructure | 5 | 21 | 1.5 sem |
| MVP | Calendar Views | 6 | 34 | 2 sem |
| MVP | Command Palette | 4 | 21 | 1.5 sem |
| MVP | Mobile & Responsive | 3 | 13 | 1 sem |
| 2 | Tasks Integration | 5 | 26 | 2 sem |
| 2 | Natural Language | 4 | 21 | 1.5 sem |
| 2 | Advanced Interactions | 3 | 13 | 0.5 sem |
| 3 | Resource Booking | 4 | 21 | 1.5 sem |
| 3 | Team Features | 4 | 21 | 1.5 sem |
| 4 | Advanced Features | 4 | 21 | 2 sem |
| 4 | AI & Analytics | 4 | 21 | 2 sem |
| **Total** | **11 Epics** | **46 Stories** | **233** | **~18 sem** |

---

# Phase 1: MVP (6 semaines)

## Epic 1.1: Core Infrastructure

### Story 1.1.1: Create Scheduling Store
**Points:** 5 | **Priority:** P0

**Description:**
Créer le store Zustand pour la gestion d'état du module scheduling.

**Acceptance Criteria:**
- [ ] Store créé avec état: activeTab, activeView, currentDate, selectedEventId
- [ ] Actions: setView, navigateDate, goToDate, selectEvent
- [ ] Persistence des préférences utilisateur (vue, sidebar)
- [ ] Tests unitaires pour toutes les actions

**Technical Notes:**
```typescript
// stores/scheduling-store.ts
interface SchedulingState {
  activeTab: 'my-day' | 'tasks' | 'resources' | 'team';
  activeView: ViewType;
  currentDate: Date;
  // ...
}
```

**Files:**
- `client/src/stores/scheduling-store.ts` (create)
- `client/src/lib/scheduling/types/scheduling.ts` (create)

---

### Story 1.1.2: Create Calendar API Client
**Points:** 3 | **Priority:** P0

**Description:**
Créer le client API pour les opérations CRUD sur les événements.

**Acceptance Criteria:**
- [ ] Client avec méthodes: getEvents, createEvent, updateEvent, deleteEvent
- [ ] Support des filtres par date range
- [ ] Gestion des erreurs avec toast
- [ ] Types TypeScript complets

**Files:**
- `client/src/lib/scheduling/api/calendar.ts` (create)

---

### Story 1.1.3: Create SchedulingHub Container
**Points:** 5 | **Priority:** P0

**Description:**
Créer le composant container principal qui orchestre toutes les vues.

**Acceptance Criteria:**
- [ ] Layout avec sidebar + main content
- [ ] 4 onglets: My Day, Tasks, Resources, Team
- [ ] Intégration du ViewSwitcher et DateNavigator
- [ ] Responsive: sidebar collapsible sur tablet

**Dependencies:** Story 1.1.1

**Files:**
- `client/src/components/scheduling/core/SchedulingHub.tsx` (create)
- `client/src/app/scheduling/page.tsx` (create)
- `client/src/app/scheduling/layout.tsx` (create)

---

### Story 1.1.4: Create ViewSwitcher Component
**Points:** 3 | **Priority:** P0

**Description:**
Barre de sélection des vues temporelles avec animations.

**Acceptance Criteria:**
- [ ] Vues: Agenda, Jour, 3-Jours, Semaine, Mois
- [ ] Animation slide entre vues
- [ ] Raccourcis clavier 1-5
- [ ] Mode compact pour mobile (icons only)

**Files:**
- `client/src/components/scheduling/core/ViewSwitcher.tsx` (create)

---

### Story 1.1.5: Create DateNavigator Component
**Points:** 5 | **Priority:** P0

**Description:**
Navigation entre dates avec titre contextualisé et mini calendar.

**Acceptance Criteria:**
- [ ] Titre adapté à la vue (Mars 2026, Semaine 12, etc.)
- [ ] Boutons prev/next/today
- [ ] Raccourcis: T=today, G=go to date, H/L=prev/next
- [ ] Mini calendar dropdown

**Dependencies:** Story 1.1.1

**Files:**
- `client/src/components/scheduling/core/DateNavigator.tsx` (create)

---

## Epic 1.2: Calendar Views

### Story 1.2.1: Create TimeGrid Base Component
**Points:** 8 | **Priority:** P0

**Description:**
Composant de base pour les vues jour/3-jours/semaine avec grille horaire.

**Acceptance Criteria:**
- [ ] Grille avec time gutter (heures) et colonnes (jours)
- [ ] Slots configurables: 15/30/60 min
- [ ] Working hours highlight (9h-18h)
- [ ] All-day events section en header
- [ ] Click sur slot vide = création rapide

**Technical Notes:**
```typescript
interface TimeGridProps {
  startDate: Date;
  days: number;
  events: ScheduleBlock[];
  slotDuration?: 15 | 30 | 60;
  onSlotClick: (start: Date, end: Date) => void;
}
```

**Files:**
- `client/src/components/scheduling/calendar/TimeGrid.tsx` (create)
- `client/src/components/scheduling/calendar/DayColumn.tsx` (create)
- `client/src/components/scheduling/calendar/TimeGutter.tsx` (create)

---

### Story 1.2.2: Create EventBlock Component
**Points:** 5 | **Priority:** P0

**Description:**
Bloc d'événement réutilisable avec états visuels.

**Acceptance Criteria:**
- [ ] Affichage: titre, heure, couleur type
- [ ] États: default, hover, selected, dragging, past
- [ ] Calcul du layout (top, height, width) pour overlaps
- [ ] Tooltip au hover avec détails

**Files:**
- `client/src/components/scheduling/calendar/EventBlock.tsx` (create)
- `client/src/lib/scheduling/utils/event-layout.ts` (create)
- `client/src/lib/scheduling/utils/overlap-calculator.ts` (create)

---

### Story 1.2.3: Create Day View
**Points:** 3 | **Priority:** P0

**Description:**
Vue jour complète avec timeline 24h.

**Acceptance Criteria:**
- [ ] Utilise TimeGrid avec days=1
- [ ] Now Line avec heure courante
- [ ] Auto-scroll vers "maintenant" au chargement
- [ ] Multi-day events en header

**Dependencies:** Story 1.2.1, Story 1.2.2

**Files:**
- `client/src/components/scheduling/views/DayView.tsx` (create)

---

### Story 1.2.4: Create Week View
**Points:** 5 | **Priority:** P0

**Description:**
Vue semaine avec 7 colonnes.

**Acceptance Criteria:**
- [ ] Utilise TimeGrid avec days=7
- [ ] Toggle weekdays only (5 jours)
- [ ] Weekend collapse optionnel
- [ ] Tasks intégrées en bas de chaque jour

**Dependencies:** Story 1.2.1

**Files:**
- `client/src/components/scheduling/views/WeekView.tsx` (create)

---

### Story 1.2.5: Create Month View with Heatmap
**Points:** 8 | **Priority:** P0

**Description:**
Vue mois avec grille traditionnelle et heatmap de densité.

**Acceptance Criteria:**
- [ ] Grille 7 colonnes x 4-6 lignes
- [ ] Background color selon densité (heatmap)
- [ ] Dots colorés pour événements (max 4)
- [ ] Click jour = expansion détails
- [ ] Hover = preview événements

**Files:**
- `client/src/components/scheduling/calendar/MonthGrid.tsx` (create)
- `client/src/components/scheduling/views/MonthView.tsx` (create)

---

### Story 1.2.6: Create Agenda View
**Points:** 5 | **Priority:** P0

**Description:**
Liste chronologique scrollable style Fantastical.

**Acceptance Criteria:**
- [ ] Groupement par jour avec sticky headers
- [ ] Infinite scroll bidirectionnel
- [ ] Virtualisation pour performance
- [ ] Tasks intégrées avec icône différente
- [ ] Preview inline au click

**Files:**
- `client/src/components/scheduling/calendar/AgendaList.tsx` (create)
- `client/src/components/scheduling/views/AgendaView.tsx` (create)

---

## Epic 1.3: Command Palette

### Story 1.3.1: Create Command Palette Base
**Points:** 5 | **Priority:** P0

**Description:**
Interface modale accessible via ⌘K avec recherche et commandes.

**Acceptance Criteria:**
- [ ] Ouverture via ⌘K (Mac) / Ctrl+K (Windows)
- [ ] Input de recherche avec focus auto
- [ ] Liste de commandes groupées par catégorie
- [ ] Navigation clavier (↑/↓/Enter/Escape)
- [ ] Animation entrée/sortie fluide

**Files:**
- `client/src/components/scheduling/command-palette/CommandPalette.tsx` (create)
- `client/src/components/scheduling/command-palette/CommandList.tsx` (create)
- `client/src/components/scheduling/command-palette/CommandItem.tsx` (create)

---

### Story 1.3.2: Implement Command Registry
**Points:** 3 | **Priority:** P0

**Description:**
Système d'enregistrement des commandes disponibles.

**Acceptance Criteria:**
- [ ] Interface Command avec id, icon, label, shortcut, action
- [ ] Catégories: navigation, create, search, action
- [ ] Recent commands tracking
- [ ] Filtrage par texte recherché

**Files:**
- `client/src/lib/scheduling/commands/registry.ts` (create)
- `client/src/lib/scheduling/commands/default-commands.ts` (create)

---

### Story 1.3.3: Add Navigation Commands
**Points:** 5 | **Priority:** P0

**Description:**
Commandes de navigation dans le calendrier.

**Acceptance Criteria:**
- [ ] "Aller à aujourd'hui" (T)
- [ ] "Aller à une date..." (G) + date picker
- [ ] "Vue jour/semaine/mois" (1-5)
- [ ] "Rechercher un événement"

**Dependencies:** Story 1.3.1, Story 1.3.2

---

### Story 1.3.4: Add Quick Create Commands
**Points:** 8 | **Priority:** P0

**Description:**
Création rapide d'événements depuis la command palette.

**Acceptance Criteria:**
- [ ] "Nouvel événement" (N) → formulaire rapide
- [ ] "Nouvelle tâche" (⇧N) → formulaire tâche
- [ ] Input libre → parsing naturel basique
- [ ] Preview de l'interprétation avant création
- [ ] Confirmation en 1 clic

**Files:**
- `client/src/components/scheduling/command-palette/QuickCreate.tsx` (create)

---

## Epic 1.4: Mobile & Responsive

### Story 1.4.1: Implement Responsive Layouts
**Points:** 5 | **Priority:** P0

**Description:**
Adapter tous les composants aux 3 breakpoints.

**Acceptance Criteria:**
- [ ] Mobile (< 640px): bottom tabs, full screen content
- [ ] Tablet (640-1024px): collapsible sidebar
- [ ] Desktop (> 1024px): full sidebar, multi-pane
- [ ] Tests sur tous les breakpoints

**Dependencies:** Epic 1.2

**Files:**
- All view components (modify)

---

### Story 1.4.2: Create Mobile Bottom Tabs
**Points:** 3 | **Priority:** P0

**Description:**
Navigation par onglets en bas pour mobile.

**Acceptance Criteria:**
- [ ] 4 onglets: My Day, Tasks, Calendar, Team
- [ ] Icônes + labels courts
- [ ] Animation de sélection
- [ ] Safe area padding (iPhone notch)

**Files:**
- `client/src/components/scheduling/mobile/BottomTabs.tsx` (create)

---

### Story 1.4.3: Create FAB (Floating Action Button)
**Points:** 5 | **Priority:** P0

**Description:**
Bouton d'action flottant pour mobile.

**Acceptance Criteria:**
- [ ] Position bottom-right avec safe area
- [ ] Click = expand menu radial
- [ ] Actions: New Event, New Task, Book Room
- [ ] Animation spring pour expansion

**Files:**
- `client/src/components/scheduling/quick-actions/FAB.tsx` (create)

---

# Phase 2: Tasks & NLP (4 semaines)

## Epic 2.1: Tasks Integration

### Story 2.1.1: Create Kanban Board
**Points:** 8 | **Priority:** P0

**Description:**
Board Kanban pour la gestion des tâches.

**Acceptance Criteria:**
- [ ] Colonnes: Backlog, Today, In Progress, Done
- [ ] Drag & drop entre colonnes (dnd-kit)
- [ ] Quick add inline dans chaque colonne
- [ ] Filtres par projet/tag/assignee
- [ ] Collapse columns

**Files:**
- `client/src/components/scheduling/tasks/KanbanBoard.tsx` (create)
- `client/src/components/scheduling/tasks/KanbanColumn.tsx` (create)

---

### Story 2.1.2: Create Task Card Component
**Points:** 3 | **Priority:** P0

**Description:**
Carte de tâche réutilisable.

**Acceptance Criteria:**
- [ ] Checkbox, titre, priorité badge
- [ ] Tags, assignee avatar, due date
- [ ] États: default, hover, dragging
- [ ] Click = open detail sheet

**Files:**
- `client/src/components/scheduling/tasks/TaskCard.tsx` (create)

---

### Story 2.1.3: Task-Calendar Integration
**Points:** 5 | **Priority:** P0

**Description:**
Afficher les tâches avec due date sur le calendrier.

**Acceptance Criteria:**
- [ ] Tâches visibles sur le calendrier avec icône distincte
- [ ] Drag task vers calendrier = créer time block
- [ ] Vue hybride semaine avec tasks en bas
- [ ] Sync bidirectionnelle

**Dependencies:** Story 2.1.1, Epic 1.2

---

### Story 2.1.4: Task Quick Capture
**Points:** 5 | **Priority:** P0

**Description:**
Création ultra-rapide de tâches.

**Acceptance Criteria:**
- [ ] Input simple (titre + Enter = créé)
- [ ] Inbox pour triage ultérieur
- [ ] Shortcut global (⌘T)

**Files:**
- `client/src/components/scheduling/tasks/TaskQuickAdd.tsx` (create)

---

### Story 2.1.5: Create Tasks API Client
**Points:** 5 | **Priority:** P0

**Description:**
Client API pour les opérations sur les tâches.

**Acceptance Criteria:**
- [ ] CRUD tasks
- [ ] Filtres par status, assignee, project
- [ ] Batch updates pour kanban
- [ ] Optimistic updates

**Files:**
- `client/src/lib/scheduling/api/tasks.ts` (create)

---

## Epic 2.2: Natural Language Processing

### Story 2.2.1: Create NLP Parser
**Points:** 8 | **Priority:** P0

**Description:**
Parser de langage naturel pour événements et tâches.

**Acceptance Criteria:**
- [ ] Support français et anglais
- [ ] Extraction: titre, date, heure, durée, participants
- [ ] Confiance score pour chaque extraction
- [ ] Suggestions de complétion

**Examples:**
- "Réunion avec Marc demain 14h" → Event: Réunion avec Marc, Tomorrow 14:00
- "Fix bug #234 pour vendredi urgent" → Task: Fix bug #234, Due: Friday, Priority: High

**Files:**
- `client/src/lib/scheduling/nlp/parser.ts` (create)
- `client/src/lib/scheduling/nlp/date-parser.ts` (create)
- `client/src/lib/scheduling/nlp/entity-extractor.ts` (create)

---

### Story 2.2.2: Create NLP Preview Component
**Points:** 5 | **Priority:** P0

**Description:**
Preview visuel de l'interprétation NLP.

**Acceptance Criteria:**
- [ ] Affiche l'interprétation en temps réel
- [ ] Highlight des entités extraites
- [ ] Suggestions alternatives
- [ ] Edit inline des valeurs

**Dependencies:** Story 2.2.1

**Files:**
- `client/src/components/scheduling/command-palette/NLPPreview.tsx` (create)

---

### Story 2.2.3: Add Recurrence Parsing
**Points:** 5 | **Priority:** P1

**Description:**
Support des événements récurrents dans le NLP.

**Acceptance Criteria:**
- [ ] "Tous les jours à 9h30" → Daily 09:30
- [ ] "Chaque lundi" → Weekly on Monday
- [ ] "Le 15 de chaque mois" → Monthly on 15th
- [ ] Preview du pattern

**Dependencies:** Story 2.2.1

---

### Story 2.2.4: Add Participant Parsing
**Points:** 3 | **Priority:** P1

**Description:**
Extraction des participants via @mentions.

**Acceptance Criteria:**
- [ ] "@marc @sophie" → participants
- [ ] Autocomplete des membres du workspace
- [ ] Validation existence utilisateur

**Dependencies:** Story 2.2.1

---

## Epic 2.3: Advanced Interactions

### Story 2.3.1: Implement Keyboard Navigation
**Points:** 5 | **Priority:** P0

**Description:**
Navigation complète au clavier style Vim.

**Acceptance Criteria:**
- [ ] j/k = événement suivant/précédent
- [ ] h/l = jour précédent/suivant
- [ ] Enter = ouvrir sélectionné
- [ ] e = éditer, Delete = supprimer
- [ ] Escape = désélectionner

**Files:**
- `client/src/hooks/scheduling/useKeyboardNavigation.ts` (create)

---

### Story 2.3.2: Implement Drag Resize
**Points:** 5 | **Priority:** P0

**Description:**
Redimensionner les événements en étirant les bords.

**Acceptance Criteria:**
- [ ] Handles haut/bas pour resize
- [ ] Snap to intervals (15/30/60 min)
- [ ] Preview du nouveau temps
- [ ] Undo support

**Dependencies:** Story 1.2.2

---

### Story 2.3.3: Create 3-Day View
**Points:** 3 | **Priority:** P0

**Description:**
Vue compromis entre jour et semaine.

**Acceptance Criteria:**
- [ ] 3 colonnes (J-1/J/J+1 ou J/J+1/J+2)
- [ ] Mêmes interactions que vue jour
- [ ] Transition fluide depuis/vers autres vues

**Dependencies:** Story 1.2.1

**Files:**
- `client/src/components/scheduling/views/ThreeDayView.tsx` (create)

---

# Phase 3: Resources & Team (4 semaines)

## Epic 3.1: Resource Booking

### Story 3.1.1: Create Resource Grid View
**Points:** 8 | **Priority:** P1

**Description:**
Grille de disponibilité des ressources.

**Acceptance Criteria:**
- [ ] Lignes = ressources (salles, équipements)
- [ ] Colonnes = créneaux horaires
- [ ] Code couleur: vert=libre, rouge=occupé
- [ ] Click slot vide = réservation rapide

**Files:**
- `client/src/components/scheduling/resources/ResourceGrid.tsx` (create)
- `client/src/components/scheduling/views/ResourcesView.tsx` (create)

---

### Story 3.1.2: Create Quick Book Component
**Points:** 5 | **Priority:** P1

**Description:**
Réservation rapide en langage naturel.

**Acceptance Criteria:**
- [ ] Input: "Salle pour 6 personnes demain 14h"
- [ ] Filtres: capacité, équipement, étage
- [ ] Suggestions intelligentes
- [ ] Confirmation en 1 clic

**Dependencies:** Epic 2.2

**Files:**
- `client/src/components/scheduling/resources/QuickBook.tsx` (create)

---

### Story 3.1.3: Create Resources API Client
**Points:** 3 | **Priority:** P1

**Description:**
Client API pour les ressources et réservations.

**Acceptance Criteria:**
- [ ] List resources avec filtres
- [ ] Check availability
- [ ] Create/update/cancel booking
- [ ] Conflict detection

**Files:**
- `client/src/lib/scheduling/api/resources.ts` (create)

---

### Story 3.1.4: Create Booking Detail Sheet
**Points:** 5 | **Priority:** P1

**Description:**
Sheet de détail pour une réservation.

**Acceptance Criteria:**
- [ ] Infos ressource (nom, capacité, équipements)
- [ ] Détails réservation (horaire, organisateur)
- [ ] Actions: modifier, annuler, dupliquer
- [ ] Historique des modifications

**Files:**
- `client/src/components/scheduling/resources/BookingDetailSheet.tsx` (create)

---

## Epic 3.2: Team Features

### Story 3.2.1: Create Availability Heatmap
**Points:** 8 | **Priority:** P1

**Description:**
Grille de disponibilité de l'équipe.

**Acceptance Criteria:**
- [ ] Lignes = membres de l'équipe
- [ ] Colonnes = créneaux horaires
- [ ] Intensité = niveau d'occupation
- [ ] Row "All Free" pour créneaux communs
- [ ] Click = voir détails

**Files:**
- `client/src/components/scheduling/team/AvailabilityHeatmap.tsx` (create)
- `client/src/components/scheduling/views/TeamView.tsx` (create)

---

### Story 3.2.2: Create Meeting Slot Finder
**Points:** 5 | **Priority:** P1

**Description:**
Recherche de créneau commun intelligent.

**Acceptance Criteria:**
- [ ] Sélection des participants
- [ ] Contraintes: durée, plage horaire, jours
- [ ] Suggestions triées par score
- [ ] Envoi d'invitation direct

**Dependencies:** Story 3.2.1

**Files:**
- `client/src/components/scheduling/team/MeetingSlotFinder.tsx` (create)

---

### Story 3.2.3: Create Team API Client
**Points:** 3 | **Priority:** P1

**Description:**
Client API pour les fonctionnalités équipe.

**Acceptance Criteria:**
- [ ] Get team members availability
- [ ] Find common slots
- [ ] Get workload stats

**Files:**
- `client/src/lib/scheduling/api/team.ts` (create)

---

### Story 3.2.4: Implement Workload Indicators
**Points:** 5 | **Priority:** P2

**Description:**
Indicateurs de charge de travail dans la heatmap.

**Acceptance Criteria:**
- [ ] Badge heures planifiées vs capacité
- [ ] Alertes surcharge (> 100%)
- [ ] Tooltip avec détails
- [ ] Trend indicator (↑/↓)

**Dependencies:** Story 3.2.1

---

# Phase 4: Advanced (4 semaines)

## Epic 4.1: Advanced Features

### Story 4.1.1: Create Floor Plan View
**Points:** 8 | **Priority:** P2

**Description:**
Plan interactif des locaux avec SVG.

**Acceptance Criteria:**
- [ ] Vue 2D des étages (SVG)
- [ ] Ressources cliquables
- [ ] Statut temps réel (libre/occupé)
- [ ] Filtres par capacité/équipement
- [ ] Zoom & pan

**Files:**
- `client/src/components/scheduling/resources/FloorPlan.tsx` (create)

---

### Story 4.1.2: Create Workload Dashboard
**Points:** 5 | **Priority:** P2

**Description:**
Vue charge de travail de l'équipe.

**Acceptance Criteria:**
- [ ] Heures planifiées vs capacité par personne
- [ ] Graphique comparaison équipe
- [ ] Alertes surcharge
- [ ] Tendances historiques (7/30 jours)

**Files:**
- `client/src/components/scheduling/team/WorkloadDashboard.tsx` (create)

---

### Story 4.1.3: Implement Mobile Gestures
**Points:** 5 | **Priority:** P1

**Description:**
Navigation tactile avancée.

**Acceptance Criteria:**
- [ ] Swipe horizontal = jour suivant/précédent
- [ ] Pinch = zoom (jour↔semaine↔mois)
- [ ] Long press = menu contextuel
- [ ] Pull to refresh

**Files:**
- `client/src/hooks/scheduling/useGestureNavigation.ts` (create)

---

### Story 4.1.4: Implement Undo/Redo
**Points:** 3 | **Priority:** P1

**Description:**
Support undo/redo pour toutes les actions.

**Acceptance Criteria:**
- [ ] ⌘Z = undo, ⌘⇧Z = redo
- [ ] Stack de 50 actions
- [ ] Toast avec action "Annuler"
- [ ] Support: create, update, delete, move

**Files:**
- `client/src/hooks/scheduling/useUndoRedo.ts` (create)

---

## Epic 4.2: AI & Analytics

### Story 4.2.1: Create AI Scheduling Suggestions
**Points:** 8 | **Priority:** P2

**Description:**
Suggestions intelligentes de planification.

**Acceptance Criteria:**
- [ ] Analyse des patterns utilisateur
- [ ] Suggestions de time blocks
- [ ] "Meilleur moment pour focus"
- [ ] Détection conflits potentiels

**Files:**
- `client/src/lib/scheduling/ai/suggestions.ts` (create)

---

### Story 4.2.2: Implement Auto-Scheduling
**Points:** 5 | **Priority:** P2

**Description:**
Planification automatique des tâches.

**Acceptance Criteria:**
- [ ] Drag task → "Find best time"
- [ ] Respect des contraintes (deadlines, priorités)
- [ ] Preview avant confirmation
- [ ] Bulk scheduling pour backlog

**Dependencies:** Story 4.2.1

---

### Story 4.2.3: Create Analytics Dashboard
**Points:** 5 | **Priority:** P2

**Description:**
Statistiques d'utilisation du temps.

**Acceptance Criteria:**
- [ ] Répartition par type (meeting, focus, task)
- [ ] Comparaison semaine/mois précédent
- [ ] Temps en réunion vs objectif
- [ ] Export rapport

**Files:**
- `client/src/components/scheduling/analytics/AnalyticsDashboard.tsx` (create)

---

### Story 4.2.4: Implement Conflict Insights
**Points:** 3 | **Priority:** P2

**Description:**
Analyse intelligente des conflits.

**Acceptance Criteria:**
- [ ] Détection conflicts récurrents
- [ ] Suggestions de résolution
- [ ] "Ce créneau est souvent déplacé"
- [ ] Patterns de no-shows

**Dependencies:** Story 4.2.1

---

# Dependencies Graph

```
Phase 1 (MVP):
1.1.1 → 1.1.3 → 1.2.* → 1.4.*
      → 1.1.4
      → 1.1.5
1.2.1 → 1.2.2 → 1.2.3
      → 1.2.4
      → 1.2.5
      → 1.2.6
1.3.1 → 1.3.2 → 1.3.3
             → 1.3.4

Phase 2:
2.1.1 → 2.1.3
2.2.1 → 2.2.2 → 2.2.3
             → 2.2.4
1.2.2 → 2.3.2

Phase 3:
2.2.* → 3.1.2
3.2.1 → 3.2.2
     → 3.2.4

Phase 4:
4.2.1 → 4.2.2
     → 4.2.4
```

---

# Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| NLP accuracy < expected | High | Fallback formulaire, amélioration itérative |
| Performance grands calendriers | High | Virtual scrolling, pagination, lazy loading |
| Complexité drag & drop | Medium | Utiliser dnd-kit, tests extensifs |
| Mobile gestures conflicts | Medium | Tests multi-device, feature flags |

---

**Document Control:**
- Created: 2026-03-18
- Last Updated: 2026-03-18
- Next Review: 2026-03-25
- Approvers: [En attente]
