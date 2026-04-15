# Drive — Sanity Check End-to-End (Design)

**Date** : 2026-04-14
**Statut** : Validé, prêt pour planification
**Module** : Drive (`/drive`, backend `signapps-storage` port 3004)

## Contexte

Le module Drive a des APIs backend (upload, download, CRUD, share, versions, trash) et des composants frontend, mais l'intégration a des trous. Objectif : garantir que tous les parcours de base fonctionnent end-to-end.

## Objectif & scope

**Objectif** : le Drive passe tous les parcours utilisateur end-to-end sans erreur sur `http://localhost:3000/drive`.

**Scope couvert** :

- **Fondations** — upload fichier, créer dossier, renommer, déplacer, télécharger, supprimer
- **Gestion** — corbeille (restore / purge), favoris (star / unstar)
- **Collaboration** — partage par lien public (créer, accéder, révoquer), historique versions (voir, restaurer)
- **Recherche** — recherche basique par nom
- **Preview** — PDF + images

**Hors scope** : sync desktop/mobile, auto-tag IA, OCR, semantic search, annotations PDF, chunking résumable > 100MB, migration ACL → `signapps-sharing`, tests de charge.

## Approche retenue

**Par criticité, en couches** (approche 3) : on garantit que les fondations tournent avant de toucher aux features avancées. Si une couche haute est massivement cassée, on peut la sortir du scope sans compromettre le reste.

Méthode en 4 phases :

1. **Revue de code ciblée** — pour chaque couche : incohérences routes backend vs. appels frontend, types de retour vs. types TS, gestion d'erreurs, props composants.
2. **Audit Playwright par couche** — via webapp-testing : login auto-admin, navigation, exécution scénario, capture console + network, marquer OK/KO.
3. **Fix par couche** — KO isolés fixés directement, bugs transversaux fixés une fois et re-test des couches affectées. Respect strict CLAUDE.md (pas de `println!`/`unwrap()`, `#[instrument]`, `AppError`, rustdoc).
4. **Re-run Playwright final** — tous parcours passent.

**Ordre des couches** : fondations → gestion → collaboration → avancé.

## Composants à auditer

### Backend (`services/signapps-storage/`, port 3004)

- `drive.rs` — CRUD nodes VFS
- `files.rs` — upload/download + dédup SHA-256
- `shares.rs` — liens publics (password, expiration, max_downloads)
- `trash.rs` — soft-delete + restore + purge
- `favorites.rs` — star/unstar
- `versions.rs` — historique + restore
- `preview.rs` — thumbnails PDF/images
- `search.rs` — recherche par nom

### Frontend

- Page : `client/src/app/drive/page.tsx`
- Wrappers API : `client/src/lib/api/drive.ts`, `client/src/lib/api/storage.ts`
- Composants dédiés : `client/src/components/drive/`
- Composants partagés : `client/src/components/storage/`

### Points d'attention identifiés en revue initiale

1. Migration ACL legacy → `signapps-sharing` en cours → drift possible sur partage
2. Aucun data-testid en place → Playwright cible via rôles/textes initialement, data-testids ajoutés au fur et à mesure
3. Upload limité à 100MB (Axum body limit) → tests < 100MB
4. Pas de Zustand store Drive → état via React Query

## Environnement

- Services déjà up localement (PostgreSQL, `signapps-storage`, frontend `npm run dev` sur port 3000)
- Auto-login : `http://localhost:3000/login?auto=admin`
- Playwright via webapp-testing skill

## Livrables

1. Ce design doc (committé avant démarrage)
2. Plan d'implémentation généré par `writing-plans` avec checkpoints par couche
3. Commits conventionnels `fix(drive):` / `feat(drive):` — un par zone de fix, pas de mega-commit
4. Tests Playwright dans `client/e2e/` (étendre `drive-smoke.spec.ts` ou nouveaux fichiers par couche)
5. Data-testids ajoutés : convention `data-testid="drive-{action}-{target}"`
6. Rapport final : bugs trouvés + corrigés par couche

## Critères de succès (Definition of Done)

Pour chaque parcours du scope, les 3 conditions :

- Fonctionne en navigateur : Playwright exécute le scénario sans error ni exception console
- Pas d'erreur backend : logs `signapps-storage` clean (pas d'`ERROR`, pas de 500)
- Feedback UI correct : état loading, success toast, error toast si applicable

## Risques & points d'arrêt

- Bug backend nécessitant une migration SQL → demander validation avant de créer le fichier migration
- Partage trop cassé à cause de la migration ACL en cours → sortir le partage du scope et documenter
- Services non démarrés en Phase 2 → prévenir au lieu de démarrer

## Conventions appliquées

- Rust : pas de `println!`/`eprintln!`/`dbg!`, pas de `.unwrap()`/`.expect()` hors tests, `#[tracing::instrument]` sur handlers publics, `AppError` RFC 7807, `#[utoipa::path]` + `ToSchema`, `/// rustdoc` sur items publics
- TypeScript : tokens Tailwind sémantiques (`bg-card`, `text-foreground`), path alias `@/*`
- Commits : Conventional Commits obligatoires
