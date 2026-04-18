# 50 — Perf architecturale (single-binary runtime)

## Contexte

Avant la Phase D2 P1 :
- `just start` lançait 33 process séparés (un par service).
- Cold start : ~60 secondes.
- Chaque service : un `PgPool` dédié (→ 33 × 10 connexions Postgres).
- Migrations ré-exécutées par chaque service (warnings « already exists » non-fatals mais bruyants).
- `signapps-ai` : 5 secondes de hardware detection + provider registry au boot.
- Développeurs : devaient attendre 60 s avant chaque itération.

## Ce qui change

### Pour l'équipe dev

- `just start` → **un seul process** (`signapps-platform`) qui spawn les 34 services comme tokio tasks.
- Cold start : **< 3 secondes** (mesuré ~1.7 s sur dev box).
- Ressources partagées (PgPool, JwtConfig, Keystore, Cache, EventBus) : construites **une seule fois**.
- Migrations : exécutées **une seule fois**, toutes idempotentes (zero warning au 2e boot).
- `just start-legacy` → ancien mode (33 process) conservé pour debug isolé.
- `just smoke` : ping rapide des 5 services critiques.
- `./scripts/bench-coldstart.sh` : régression test cold start.

### Pour l'utilisateur final

- Démarrage serveur on-prem plus rapide.
- Première requête IA (chat, OCR, RAG) légèrement plus lente que les suivantes — les modèles sont chargés à la demande (lazy init via `OnceCell`).
- Empreinte mémoire divisée (un process au lieu de 33).
- Endpoints, ports, API JWT, frontend : **inchangés**.

### Pour les ops

- Moins de process à superviser.
- Supervisor interne : restart exponentiel (1/2/4/8/16/30 s), escalation `failed` après 5 crashes/min — logs structurés `tracing::error`.
- Env flags pour désactiver les listeners privilégiés en dev/CI (`PROXY_ENABLED=false`, `MAIL_PROTOCOLS_ENABLED=false`, etc.).

## Architecture (résumé)

```
signapps-platform (1 binaire, 34 tokio tasks)
├── SharedState::init_once() — pool + jwt + keystore + cache + event bus
├── run_migrations once
└── Supervisor
    ├── identity :3001
    ├── containers :3002
    ├── proxy :3003
    ├── storage :3004
    ├── ai :3005 (lazy providers / tool registry)
    ├── …
    ├── gateway :3099
    └── billing :8096
```

## Garanties de non-régression

- Tests `just test` / `just ci` inchangés.
- Test d'intégration `signapps-platform::boot` : boot < 3 s, tous les ports répondent 200.
- Test `signapps-platform::service_count` : 34 specs avec noms + ports uniques.
- Test `signapps-platform::migrations_idempotent` : zéro warning au 2e boot.
- Test E2E `e2e_single_binary` : login admin + /me renvoient 200.
- CI gate `cold-start-benchmark` (Task 36) : échec si boot > 3 s.

## Références

- Design spec : `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`
- Plan : `docs/superpowers/plans/2026-04-18-phase-d2-p1-single-binary.md`
- Architecture : `docs/architecture/single-binary.md`
- Debug skill : `.claude/skills/single-binary-debug/SKILL.md`
- Bench : `scripts/bench-coldstart.sh`
- CLAUDE.md : section Préférences de développement + Service Pattern

## Prochaines phases (non inclus dans P1)

- **P2** — Frontend Turbopack + RSC + dynamic imports (voir spec §5).
- **P3** — Web Workers éditeurs + virtualisation + Serwist cache edge + Lighthouse CI (voir spec §6).
