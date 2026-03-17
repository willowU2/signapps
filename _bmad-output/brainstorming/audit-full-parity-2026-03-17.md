# Audit Complet SignApps - Full Parity Implementation Plan

**Date:** 2026-03-17
**Objectif:** 100% des interfaces fonctionnelles - Aucun dead end

---

## Résumé de l'Audit

| Catégorie | Total | Prêt | À Faire |
|-----------|-------|------|---------|
| Feature Flags | 25 | 15 (60%) | 10 |
| Backend APIs sans Frontend | ~50 | - | ~50 |
| Frontend Dead Ends | 12 | - | 12 |

---

## 🚀 PHASE 1: QUICK WINS (1-2 jours chacun)

### QW-1: SHEETS_EXPORT_XLSX ⭐ PRIORITÉ HAUTE
**Backend:** ✅ Prêt (`/api/v1/spreadsheet/export`)
**Frontend:** ❌ Bouton non câblé

**Fichiers à modifier:**
- `client/src/components/sheets/spreadsheet.tsx` - Ajouter bouton Export XLSX
- `client/src/lib/features.ts` - `SHEETS_EXPORT_XLSX: true`

**Estimation:** 2 heures

---

### QW-2: SHEETS_IMPORT_XLSX ⭐ PRIORITÉ HAUTE
**Backend:** ✅ Prêt (`/api/v1/spreadsheet/import`)
**Frontend:** ❌ Dialog d'import manquant

**Fichiers à modifier:**
- `client/src/components/sheets/spreadsheet.tsx` - Ajouter bouton Import
- `client/src/components/sheets/import-xlsx-dialog.tsx` - CRÉER
- `client/src/lib/features.ts` - `SHEETS_IMPORT_XLSX: true`

**Estimation:** 4 heures

---

### QW-3: IT Assets Buttons Handlers
**Backend:** ❌ Services skeleton (PXE, Remote non implémentés)
**Frontend:** ❌ onClick vides

**Action:** Cacher les boutons si service indisponible
**Fichiers:**
- `client/src/app/admin/it-assets/page.tsx` - Conditionner sur FEATURES

**Estimation:** 1 heure

---

### QW-4: Calendar MiniCalendar Placeholder
**Backend:** N/A (composant UI pur)
**Frontend:** ❌ TODO placeholder

**Fichiers:**
- `client/src/components/calendar/calendar-sidebar.tsx` - Implémenter MiniCalendar

**Estimation:** 3 heures

---

### QW-5: Version Restore Feature
**Backend:** ✅ Prêt (Sprint 7)
**Frontend:** ❌ Flag désactivé

**Fichiers:**
- `client/src/lib/features.ts` - `VERSION_RESTORE: true`

**Estimation:** 15 minutes

---

## 📋 PHASE 2: MEMBER MANAGEMENT (1-2 semaines)

### MM-1: Workspace Member Management UI
**Backend:** ✅ APIs existantes
- `POST /workspaces/:id/members`
- `DELETE /workspaces/:id/members/:user_id`
- `GET /workspaces/:id/members`

**Frontend:** ❌ Complètement manquant

**Fichiers à créer:**
- `client/src/components/admin/workspace-members-sheet.tsx`
- `client/src/hooks/use-workspace-members.ts`

**Fichiers à modifier:**
- `client/src/app/admin/workspaces/page.tsx` - Ajouter bouton "Manage Members"
- `client/src/lib/features.ts` - `MEMBER_MANAGEMENT: true`

**Estimation:** 1 semaine

---

### MM-2: Group Member Management UI
**Backend:** ✅ APIs existantes dans Identity
- `POST /groups/:id/members`
- `DELETE /groups/:id/members/:user_id`

**Frontend:** ❌ Manquant

**Fichiers à créer:**
- `client/src/components/admin/group-members-sheet.tsx`

**Estimation:** 3 jours

---

## 📋 PHASE 3: ROLES MANAGEMENT (1 semaine)

### ROLES-1: Roles Admin Page
**Backend:** ✅ APIs complètes dans Identity
- `GET /roles`
- `POST /roles`
- `PUT /roles/:id`
- `DELETE /roles/:id`
- `GET /roles/:id/permissions`
- `PUT /roles/:id/permissions`

**Frontend:** ❌ Aucune page admin

**Fichiers à créer:**
- `client/src/app/admin/roles/page.tsx`
- `client/src/components/admin/role-sheet.tsx`
- `client/src/components/admin/permissions-editor.tsx`
- `client/src/lib/api/roles.ts`
- `client/src/hooks/use-roles.ts`

**Estimation:** 1 semaine

---

## 📋 PHASE 4: SCHEDULER UI (2 semaines)

### SCHED-1: Job Management Interface
**Backend:** ✅ Complet
- `GET /jobs`
- `POST /jobs`
- `GET /jobs/:id`
- `PUT /jobs/:id`
- `DELETE /jobs/:id`
- `POST /jobs/:id/run`
- `GET /jobs/:id/runs`

**Frontend:** ❌ Page existe mais incomplète

**Fichiers à modifier:**
- `client/src/app/scheduler/page.tsx` - Refonte complète
- `client/src/lib/api/scheduler.ts` - Compléter les méthodes

**Fichiers à créer:**
- `client/src/components/scheduler/job-sheet.tsx`
- `client/src/components/scheduler/job-runs-table.tsx`
- `client/src/components/scheduler/cron-builder.tsx`

**Estimation:** 2 semaines

---

## 📋 PHASE 5: STORAGE ADVANCED FEATURES (2-3 semaines)

### STOR-1: Search Interface
**Backend:** ✅ Prêt
- `GET /search`
- `GET /search/quick`
- `GET /search/suggest`

**Frontend:** ❌ Manquant

### STOR-2: Sharing UI
**Backend:** ✅ Prêt (15 endpoints)
**Frontend:** ❌ Partiel

### STOR-3: Tags Management
**Backend:** ✅ Prêt
**Frontend:** ❌ Partiel

### STOR-4: Permissions Editor
**Backend:** ✅ Prêt
**Frontend:** ❌ Manquant

---

## 📋 PHASE 6: CHAT PRESENCE (2 semaines)

### PRES-1: WebSocket Infrastructure
**Backend:** ❌ Non implémenté
**Frontend:** ❌ Non implémenté

**Fichiers à créer (Backend):**
- `services/signapps-docs/src/handlers/websocket.rs`
- `services/signapps-docs/src/presence.rs`

**Fichiers à créer (Frontend):**
- `client/src/hooks/use-presence.ts`
- `client/src/components/chat/presence-indicator.tsx`

**Estimation:** 2 semaines

---

## 📋 PHASE 7: AI FEATURES (1-2 semaines)

### AI-1: Collections Management UI
**Backend:** ✅ Prêt
- `GET /collections`
- `POST /collections`
- etc.

**Frontend:** ❌ Manquant

### AI-2: Model Management UI
**Backend:** ✅ Prêt
- `GET /models`
- `POST /models/:id/load`
- `POST /models/:id/unload`

**Frontend:** ❌ Manquant

---

## 📋 PHASE 8: SLIDES EXPORT (1 semaine)

### SLIDES-1: PPTX Export
**Backend:** ⚠️ Partiel (code local existe)
**Frontend:** ❌ Bouton non câblé

**Action:** Vérifier backend, câbler frontend

---

## ✅ PLAN D'EXÉCUTION

### Sprint 11 (Immédiat - 1 jour) ✅ COMPLÉTÉ
1. [x] QW-1: SHEETS_EXPORT_XLSX - Déjà fonctionnel localement (xlsx lib)
2. [x] QW-2: SHEETS_IMPORT_XLSX - Déjà fonctionnel localement (xlsx lib)
3. [x] QW-5: VERSION_RESTORE flag - Déjà activé
4. [x] QW-3: IT Assets conditionnels - Boutons PXE/Remote cachés si flags false
5. [x] MM-1: Workspace Members UI - CRÉÉ `workspace-members-sheet.tsx`

### Sprint 12 (2-3 jours)
6. [ ] QW-4: MiniCalendar
7. [ ] MM-2: Group Members UI

### Sprint 14 (1 semaine)
8. [ ] ROLES-1: Roles Admin Page

### Sprint 15 (2 semaines)
9. [ ] SCHED-1: Job Management

### Sprint 16+ (À planifier)
- STOR-* features
- PRES-1: WebSocket Presence
- AI-* features
- SLIDES-1: PPTX Export

---

## Métriques de Succès

| Métrique | Avant | Objectif |
|----------|-------|----------|
| Feature Flags actifs | 60% | 95% |
| Dead Ends | 12 | 0 |
| Backend sans Frontend | ~50 | <10 |
| Couverture fonctionnelle | ~70% | 95% |

---

## Notes Techniques

### Pattern pour nouvelles features
1. Vérifier API backend existe (`curl localhost:PORT/api/v1/...`)
2. Ajouter types TypeScript si manquants
3. Créer hook React (`use-*.ts`)
4. Créer composant UI (Sheet/Dialog)
5. Intégrer dans page existante
6. Activer feature flag
7. Tester E2E

### Règle NO DEAD ENDS
- Si backend manquant → Cacher bouton via feature flag
- Si frontend manquant → Ajouter TODO dans plan, prioritiser
- Jamais de "Coming soon" visible par l'utilisateur
