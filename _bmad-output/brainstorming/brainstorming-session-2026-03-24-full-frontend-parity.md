---
stepsCompleted: [1]
inputDocuments: []
session_topic: 'Implémenter tous les services backend dans le frontend Next.js'
session_goals: 'Parity complète backend/frontend pour les 24 services SignApps'
selected_approach: ''
techniques_used: []
ideas_generated: []
---

## Session Overview

**Topic:** Implémenter tous les services backend dans le frontend Next.js
**Goals:** Parity complète backend/frontend — chaque service doit avoir page UI + API client + composants fonctionnels

### Gap Analysis

#### Services avec frontend COMPLET (rien à faire)
- identity, storage, scheduler, containers, ai, pxe, remote, workforce

#### Services avec frontend PARTIEL (à compléter)
- chat (98 lignes — basique)
- meet (127 lignes — basique)
- contacts (344 lignes — pas d'API client, seed data)
- forms (302 lignes — URL hardcodée, pas d'API client)
- mail (295 lignes — fonctionnel)
- media (API client ok, pas de page)

#### Services SANS frontend (à créer de zéro)
- office (30 routes backend, API client ok, AUCUNE page)
- proxy (22 routes, API client ok, AUCUNE page)
- metrics (20 routes, API client ok, AUCUNE page)
- securelink (33 routes, RIEN côté frontend)
- collab (WebSocket, RIEN côté frontend)

#### Services STUB (backend + frontend minimaux)
- billing (stub backend 8096, stub frontend)
- notifications (stub backend 8095, stub frontend)
- it-assets (stub backend minimal)

#### Conflits de ports détectés
- Port 3014: contacts + meet
- Port 3015: forms + it-assets
