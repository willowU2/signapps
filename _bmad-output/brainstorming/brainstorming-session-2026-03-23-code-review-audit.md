---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Audit code global de SignApps Platform - sécurité, bugs, qualité, performance, robustesse'
session_goals: 'Identifier et corriger toutes les vulnérabilités, bugs, problèmes de qualité, risques de performance et faiblesses de robustesse'
selected_approach: 'ai-recommended + progressive-flow'
techniques_used: ['Six Thinking Hats', 'Five Whys + Morphological Analysis', 'First Principles + SCAMPER', 'Solution Matrix + Decision Tree']
ideas_generated: 155
context_file: ''
---

# Brainstorming Session Results — Code Review Audit

**Facilitator:** Etienne
**Date:** 2026-03-23

## Session Overview

**Topic:** Audit code global de SignApps Platform — backend Rust (9+ services + 4 crates), frontend Next.js, infrastructure
**Goals:** Couverture 360° — Sécurité, Bugs fonctionnels, Qualité de code, Performance, Robustesse, Licences

## Findings Summary

| Domaine | SECURITY | BUG | PERF | ROBUST | QUALITY | Total |
|---------|----------|-----|------|--------|---------|-------|
| Identity + Common | 17 | 3 | 2 | 4 | 3 | 29 |
| Proxy + Storage + Cache | 10 | 4 | 2 | 1 | 1 | 18 |
| AI + Media + Runtime | 12 | 7 | 6 | 10 | 3 | 38 |
| Services restants (9) | 14 | 4 | 6 | 5 | 0 | 29 |
| Frontend Next.js | 9 | 6 | 2 | 4 | 5 | 26 |
| Licences (Rust + npm) | 3 | 0 | 0 | 0 | 6 | 9 |
| Architecture (brainstorm) | 5 | 0 | 0 | 0 | 1 | 6 |
| **TOTAL** | **70** | **24** | **18** | **24** | **19** | **155** |

## TIER 0 — Quick Wins Sécurité (Jour 1)

1. Ajouter auth_middleware aux 5 services sans auth (Chat, SecureLink, Metrics, Docs, Media)
2. Ajouter auth_middleware + require_admin aux routes jobs du Scheduler
3. Ajouter check blacklist:{token} dans auth middleware
4. Ajouter ; Secure aux Set-Cookie (identity + frontend)
5. Panic si JWT_SECRET non défini
6. Ajouter require_admin sur proxy routes, shield, storage quotas/settings
7. Blacklist ancien refresh token sur refresh
8. Supprimer ignoreBuildErrors: true dans next.config.ts

## TIER 1 — Vulnérabilités Exploitables (Semaine 1)

9. Path traversal Storage (bucket/key) — valider, interdire .., /, null
10. Command injection Storage mounts — whitelist fs_type, sanitiser options
11. SQL injection Containers (provision/deprovision DB) — regex ^[a-z0-9_]+$
12. LDAP filter injection — échapper *()\\NUL per RFC 4515
13. XSS wiki-page.tsx — ajouter DOMPurify
14. XSS table-of-contents.ts — DOM APIs au lieu de innerHTML
15. CSS injection branding customCss — valider/whitelist
16. Open redirect auth-provider — valider redirect starts with /
17. SSRF AI action (LLM target) — regex alphanum+dash, forward JWT
18. SSRF webhooks — bloquer IP privées
19. Prompt injection AI — prepend sécurité
20. Bootstrap endpoint public — DB flag permanent
21. MFA TOTP base32 bytes mismatch — Secret::Encoded().to_bytes()
22. MFA activé avant vérification — stocker pending
23. Password leak share download URL — session token
24. Chat author_id impersonation — dériver de JWT Claims

## TIER 2 — Bugs & Robustesse (Semaine 2)

25. WebSocket proxy cassé (pas de tunnel bidirectionnel)
26. unreachable!() panic proxy body error
27. Cache get() retourne TTL-encoded data corrompue
28. Rate limit counters memory leak
29. Upload Storage fichier entier en mémoire
30. Quota check race condition
31. Active sessions store jamais peuplé
32. Backup codes MFA jamais persistés
33. LDAP password base64 → impl AES
34. Webhook secrets exposés dans responses
35. reindex_all AI no-op
36. Frontend dual API clients
37. MFA verify + LDAP login ne sync pas auth cookie
38. Containers missing system protection restart/stop/remove
39. Containers missing ownership check get/logs/stats
40. Cron parsing incorrect

## TIER 3 — Licences & Housekeeping (Semaine 2-3)

41. Remplacer xlsx par exceljs (MIT)
42. Remplacer @untitledui/icons par lucide-react
43. Résoudre Tiptap Pro extensions
44. Ajouter 0BSD + CDLA-Permissive-2.0 dans deny.toml
45. Ajouter license.workspace = true à 6 services
46. Clarifier redis dans workspace deps
47. Déplacer scripts seed hors client
48. Security headers manquants next.config.ts
49. Permissive CORS collab/docs/chat/mail
50. JWT aud/iss validation désactivée

## TIER 4 — Performance (Continu)

51. Argon2 sur thread async → spawn_blocking
52. N+1 list_objects Storage
53. Unbounded SSE/WebSocket connections
54. Whisper mutex sérialise transcriptions
55. SSE parsers lignes partielles cross-chunk
56. String truncation byte boundary UTF-8
57. unsafe impl Send/Sync TTS/OCR
58. Ollama embeddings séquentiels

## Patterns Systémiques (Root Causes)

### WHY 1: 5 services sans authentification
Root cause: Pas de test d'intégration vérifiant que chaque endpoint non-public requiert un JWT

### WHY 2: Command/SQL injection dans 3 services
Root cause: Pas de validation layer systématique (pas de types newtype pour BucketName, ContainerName, DbName)

### WHY 3: Missing admin checks
Root cause: Pas de convention claire sur quels endpoints sont admin-only vs user-level

### WHY 4: XSS multiples côté frontend
Root cause: Utilisation de dangerouslySetInnerHTML sans sanitisation DOMPurify systématique

### WHY 5: Incohérences auth (cookies, tokens, refresh)
Root cause: Migration partielle de localStorage tokens vers HttpOnly cookies — paths non migrés

## Licences

### Rust (cargo deny) — CLEAN
- Seules 0BSD et CDLA-Permissive-2.0 à ajouter (permissives)
- 6 services manquent license.workspace = true

### Frontend (npm) — 3 ISSUES CRITIQUES
- xlsx (SheetJS) — licence contestée → remplacer par exceljs
- @untitledui/icons + file-icons — licence commerciale → remplacer par lucide-react
- @tiptap extensions Pro (unique-id, drag-handle, file-handler) — licence commerciale → décision requise
