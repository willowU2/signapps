---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['brainstorming-session-2026-03-18-unified-scheduling-ui.md']
workflowType: 'prd'
status: 'draft'
version: '1.0'
---

# Product Requirements Document
## Unified Scheduling UI - Tasks, Calendar, Resource Booking

**Author:** Etienne
**Date:** 2026-03-18
**Version:** 1.0
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Vision Statement

Créer une interface de planification unifiée qui combine la gestion des tâches, le calendrier et la réservation de ressources dans une expérience fluide, intuitive et cohérente sur tous les appareils.

### 1.2 Problem Statement

Les utilisateurs de SignApps Platform souffrent actuellement de:
- **Fonctionnalités manquantes** dans les modules de planification
- **Incohérence visuelle** entre les différents modules (Tasks, Calendar, Resources)
- **Erreurs de navigation** et confusion entre les vues
- **Expérience fragmentée** nécessitant de jongler entre plusieurs interfaces

### 1.3 Proposed Solution

Un **Scheduling Hub** unifié offrant:
- Une architecture de vues cohérente (Agenda, Jour, 3-Jours, Semaine, Mois)
- Une Command Palette (⌘K) avec langage naturel
- Une expérience mobile-first avec navigation par gestes
- Une intégration native Tasks + Calendar + Resources
- Une compatibilité parfaite Desktop/Tablet/Mobile

### 1.4 Success Metrics

| Métrique | Baseline | Target | Méthode |
|----------|----------|--------|---------|
| Temps création événement | 45 sec | < 10 sec | Analytics |
| Satisfaction utilisateur (NPS) | - | > 50 | Survey |
| Adoption mobile | 30% | 70% | Analytics |
| Changements de vue/session | 5+ | 2-3 | Analytics |
| Taux d'erreur navigation | 15% | < 3% | Error logs |

---

## 2. User Personas

### 2.1 Persona A: Individual Contributor

**Profil:** Développeur, Designer, Analyste
**Objectifs:**
- Gérer son temps personnel efficacement
- Bloquer du temps de focus
- Suivre ses deadlines et tâches

**Pain Points:**
- Trop de clics pour créer un événement
- Difficulté à voir tâches + calendrier ensemble
- Pas de vue "Ma journée" claire

**Besoins Clés:**
- Quick capture d'événements/tâches
- Vue hybride Calendar + Tasks
- Raccourcis clavier puissants

### 2.2 Persona B: Manager

**Profil:** Team Lead, Chef de projet, Directeur
**Objectifs:**
- Visualiser la disponibilité de l'équipe
- Planifier des réunions efficacement
- Surveiller la charge de travail

**Pain Points:**
- Difficile de trouver un créneau commun
- Pas de vue d'ensemble équipe
- Conflits de réservation fréquents

**Besoins Clés:**
- Team Availability Heatmap
- Meeting Slot Finder intelligent
- Workload Dashboard

### 2.3 Persona C: Administrative Staff

**Profil:** Office Manager, Assistant(e), RH
**Objectifs:**
- Réserver des salles rapidement
- Gérer les ressources partagées
- Coordonner les événements

**Pain Points:**
- Navigation complexe pour booking
- Pas de vue d'ensemble des ressources
- Processus d'approbation lent

**Besoins Clés:**
- Resource Grid View
- Quick Book avec suggestions
- Floor Plan interactif

---

## 3. Functional Requirements

### 3.1 Architecture de Navigation

#### FR-NAV-001: Scheduling Hub
**Priorité:** P0
**Description:** Point d'entrée unifié avec 4 onglets principaux
- My Day (default)
- Tasks
- Resources
- Team

#### FR-NAV-002: View Switcher
**Priorité:** P0
**Description:** Barre de sélection des vues temporelles
- Agenda (liste scrollable)
- Day (vue jour détaillée)
- 3-Day (vue 3 jours)
- Week (vue semaine)
- Month (vue mois avec heatmap)

#### FR-NAV-003: Command Palette
**Priorité:** P0
**Description:** Interface de commande accessible via ⌘K (Mac) / Ctrl+K (Windows)
- Recherche universelle
- Création rapide en langage naturel
- Navigation vers toute vue/date
- Actions contextuelles

### 3.2 Vue "My Day" (Default)

#### FR-MYDAY-001: Today Widget
**Priorité:** P0
**Description:** Vue condensée de la journée
- Prochain événement en cours/à venir
- Liste des événements du jour
- Tâches dues aujourd'hui
- Indicateur météo optionnel

#### FR-MYDAY-002: Now Line
**Priorité:** P0
**Description:** Indicateur visuel de l'heure actuelle
- Ligne rouge horizontale
- Scroll automatique vers "maintenant"
- Animation subtile

#### FR-MYDAY-003: Quick Actions
**Priorité:** P0
**Description:** Actions rapides accessibles
- Bouton FAB mobile
- Quick add bar desktop
- Raccourcis clavier (N = new, T = today)

### 3.3 Vues Calendrier

#### FR-CAL-001: Vue Agenda
**Priorité:** P0
**Description:** Liste chronologique scrollable style Fantastical
- Groupement par jour
- Infinite scroll bidirectionnel
- Headers sticky avec date
- Preview événement inline

#### FR-CAL-002: Vue Jour
**Priorité:** P0
**Description:** Timeline verticale 24h
- Créneaux horaires (15/30/60 min configurable)
- Drag & drop pour déplacer/redimensionner
- Multi-day events en header
- All-day events section

#### FR-CAL-003: Vue 3-Day
**Priorité:** P0
**Description:** Compromis entre détail et contexte
- 3 colonnes (hier/aujourd'hui/demain ou J/J+1/J+2)
- Même interactions que vue jour
- Transition fluide depuis/vers autres vues

#### FR-CAL-004: Vue Semaine
**Priorité:** P0
**Description:** Planning hebdomadaire classique
- 7 colonnes (ou 5 weekdays only toggle)
- Working hours highlight (9h-18h)
- Weekend collapse optionnel
- Tasks inline en bas

#### FR-CAL-005: Vue Mois
**Priorité:** P0
**Description:** Vue d'ensemble mensuelle avec heatmap
- Grille traditionnelle
- Heatmap densité (couleurs trafic)
- Dots pour événements (hover = preview)
- Click jour = expansion détails

### 3.4 Gestion des Tâches

#### FR-TASK-001: Vue Kanban
**Priorité:** P0
**Description:** Board Kanban pour les tâches
- Colonnes: Backlog, Today, In Progress, Done
- Drag & drop entre colonnes
- Quick add dans chaque colonne
- Filtres par projet/tag/assignee

#### FR-TASK-002: Task-Calendar Integration
**Priorité:** P0
**Description:** Intégration bidirectionnelle
- Tâches avec due date affichées sur calendrier
- Drag task vers calendrier = créer time block
- Vue hybride semaine avec tasks en bas

#### FR-TASK-003: Task Quick Capture
**Priorité:** P0
**Description:** Création ultra-rapide de tâches
- Input simple (titre + Enter = créé)
- Natural language parsing (date, priorité)
- Inbox pour triage ultérieur

### 3.5 Réservation de Ressources

#### FR-RES-001: Resource Grid View
**Priorité:** P1
**Description:** Grille de disponibilité des ressources
- Lignes = ressources (salles, équipements)
- Colonnes = créneaux horaires
- Code couleur disponibilité
- Click pour réserver

#### FR-RES-002: Quick Book
**Priorité:** P1
**Description:** Réservation en langage naturel
- "Salle pour 6 personnes demain 14h"
- Suggestions intelligentes
- Confirmation en 1 clic

#### FR-RES-003: Floor Plan View
**Priorité:** P2
**Description:** Plan interactif des locaux
- Vue 2D des étages
- Ressources cliquables
- Statut temps réel (libre/occupé)
- Filtres par capacité/équipement

### 3.6 Vue Équipe

#### FR-TEAM-001: Availability Heatmap
**Priorité:** P1
**Description:** Grille de disponibilité de l'équipe
- Lignes = membres de l'équipe
- Colonnes = créneaux horaires
- Intensité = niveau d'occupation
- Click = voir détails

#### FR-TEAM-002: Meeting Slot Finder
**Priorité:** P1
**Description:** Recherche de créneau commun
- Sélection des participants
- Contraintes (durée, plage horaire)
- Suggestions automatiques
- Envoi d'invitation direct

#### FR-TEAM-003: Workload Dashboard
**Priorité:** P2
**Description:** Vue charge de travail
- Heures planifiées vs capacité
- Alertes surcharge
- Comparaison équipe
- Tendances historiques

### 3.7 Interactions & UX

#### FR-UX-001: Drag & Drop
**Priorité:** P0
**Description:** Manipulation directe des éléments
- Déplacer événements entre créneaux
- Redimensionner en étirant les bords
- Multi-select avec Shift
- Undo/Redo (⌘Z / ⌘⇧Z)

#### FR-UX-002: Keyboard Navigation
**Priorité:** P0
**Description:** Navigation complète au clavier
- Vim-style: j/k (haut/bas), h/l (gauche/droite)
- T = today, G = go to date
- 1-5 = switch views
- N = new event/task

#### FR-UX-003: Mobile Gestures
**Priorité:** P0
**Description:** Navigation tactile intuitive
- Swipe horizontal = jour suivant/précédent
- Swipe vertical = scroll
- Pinch = zoom (jour↔semaine↔mois)
- Long press = menu contextuel

#### FR-UX-004: Transitions
**Priorité:** P1
**Description:** Animations fluides entre vues
- Morphing entre vues (zoom in/out)
- Skeleton loading pendant chargement
- Micro-animations feedback actions

### 3.8 Natural Language Processing

#### FR-NLP-001: Event Parsing
**Priorité:** P0
**Description:** Création d'événements en langage naturel
- Support français et anglais
- Extraction: titre, date, heure, durée, lieu, participants
- Suggestions de complétion
- Confirmation avant création

**Exemples:**
- "Réunion avec Marc demain 14h" → Event: Réunion avec Marc, Tomorrow 14:00
- "Call client vendredi matin 1h" → Event: Call client, Friday 09:00-10:00
- "Standup tous les jours 9h30" → Recurring: Daily 09:30

#### FR-NLP-002: Task Parsing
**Priorité:** P0
**Description:** Création de tâches en langage naturel
- Extraction: titre, due date, priorité, projet
- Tags automatiques
- Assignation par @mention

**Exemples:**
- "Fix bug #234 pour vendredi urgent" → Task: Fix bug #234, Due: Friday, Priority: High
- "Revoir specs @marc" → Task: Revoir specs, Assigned: Marc

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Métrique | Requirement |
|----------|-------------|
| Time to Interactive | < 2 secondes |
| First Contentful Paint | < 1 seconde |
| Vue switch latency | < 300ms |
| Scroll FPS | 60 FPS constant |
| Offline support | Lecture + création en cache |

### 4.2 Accessibilité (WCAG 2.1 AA)

- Navigation clavier complète
- Screen reader compatible (ARIA labels)
- Contraste couleurs suffisant
- Focus visible
- Reduced motion support

### 4.3 Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Mobile (< 640px) | Single column, bottom tabs |
| Tablet (640-1024px) | Sidebar collapsible, hybrid |
| Desktop (> 1024px) | Full sidebar, multi-pane |

### 4.4 Internationalisation

- Langues: Français, English (MVP)
- Formats date/heure localisés
- RTL support préparé
- Fuseaux horaires multiples

---

## 5. Design References

### 5.1 Inspirations

| App | Ce qu'on prend |
|-----|----------------|
| **Google Calendar** | Simplicité, fiabilité, color coding |
| **Fantastical** | Natural language, beautiful UI, agenda view |
| **Linear** | Command palette, keyboard-first, polish |
| **Notion** | Flexibility, views system, clean UI |
| **Cal.com** | Booking UX, availability display |

### 5.2 Design Principles

1. **Clarity over density** - Montrer l'essentiel, cacher le reste
2. **Direct manipulation** - Drag & drop, inline editing
3. **Progressive disclosure** - Complexité à la demande
4. **Consistency** - Mêmes patterns partout
5. **Speed** - Chaque action < 3 secondes

---

## 6. Technical Considerations

### 6.1 Frontend Stack

- **Framework:** React 19 (Next.js 16)
- **State:** Zustand + React Query
- **Calendar Engine:** Custom (inspiré FullCalendar)
- **Drag & Drop:** dnd-kit
- **Animations:** Framer Motion
- **Date/Time:** date-fns + Temporal API

### 6.2 API Requirements

- WebSocket pour real-time updates
- REST API pour CRUD opérations
- GraphQL subscription pour collaboration
- Offline-first avec sync strategy

### 6.3 Data Model Considerations

```typescript
// Event unifié
interface ScheduleBlock {
  id: string;
  type: 'event' | 'task' | 'booking';
  title: string;
  start: DateTime;
  end?: DateTime;
  allDay: boolean;
  recurrence?: RecurrenceRule;
  attendees?: string[];
  resource?: string; // room/equipment ID
  color?: string;
  metadata: Record<string, unknown>;
}
```

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance avec beaucoup d'événements | High | Medium | Virtual scrolling, pagination |
| Complexité NLP français | Medium | High | Fallback sur formulaire classique |
| Adoption des nouvelles vues | High | Medium | Onboarding progressif, tooltips |
| Conflits sync temps réel | Medium | Medium | CRDT, conflict resolution UI |
| Compatibilité navigateurs | Low | Low | Progressive enhancement |

---

## 8. Release Strategy

### 8.1 MVP (Phase 1) - 6 weeks

- [ ] My Day view + Today widget
- [ ] Vue Agenda, Jour, Semaine, Mois
- [ ] Command Palette basique
- [ ] Quick event creation
- [ ] Mobile responsive
- [ ] Dark mode

### 8.2 Phase 2 - 4 weeks

- [ ] Tasks Kanban integration
- [ ] Natural Language parsing
- [ ] Keyboard navigation complète
- [ ] Drag & drop avancé
- [ ] 3-Day view

### 8.3 Phase 3 - 4 weeks

- [ ] Resource Grid View
- [ ] Quick Book
- [ ] Team Availability Heatmap
- [ ] Meeting Slot Finder

### 8.4 Phase 4 - 4 weeks

- [ ] Floor Plan View
- [ ] Workload Dashboard
- [ ] Advanced analytics
- [ ] AI auto-scheduling

---

## 9. Appendix

### 9.1 Wireframes Reference

Voir: `brainstorming-session-2026-03-18-unified-scheduling-ui.md` - Phase 4 Wireframes

### 9.2 Competitive Analysis

| Feature | Google Cal | Fantastical | Notion | SignApps (Target) |
|---------|------------|-------------|--------|-------------------|
| Natural Language | ⚪ | ✅ | ⚪ | ✅ |
| Command Palette | ⚪ | ⚪ | ✅ | ✅ |
| Tasks Integration | ⚪ | ✅ | ✅ | ✅ |
| Resource Booking | ⚪ | ⚪ | ⚪ | ✅ |
| Team View | ✅ | ⚪ | ⚪ | ✅ |
| Offline | ✅ | ✅ | ⚪ | ✅ |

### 9.3 Glossary

- **Scheduling Hub:** Point d'entrée unifié pour toutes les fonctions de planification
- **Time Block:** Bloc de temps réservé (événement, tâche planifiée, ou booking)
- **Heatmap:** Visualisation par intensité de couleur
- **NLP:** Natural Language Processing - traitement du langage naturel

---

**Document Control:**
- Created: 2026-03-18
- Last Updated: 2026-03-18
- Next Review: 2026-03-25
- Approvers: [En attente]
