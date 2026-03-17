# SignApps Platform - Next Steps

> **Dernière mise à jour:** 2026-03-17
> **Pour reprendre:** "Reprends le nextstep.md"

---

## État Actuel

### Sprints Complétés

| Sprint | Contenu | Date |
|--------|---------|------|
| 1 | Nettoyage UI "No Dead Ends", API Factory, Bootstrap Rust | 2026-03-15 |
| 2 | Feature Flags, Résolution conflits ports | 2026-03-15 |
| 3 | Epic 2 - Document Export Backend (DOCX/PDF/MD/HTML) | 2026-03-15 |
| 3.5 | Epic 3 - Document Import Frontend | 2026-03-15 |
| 7 | DND File→Task et Task→Calendar APIs | 2026-03-16 |
| 8 | Activation Features Office | 2026-03-16 |
| 16 | Epic 10.1 - Generic DataTable Infrastructure | 2026-03-17 |
| 17 | Epic 17 - Permissions-Based UI (RBAC) | 2026-03-17 |
| 18 | Epic 10.2-10.7 - Generic Components (Sheets, Forms) | 2026-03-17 |
| 19 | Epic 11 - Universal Blocks System | 2026-03-17 |
| 20 | Epic 12 - Command Bar & Search | 2026-03-17 |
| 21 | Epic 13 - Customizable Dashboard | 2026-03-17 |
| 22 | Epic 14 - Views System | 2026-03-17 |
| 23 | Epic 15 - Tenant Config & Branding | 2026-03-17 |
| 24 | Epic 16 - User Preferences Sync | 2026-03-17 |
| 25 | Intégration Finale (Providers, Routes, CommandBar) | 2026-03-17 |

### Builds Vérifiés

- `cargo check --workspace` ✅
- `npm run build` (client/) ✅

---

## Epics Restants - Office Suite

### Epic 1: Tiptap v3 Migration
**Priorité:** HAUTE (fondation pour Epic 4 et 5)
**Stories:** 8
**Contenu:**
- Migration Tiptap v2 → v3
- Nouveaux packages (@tiptap/pm, @tiptap/html)
- Gestion breaking changes (extension configs)
- Tests de régression éditeur

### Epic 4: Comments System
**Priorité:** MOYENNE
**Stories:** 7
**Dépend de:** Epic 1
**Contenu:**
- Commentaires inline sur sélection
- Threads de réponses
- Résolution/fermeture threads
- Mentions @username
- Export commentaires vers DOCX

### Epic 5: Track Changes System
**Priorité:** MOYENNE
**Stories:** 7
**Dépend de:** Epic 1
**Contenu:**
- Mode Track Changes toggle
- Marquage insertions (vert)
- Marquage suppressions (rouge barré)
- Accept/Reject individuel et bulk
- Préservation auteur/timestamp

### Epic 6: Spreadsheet Import/Export
**Priorité:** MOYENNE
**Stories:** 6
**Contenu:**
- Import XLSX/XLS/CSV/TSV/ODS
- Export XLSX/CSV/ODS
- Préservation formules basiques
- Préservation formatage cellules
- Support multi-sheets

### Epic 7: Slides Export Enhancement
**Priorité:** BASSE
**Stories:** 5
**Contenu:**
- Export PPTX
- Export PNG/SVG par slide
- Export PDF all slides
- Speaker notes
- Master templates et thèmes

### Epic 8: PDF Operations
**Priorité:** MOYENNE
**Stories:** 6
**Contenu:**
- Viewer PDF in-browser
- Extraction texte PDF
- Merge multiple PDFs
- Split PDF en pages
- Génération thumbnails

### Epic 9: Real-time Collaboration
**Priorité:** HAUTE
**Stories:** 7
**Contenu:**
- Édition simultanée (Yjs CRDT)
- Curseurs collaborateurs temps réel
- Indicateurs de présence
- Sync automatique sans save
- Mode offline + sync reconnexion
- Résolution conflits automatique

---

## Recommandation de Prochains Sprints

### Option A: Foundation First (Recommandé)
```
Sprint 26: Epic 1 - Tiptap v3 Migration
Sprint 27: Epic 4 - Comments System
Sprint 28: Epic 5 - Track Changes
Sprint 29: Epic 9 - Real-time Collaboration
```

### Option B: Quick Wins
```
Sprint 26: Epic 8 - PDF Operations (indépendant)
Sprint 27: Epic 6 - Spreadsheet Import/Export
Sprint 28: Epic 1 - Tiptap v3 Migration
```

### Option C: Collaboration Focus
```
Sprint 26: Epic 9 - Real-time Collaboration (Yjs)
Sprint 27: Epic 1 - Tiptap v3 + Epic 4 Comments
```

---

## Fichiers de Référence

| Fichier | Contenu |
|---------|---------|
| `_bmad-output/planning-artifacts/epics.md` | 9 Epics Office Suite, 60 Stories |
| `_bmad-output/planning-artifacts/epics-ux-refonte.md` | 8 Epics UX (10-17), 52 Stories |
| `.claude/plans/purring-frolicking-book.md` | Plan détaillé avec tous les sprints |
| `client/src/lib/features.ts` | Feature flags actifs |

---

## Commandes Utiles

```bash
# Build complet
cargo check --workspace && cd client && npm run build

# Lancer un service
cargo run -p signapps-office

# Tests
cargo test --workspace
cd client && npm run test:e2e
```

---

## Notes

- Règle UX absolue: **NO DEAD ENDS** - si ça ne marche pas, ça ne s'affiche pas
- Tous les services Rust utilisent le module `bootstrap.rs` de signapps-common
- Frontend utilise API Factory (`lib/api/factory.ts`) pour tous les clients
- Permissions RBAC via `usePermissions()` hook et `<AdminOnly>` / `<Can>` components
