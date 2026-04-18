# 51 — Perf frontend (Turbopack + RSC + dynamic imports)

## Ce qui change pour l'équipe dev

- `npm run dev` utilise désormais Turbopack (plus `--webpack`). Dev server Ready en ~444 ms (mesuré).
- Tiptap, LiveKit, MediaPipe, Monaco exposent des wrappers lazy dans `client/src/components/{editor,meet}/*-lazy.tsx`.
- 5 pages (`/dashboard`, `/mail`, `/forms`, `/contacts`, `/projects`) passent en React Server Components : le HTML arrive streamé depuis le serveur via `client/src/lib/server/*.ts` helpers.
- Nouveau CI gate `bundle-budget` dans `.github/workflows/ci.yml` : échec si une route dépasse son budget gzipped. Gate actuellement en rouge — voir follow-ups.

## Ce qui change pour l'utilisateur final

- Premier compile de page passe de 13 s à < 1 s (Turbopack).
- Pages liste streament depuis le serveur : HTML arrive avant JS.
- Premier clic sur éditeur (doc, design, sheet) ou meet déclenche un skeleton 50-200 ms le temps du chunk — puis plein UX.

## État à la livraison (mesuré Wave E)

- Bundle budget : 9/10 routes critiques au-dessus du budget (voir §14 du spec design). Principal levier restant : prune le vendor chunk partagé ~650 kB qui tire tout le monde.
- LCP : Lighthouse local non représentatif (backend non up). Mesure fiable requise en CI avec stack complète.
- Cold compile : Turbopack Ready < 500 ms en dev server startup.

## Follow-ups après P2

1. Trimer le vendor chunk commun pour ramener le root `/` sous 250 kB gzip.
2. Lighthouse CI sur 10 pages clés avec stack backend complète.
3. Extraire plus d'îlots client dans les RSC pages massives (ex : `/contacts` 763 kB, `/mail` 742 kB).
4. Activer `perf-budget-exception` label pathway dans CI pour débloquer les PRs urgentes avant la réduction du vendor chunk.

## Références

- Design : `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`
- Plan : `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`
- Debug skills : `.claude/skills/turbopack-debug/`, `.claude/skills/rsc-migration-debug/`
- Budget CI : `.github/workflows/ci.yml` job `bundle-budget`
- Script local : `cd client && npm run budget`
