---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Audit complet SignApps - Frontend/Backend synchronization'
session_goals: 'Eliminer tous les dead ends, coming soon, not implemented'
selected_approach: 'AI-Recommended + Progressive Flow (Hybrid)'
techniques_used: ['Morphological Analysis', 'Question Storming', 'Solution Matrix', 'Decision Tree']
ideas_generated: ['Quick Wins Sprint', 'Storage Complet', 'Sheets 105 menus', 'Slides complet', 'LDAP + AD/GPO', 'DnD interconnect', 'Remote Zero Trust']
context_file: ''
---

# Brainstorming Session: Audit Complet SignApps

**Facilitator:** Etienne
**Date:** 2026-03-16
**Durée:** ~1h
**Résultat:** Plan d'implémentation 10-12 semaines

---

## Principe Directeur

```
╔════════════════════════════════════════════════════════════╗
║  SI ÇA S'AFFICHE → ÇA FONCTIONNE                          ║
║  SI ÇA NE FONCTIONNE PAS → ÇA NE S'AFFICHE PAS            ║
╚════════════════════════════════════════════════════════════╝
```

---

## Phase 1: DISCOVERY - Morphological Analysis

### Frontend Dead Ends Identifiés

#### Critiques (Visibles aux utilisateurs)

| Fichier | Ligne | Problème |
|---------|-------|----------|
| `drive/page.tsx` | 382 | `alert('Renommer (TODO)')` |
| `admin/workspaces/page.tsx` | 53 | Toast "Update workspace API to be implemented" |
| `settings/page.tsx` | 533 | Toast "General settings API not yet implemented" |
| `notifications/send-notification-admin.tsx` | 40 | Toast "endpoint not implemented" |
| `version-history-sheet.tsx` | 89 | Backend returns 501 Not Implemented |

#### Sheets - 105 Menus TODO

| Catégorie | Nombre |
|-----------|--------|
| Menu Fichier | 15 items |
| Menu Affichage | 12 items |
| Menu Insertion | 18 items |
| Menu Format | 25 items |
| Menu Données | 15 items |
| Menu Outils | 12 items |
| Menu IA | 8 items |
| **TOTAL** | **~105 menus** |

#### Slides - 10+ Menus TODO

- À partir d'un modèle
- Importer des diapositives
- Créer une copie
- Export PowerPoint (.pptx)
- Export PDF
- Insert Image

#### Infrastructure

| Fichier | Problème |
|---------|----------|
| `dnd-provider.tsx:52` | TODO: Link file to task API |
| `dnd-provider.tsx:61` | TODO: Event creation from drag |
| `archive-preview.tsx:33` | TODO: Archive listing backend |
| `document-preview.tsx:35` | TODO: Document metadata backend |

### Backend TODOs Identifiés

#### Identity Service
- `auth.rs:101` - LDAP bind verification
- `ldap.rs:42-71` - 4 TODOs LDAP (auth, test, search, sync)

#### Storage Service
- `trash.rs:298` - Calculate from database
- `search.rs:319,330` - Recent files, suggestions
- `quotas.rs:166` - Per-bucket breakdown
- `preview.rs` - 6 TODOs (thumbnails, resize, PDF, video, audio, document)
- `permissions.rs` - 3 TODOs (fetch, store, delete)

#### Autres Services
- `media/jobs.rs` - Fetch job status
- `containers/main.rs` - Filter by user
- `mail/api.rs` - IMAP test
- `docs/chat.rs` - user_id from auth
- `remote/handlers.rs` - Guacd connection
- `calendar/services` - OpenSSL dependency

---

## Phase 2: Question Storming - Décisions

| Question | Décision |
|----------|----------|
| Approche globale | **Mix** - Prioriser essentiels, cacher gadgets |
| Sheets | **Suite complète** - 105 menus |
| Slides | **Complet pragmatique** - Tout l'utile |
| LDAP | **Implémenter + AD/GPO** - Service enterprise |
| Storage | **Tout** - Previews, permissions, versions |
| Drag & Drop | **Implémenter** - Interconnexions modules |
| Remote | **Zero Trust** - Tunnel sans port ouvert |
| Mail IMAP | **Test complet** - Diagnostic |
| Notifications | **Push WebSocket/SSE** - Temps réel |

---

## Phase 3: Solution Matrix - Priorisation

### Matrice Impact/Effort

```
                    EFFORT FAIBLE          EFFORT MOYEN           EFFORT ÉLEVÉ
                 ──────────────────────────────────────────────────────────────
IMPACT ÉLEVÉ    │ 🎯 QUICK WINS         │ 🚀 PROJETS MAJEURS    │ ⭐ STRATÉGIQUE
                │ • Drive Renommer      │ • Storage Previews    │ • Sheets 105 menus
                │ • Notifications push  │ • Storage Permissions │ • LDAP + AD/GPO
                │ • Workspace update    │ • Version History     │ • Slides complet
                │ • Settings API        │ • DnD interconnect    │
                │ • IMAP test           │                       │
                ├──────────────────────────────────────────────────────────────
IMPACT MOYEN    │ ✅ FACILES            │ 📋 PLANIFIÉS          │ 🔄 DIFFÉRÉS
                │                       │ • Archive preview     │ • Remote Zero Trust
                │                       │ • Document metadata   │
                ├──────────────────────────────────────────────────────────────
IMPACT FAIBLE   │ 💤 OPTIONNELS         │ 📦 BACKLOG            │
                │ • Containers filter   │ • AI last_indexed     │
                │ • Trash calculate     │ • Search suggestions  │
```

---

## Phase 4: Plan d'Implémentation

### Sprint 5: Quick Wins (2-3 jours) - ~19h

| # | Tâche | Fichier | Effort |
|---|-------|---------|--------|
| 1 | Fix "Renommer" dans Drive | `drive/page.tsx:382` | 2h |
| 2 | Workspace Update API | `admin/workspaces/page.tsx` | 4h |
| 3 | Settings API | `settings/page.tsx` | 4h |
| 4 | Notifications Push | `send-notification-admin.tsx` | 6h |
| 5 | IMAP Test | `mail/api.rs` | 3h |

### Sprint 6: Storage Complet (1 semaine) - ~50h

| # | Tâche | Effort |
|---|-------|--------|
| 1 | Preview: Image resize/thumbnails | 8h |
| 2 | Preview: PDF rendering | 6h |
| 3 | Preview: Video frame extraction | 8h |
| 4 | Preview: Audio waveform | 4h |
| 5 | Permissions: CRUD database | 8h |
| 6 | Version History: Backend complet | 8h |
| 7 | Archive listing API | 4h |
| 8 | Document metadata API | 4h |

### Sprint 7-8: Sheets Complet (3-4 semaines) - ~150h

| Catégorie | Effort |
|-----------|--------|
| Menu Fichier | 20h |
| Menu Affichage | 15h |
| Menu Insertion | 25h |
| Menu Format | 30h |
| Menu Données | 25h |
| Menu Outils | 20h |
| Menu IA | 15h |

### Sprint 9: Slides Complet (1 semaine) - ~38h

| # | Tâche | Effort |
|---|-------|--------|
| 1 | Import diapositives | 8h |
| 2 | Templates système | 12h |
| 3 | Export PPTX | 4h |
| 4 | Export PDF | 4h |
| 5 | Insert Image | 6h |
| 6 | Créer copie | 4h |

### Sprint 10-11: LDAP + AD/GPO (2 semaines) - ~88h

| # | Tâche | Effort |
|---|-------|--------|
| 1 | LDAP Authentication | 16h |
| 2 | LDAP Connection test | 4h |
| 3 | LDAP Group sync | 12h |
| 4 | LDAP User sync | 12h |
| 5 | Service AD (Samba AD DC) | 24h |
| 6 | GPO Management UI | 20h |

### Sprint 12: DnD + Remote (1 semaine) - ~40h

| # | Tâche | Effort |
|---|-------|--------|
| 1 | DnD: File → Task link | 8h |
| 2 | DnD: Task → Calendar event | 8h |
| 3 | Remote: Zero Trust tunnel | 24h |

---

## Roadmap

```
MARS 2026
├── Sprint 5: Quick Wins ────────── [2-3 jours] ⬅️ START
└── Sprint 6: Storage Complet ───── [1 semaine]

AVRIL 2026
├── Sprint 7-8: Sheets Complet ──── [3-4 semaines]
└── Sprint 9: Slides Complet ────── [1 semaine]

MAI 2026
├── Sprint 10-11: LDAP + AD/GPO ─── [2 semaines]
└── Sprint 12: DnD + Remote ─────── [1 semaine]
```

**Durée totale: ~10-12 semaines**
**Effort total: ~385 heures**

---

## Métriques de Succès

- [ ] 0 messages "coming soon" dans le code
- [ ] 0 messages "not implemented" dans le code
- [ ] 0 boutons onClick vides
- [ ] 0 endpoints retournant 501
- [ ] 100% des menus Sheets fonctionnels
- [ ] 100% des menus Slides fonctionnels
- [ ] LDAP + AD/GPO opérationnel
- [ ] Storage previews pour tous formats
- [ ] DnD interconnexions actives
- [ ] Remote Zero Trust fonctionnel

---

## Action Items

1. ✅ Documenter ce plan
2. ⏳ Générer Epics/Stories BMAD
3. ⏳ Commencer Sprint 5: Quick Wins
