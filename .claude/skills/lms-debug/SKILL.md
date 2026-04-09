---
name: lms-debug
description: Use when debugging the LMS (Learning Management System) module. Spec at docs/product-specs/22-lms.md. Covers course creation, SCORM/xAPI content, learner progress, quizzes, certificates, training paths. Backend may use signapps-docs for content storage.
---

# LMS — Debug Skill

## Source of truth
**`docs/product-specs/22-lms.md`**

## Key journeys
1. Create course → add lessons → publish
2. Learner enrolls → progress tracked
3. Complete quiz → score recorded
4. SCORM package import → content plays
5. Certificate generation on completion

## Dependencies
- **SCORM API** wrapper — check for MIT alternatives
- **xAPI** (TinCan) — open standard
- **pdf-lib** (MIT) for certificates ✅

### Forbidden
- **Moodle** — GPL ❌ (study docs only)
- **Canvas LMS** — AGPL ❌

## Historique
- **2026-04-09** : Skill créé (skeleton).
