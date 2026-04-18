# 52 — Polish runtime (P3)

## Ce qui change pour l'équipe dev

- `bundle-budget` CI job passe au vert après vendor trim (lucide barrel → per-icon chunks, lazy app-shell globals, `optimizePackageImports` étendu).
- `unsafe-eval` retiré de la CSP main : l'évaluateur de formules sheets est désormais un parser récursif-descendant pur. Worker infrastructure (`client/src/workers/formula.worker.ts` + client) en place pour futur off-main-thread recalc.
- Markdown export/preview dans docs éditeur tourne dans un Worker (`markdown.worker.ts`).
- Nouveau composant générique `<VirtualList>` (`client/src/components/common/virtual-list.tsx`) utilisé sur chat, mail, storage (liste), notifications popover.
- Nouveau CI gate `lighthouse-ci` : échec si une des 10 pages clés passe sous seuil (Performance <0.85, LCP >2.5s, TTI >3.5s, CLS >0.1, TBT >200ms).

## Ce qui change pour l'utilisateur final

- Bundle initial allégé (lucide-react barrel killed, providers + app-layout lazy) → premier paint plus rapide.
- Sheets éditeur : évaluation des formules ne peut plus déclencher un `unsafe-eval` main-thread.
- Listes chat/mail/storage/notifs : scroll fluide même à 10 k items (virtualisation).
- Navigation back vers listes snappy (SW `StaleWhileRevalidate` sur `/api/v1/**/list`).
- Kill-switch `/sw.js` testé automatiquement via Playwright.

## Concerns connus (follow-ups post-P3)

1. **Contacts + NotificationHistory** encore non virtualisés : utilisent `<Table>`, incompatible avec `<VirtualList>` (semantics). Refactor table→flex layout nécessaire.
2. **Formula worker** : infrastructure déployée mais les 5 sheets files continuent d'appeler le parser sync. Migration vers worker async possible en P4 si latency devient critique.
3. **Lighthouse CI** : premier run peut surfacer des routes sous seuil — attendu, tuning par route via follow-up.
4. **Playwright frame-time bench** (`p3-chat-scroll.spec.ts`) cible `/dashboard` comme proxy ; fixture chat 5k messages requise pour mesure réelle.

## Suivi

- Design : `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan : `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
- Debug skills : `.claude/skills/workers-debug/`, `.claude/skills/virtualization-debug/`
- SW doc : `docs/architecture/service-worker.md`
- VAD doc : `docs/architecture/vad-usage.md`
