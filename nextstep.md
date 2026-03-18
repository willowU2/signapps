# SignApps Platform - Next Steps

> **Dernière mise à jour:** 2026-03-18
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
| 26 | **Unified Scheduling UI** - Phase 1-4 (46 stories, 233 pts) | 2026-03-18 |

### Builds Vérifiés

- `cargo check --workspace` ✅
- `npm run build` (client/) ✅

---

## État Office Suite - Epics Complétés ✅

| Epic | Titre | État | Détails |
|------|-------|------|---------|
| 1 | Tiptap v3 Migration | ✅ | v3.20.1, tous extensions actifs |
| 2 | Document Export Backend | ✅ | DOCX/PDF/MD/HTML via signapps-office |
| 3 | Document Import Backend | ✅ | DOCX/MD/HTML import |
| 4 | Comments System | ✅ | Inline comments, replies, resolve |
| 5 | Track Changes | ✅ | Insert/delete marks, accept/reject |
| 6 | Spreadsheet Import/Export | ✅ | XLSX/CSV/ODS via calamine |
| 7 | Slides Export | ✅ | PPTX, PNG, PDF export |
| 8 | PDF Operations | ✅ | Viewer, merge, split, thumbnails |
| 9 | Real-time Collaboration | ✅ | Yjs, cursors, presence, offline |

## Prochaines Améliorations Potentielles

### Option A: Qualité & Polish
- Tests E2E complets pour Office Suite
- Amélioration UX commentaires/track changes
- Performance exports grands documents

### Option B: Nouvelles Features
- Templates de documents prédéfinis
- Version history avec diff visuel
- Export vers Google Docs/Sheets

### Option C: Infrastructure
- Cache distribué pour conversions
- Queue de jobs pour exports lourds
- Metrics & monitoring Office

---

## Recommandation de Prochains Sprints

**Office Suite complète!** Options pour continuer:

### Option A: Tests & Polish (Recommandé)
```
Sprint 27: Tests E2E Office Suite (Docs, Sheets, Slides, PDF)
Sprint 28: Performance optimization exports
Sprint 29: UX polish commentaires/track changes
```

### Option B: Nouvelles Fonctionnalités
```
Sprint 27: Document Templates System
Sprint 28: Version History avec Diff visuel
Sprint 29: Intégration Google Workspace
```

### Option C: Backend Infrastructure
```
Sprint 27: Conversion Queue (jobs async)
Sprint 28: Caching layer pour exports
Sprint 29: Monitoring & Metrics Office
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
