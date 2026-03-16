# Consolidation des Sessions de Brainstorming SignApps

**Date de consolidation:** 2026-03-16
**Sessions analysées:** 5
**Idées générées:** 550+
**Méthodologie:** BMAD Method v6.0.4

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Décisions Clés](#décisions-clés)
3. [Sessions de Brainstorming](#sessions-de-brainstorming)
4. [Synthèse par Domaine](#synthèse-par-domaine)
5. [Architecture Globale](#architecture-globale)
6. [Roadmap Consolidée](#roadmap-consolidée)
7. [Principes Directeurs](#principes-directeurs)

---

## Vue d'Ensemble

### Sessions Consolidées

| Session | Date | Sujet | Idées |
|---------|------|-------|-------|
| [Global UX Refactor](#1-global-ux-refactor) | 2026-03-15 | Refonte UI orientée utilisateur | 50+ |
| [Suite Office SignApps](#2-suite-office-signaps) | 2026-03-11 | Migration Tiptap v3, Export/Import | 127 |
| [Tiptap Extensions Audit](#3-tiptap-extensions-audit) | 2026-03-12 | Extensions Tiptap complètes | 100+ |
| [Calendar System](#4-calendar-system) | 2026-03-13 | Multi-type calendars, Tasks, Projects | 175+ |
| [Tiptap Implementation Specs](#5-tiptap-implementation-specs) | 2026-03-12 | Spécifications d'implémentation | 42 extensions |

### Techniques Utilisées

- **Morphological Analysis** - Exploration systématique des paramètres
- **Cross-Pollination** - Transfert d'idées entre domaines
- **SCAMPER** - Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse
- **Reverse Brainstorming** - Identifier les risques et mitigations
- **Solution Matrix** - Priorisation par valeur/effort

---

## Décisions Clés

### Architecture Globale

| Décision | Choix | Justification |
|----------|-------|---------------|
| **Navigation UX** | Hybride Command Bar + Context Sheets | Productivité maximale + intuitivité |
| **Approche Dev** | Double Track (UX visible + Tech invisible) | Expérience utilisateur prioritaire |
| **Règle UX** | **NO DEAD ENDS** | Si ça ne marche pas, ça ne s'affiche pas |
| **Multi-tenancy** | Row-Level Security (RLS) PostgreSQL | Isolation transparente |
| **État Frontend** | Zustand + TanStack Query | Performance et simplicité |
| **Collaboration** | Yjs/Yrs (CRDT) | Temps réel robuste |

### Stack Technique

| Couche | Technologie | Licence |
|--------|-------------|---------|
| **Backend** | Rust (Axum/Tokio) | - |
| **Frontend** | Next.js 16 + React 19 | MIT |
| **Éditeur** | Tiptap v3 | MIT |
| **Collaboration** | Yjs (client) + Yrs (server) | MIT |
| **PDF** | printpdf 0.7, lopdf | MIT |
| **Office** | docx-rs, rust_xlsxwriter, calamine | MIT/Apache 2.0 |
| **Base de données** | PostgreSQL + pgvector | - |

---

## Sessions de Brainstorming

### 1. Global UX Refactor

**Fichier:** `global_ux_refactor_brainstorm.md`

#### 3 Options Conceptuelles

| Option | Nom | Description | Effort |
|--------|-----|-------------|--------|
| **A** | Action-First | Command Bar omniprésente (Spotlight/Raycast style) | Moyen |
| **B** | Context-Aware | UI s'adapte dynamiquement au contexte | Élevé |
| **C** | Workspace Unifié | Tout devient grille de cartes (Notion/Linear) | Très Élevé |

**Décision:** Hybride A+B (Command Bar + Context Sheets)

#### Principes Retenus

1. Menu latéral minimaliste (icônes, rétractable)
2. Command Bar comme navigation principale
3. Dashboards opérationnels (actions directes)
4. Panneaux glissants (Sheets) pour détails
5. Quick Actions sans ouvrir panneau complet

---

### 2. Suite Office SignApps

**Fichier:** `brainstorming-session-2026-03-11-2200.md`

#### Contraintes

- Licence: Apache 2.0 ou MIT uniquement
- Backend: Rust only
- Stack: Next.js 16 + Tiptap + Yjs + Fabric.js

#### 9 Epics Identifiés

| Epic | Idées | Priorité |
|------|-------|----------|
| 1. Migration Tiptap v3 | 15 | P0 |
| 2. Extensions Tiptap Custom | 12 | P1 |
| 3. Service signapps-office | 20 | P0 |
| 4. PDF Features | 15 | P1 |
| 5. Sheets/Excel Integration | 15 | P0 |
| 6. Slides/PowerPoint | 15 | P1 |
| 7. Formats Additionnels | 15 | P2 |
| 8. Performance | 15 | P1 |
| 9. Tests et Qualité | 10 | P0 |

#### Bibliothèques Rust Sélectionnées

| Crate | Fonction | Statut |
|-------|----------|--------|
| `docx-rs` | DOCX read/write | ✅ Intégré |
| `rust_xlsxwriter` | XLSX write | ✅ Intégré |
| `calamine` | XLSX/XLS/ODS read | ✅ Intégré |
| `printpdf` | PDF génération | ✅ Intégré (v0.7) |
| `lopdf` | PDF manipulation | ✅ Intégré |
| `comrak` | Markdown CommonMark+GFM | ✅ Intégré |
| `shiva` | Multi-format fallback | ✅ Intégré |

---

### 3. Tiptap Extensions Audit

**Fichier:** `brainstorming-session-2026-03-12-0235.md`

#### État des Extensions

| Statut | Count | Extensions |
|--------|-------|------------|
| **Déjà Implémenté** | 24 | StarterKit, Underline, TextAlign, FontFamily, Color, Table, etc. |
| **Custom Créé** | 4 | FontSize, Comment, TrackChanges, Mention |
| **À Implémenter** | 18 | Typography, Dropcursor, LineHeight, PageBreak, etc. |

#### 8 Tiers d'Implémentation

| Tier | Extensions | Effort |
|------|------------|--------|
| 1. Quick Wins | 7 | ~2 heures |
| 2. High Impact Formatting | 5 | ~1-2 jours |
| 3. Collaboration Enhancement | 4 | ~1 jour |
| 4. Advanced Content | 7 | ~2-3 jours |
| 5. Export Fidelity | 5 | ~3-4 jours |
| 6. Media & Embeds | 4 | ~1 jour |
| 7. Advanced Document | 6 | ~4-5 jours |
| 8. UI/UX Enhancements | 4 | ~2 jours |

---

### 4. Calendar System

**Fichier:** `brainstorming-session-2026-03-13-calendar-system.md`

#### Types de Calendrier

1. Personnel (perso)
2. Groupe (workspace)
3. Entreprise (tenant)
4. Ressource - Salle
5. Ressource - Équipement

#### Entités du Système

```
Tenant → Workspace → Calendar → Event
                  → Project → Task → Subtask
                  → Resource → Reservation
                  → Template
```

#### 10 Epics Identifiés

| Epic | Idées | Focus |
|------|-------|-------|
| 1. Data Model Foundation | 25 | Schema PostgreSQL |
| 2. Multi-Tenant & Entity Management | 25 | RLS, Users, Workspaces |
| 3. Calendar Core API | 20 | CRUD Events, Recurrence |
| 4. Task Management API | 18 | Hierarchy, Status |
| 5. Project Management API | 15 | Projects, Milestones |
| 6. Template System | 12 | Project/Task templates |
| 7. Resource Reservation | 15 | Booking, Conflicts |
| 8. Frontend Components | 30 | Views, Dialogs |
| 9. State Management | 12 | Zustand stores |
| 10. Real-time & Collab | 10 | WebSocket, Presence |

#### Architecture Multi-Tenant

- **Isolation:** `tenant_id` sur toutes les tables
- **RLS:** Policies PostgreSQL automatiques
- **Context:** Session variable `app.current_tenant_id`
- **JWT:** Claims incluent `tenant_id` + `workspace_ids`

---

### 5. Tiptap Implementation Specs

**Fichier:** `tiptap-implementation-specs.md`

#### Extensions à Installer

```bash
npm install \
  @tiptap/extension-typography \
  @tiptap/extension-dropcursor \
  @tiptap/extension-gapcursor \
  @tiptap/extension-trailing-node \
  @tiptap/extension-focus \
  @tiptap/extension-collaboration-cursor \
  @tiptap/extension-drag-handle-react \
  @tiptap/extension-unique-id \
  @tiptap/extension-file-handler \
  @tiptap/extension-mathematics \
  @tiptap/extension-details \
  @tiptap/extension-emoji \
  @tiptap/extension-youtube \
  katex
```

#### Extensions Custom à Créer

| Extension | Fichier | Purpose |
|-----------|---------|---------|
| LineHeight | `line-height.ts` | Espacement lignes |
| Indent | `indent.ts` | Indentation paragraphes |
| PageBreak | `page-break.ts` | Saut de page |
| BackgroundColor | `background-color.ts` | Couleur de fond |
| TableOfContents | `table-of-contents.ts` | TOC auto-généré |
| Footnote | `footnote.ts` | Notes de bas de page |
| FindReplace | `find-replace-dialog.tsx` | Rechercher/Remplacer |

---

## Synthèse par Domaine

### 1. UX/Frontend

| Concept | Description | Status |
|---------|-------------|--------|
| **Command Bar** | Navigation globale Cmd+K | 📋 Planifié |
| **Context Sheets** | Panneaux latéraux contextuels | 📋 Planifié |
| **Universal Blocks** | Entités comme blocs interconnectés | 📋 Planifié |
| **Generic Components** | DataTable, Sheet, Form réutilisables | 📋 Planifié |
| **Views System** | Vues personnalisables par utilisateur | 📋 Planifié |
| **No Dead Ends** | Aucun bouton vers le vide | ✅ Appliqué |

### 2. Backend Services

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| signapps-identity | 3001 | ✅ Complet | Auth, RBAC, Groups |
| signapps-office | 3018 | ✅ Complet | Export/Import docs |
| signapps-scheduler | 3007 | 🔄 En cours | Calendar, Tasks, Projects |
| signapps-collab | 3013 | ✅ Complet | Yrs WebSocket |

### 3. Éditeur de Documents

| Feature | Status | Notes |
|---------|--------|-------|
| Tiptap v3 Core | ✅ | 24 extensions actives |
| Export DOCX | ✅ | Via signapps-office |
| Export PDF | ✅ | Via signapps-office |
| Comments | ✅ | Extension custom |
| Track Changes | ✅ | Extension custom |
| Collaboration | ✅ | Yjs + présence |
| Line Height/Indent | 📋 | Extensions à créer |
| Mathematics | 📋 | KaTeX intégration |

### 4. Calendrier & Planification

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-type calendars | 📋 | Schema conçu |
| Tasks/Subtasks | 📋 | Hiérarchie illimitée |
| Projects | 📋 | Avec templates |
| Resources | 📋 | Salles, équipements |
| Reservations | 📋 | Avec conflits |
| Multi-tenant | 📋 | RLS PostgreSQL |

---

## Architecture Globale

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 16)                        │
├────────────┬────────────┬────────────┬────────────┬─────────────┤
│  Dashboard │  Storage   │  Calendar  │    Docs    │   Admin     │
│  (Widgets) │  (Drive)   │  (Tasks)   │  (Tiptap)  │  (Config)   │
└─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴──────┬──────┘
      │            │            │            │             │
      ▼            ▼            ▼            ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Zustand + TanStack)              │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES (Rust/Axum)                │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ Identity │ Storage  │ Scheduler│  Office  │  Collab  │   AI     │
│  :3001   │  :3004   │  :3007   │  :3018   │  :3013   │  :3005   │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
     │          │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                         │
│              (Multi-tenant via RLS + tenant_id)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Flux de Données

```
User Action → Command Bar / UI Component
           ↓
Zustand Store (optimistic update)
           ↓
TanStack Query (API call)
           ↓
Rust Service (business logic)
           ↓
PostgreSQL (RLS filtered by tenant_id)
           ↓
Response → Store update → UI re-render
```

---

## Roadmap Consolidée

### Phase 1: Foundation (✅ Complété)

- ✅ API Client Factory
- ✅ Service Bootstrap Module
- ✅ Feature Flags
- ✅ No Dead Ends cleanup
- ✅ signapps-office opérationnel

### Phase 2: Office Suite (✅ Complété)

- ✅ Export DOCX/PDF/MD/HTML
- ✅ Import DOCX/MD/HTML
- ✅ Frontend integration (menus)

### Phase 3: UX Refonte (📋 En cours)

- ✅ UX Design document
- ✅ Epics & Stories (10-17)
- ✅ Wireframes
- 📋 Generic Components (DataTable, Sheet, Form)
- 📋 Command Bar
- 📋 Context Sheets

### Phase 4: Calendar System (📋 Planifié)

- 📋 Multi-tenant schema
- 📋 Calendar/Event APIs
- 📋 Task/Project APIs
- 📋 Resource/Reservation
- 📋 Frontend components

### Phase 5: Tiptap Extensions (📋 Planifié)

- 📋 Sprint 1: Foundation Polish
- 📋 Sprint 2: Collaboration
- 📋 Sprint 3: Professional Formatting
- 📋 Sprint 4: Advanced Content
- 📋 Sprint 5: Export Fidelity

### Phase 6: Polish (📋 Planifié)

- 📋 Performance optimizations
- 📋 Offline support
- 📋 Tests E2E
- 📋 Documentation

---

## Principes Directeurs

### 1. NO DEAD ENDS

```
╔════════════════════════════════════════════════════════════╗
║  Si ça ne fonctionne pas → ça ne s'affiche pas            ║
║  Feature flags obligatoires pour tout nouveau dev          ║
║  Definition of Done = fonctionne de A à Z                  ║
║  Code review : pas de merge si UI pointe vers du vide     ║
╚════════════════════════════════════════════════════════════╝
```

### 2. Interface Unifiée

- Admin et User voient la **même interface**
- Les **permissions filtrent** la visibilité
- Pas de mode "admin" séparé

### 3. Blocs Universels

- Toutes les entités sont des **blocs interconnectables**
- User, File, Task, Event, Document = même comportement de base
- Relations bidirectionnelles automatiques

### 4. Customisation Contrôlée

- **Admin** définit les policies (ce qui est autorisé)
- **User** personnalise dans les limites
- **Sync backend** pour multi-device

### 5. Performance First

- **Optimistic updates** partout
- **Lazy loading** des données
- **Virtual scrolling** pour grandes listes
- **Cache agressif** avec TanStack Query

### 6. Licences Strictes

- **Apache 2.0 ou MIT uniquement**
- Pas de dépendances GPL/LGPL dans le code
- Audit régulier des licences

---

## Métriques de Succès

| Métrique | Objectif | Mesure |
|----------|----------|--------|
| **Temps de chargement** | < 2s | First Contentful Paint |
| **Productivité** | +30% | Actions/minute utilisateur |
| **Dead Ends** | 0 | Audit UI hebdomadaire |
| **Satisfaction** | > 4.5/5 | Feedback utilisateur |
| **Build Time** | < 3min | CI/CD pipeline |
| **Test Coverage** | > 80% | cargo llvm-cov |

---

## Références

### Documents Source

1. `global_ux_refactor_brainstorm.md` - Options UX A/B/C
2. `brainstorming-session-2026-03-11-2200.md` - Suite Office complète
3. `brainstorming-session-2026-03-12-0235.md` - Audit Tiptap
4. `brainstorming-session-2026-03-13-calendar-system.md` - Calendrier multi-tenant
5. `tiptap-implementation-specs.md` - Specs techniques Tiptap

### Artefacts de Planning

1. `_bmad-output/planning-artifacts/ux-design.md` - Design UX complet
2. `_bmad-output/planning-artifacts/epics-ux-refonte.md` - Epics 10-17
3. `_bmad-output/planning-artifacts/wireframes-ux-refonte.md` - Wireframes ASCII

---

*Document généré automatiquement - BMAD Method v6.0.4*
