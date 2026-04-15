# Docs Universal Fonts Catalog — Implementation Report

**Date** : 2026-04-14
**Branche** : `feat/docs-fonts-catalog`
**Plan** : `docs/plans/2026-04-14-docs-fonts-catalog.md`
**Design** : `docs/plans/2026-04-14-docs-fonts-catalog-design.md`

## Résumé

3 phases implémentées (backend Rust, script Node TypeScript, frontend React/Tiptap), 20 commits sur `feat/docs-fonts-catalog`, validation par 4 reviews subagent (spec + qualité). Le sync réel des fontes (~7 GB, 2-4h) **n'a pas été lancé** — le code est prêt, l'utilisateur garde la décision finale.

## Phases livrées

### Phase 1 — Backend `signapps-docs` (Tasks 1-5)

7 commits (Tasks 1-5 + 2 fixes après reviews) :

| SHA | Commit |
|-----|--------|
| `a4ee0559` | feat(docs): add fonts manifest types |
| `844ce626` | feat(docs): add fonts manifest endpoint |
| `ff9528ff` | feat(docs): add fonts file streaming endpoint with slug guard |
| `c8c755e5` | feat(docs): wire fonts routes into router |
| `df0354c9` | fix(docs): preserve upstream 404 and content-length on font file endpoint |
| `22ec23da` | feat(storage): allow unauthenticated GET on whitelisted public buckets |
| `e0a25379` | fix(docs): harden fonts client (shared, timeouts, scheme validation, no immutable, clearer manifest msg) |

**Endpoints créés** :

- `GET /api/v1/fonts/manifest` (signapps-docs:3010) — proxy du JSON manifest depuis storage
- `GET /api/v1/fonts/files/:family/:variant` (signapps-docs:3010) — stream woff2 avec validation slug + 404 propre
- `GET /api/v1/files/system-fonts/*key` (signapps-storage:3004) — **nouveau bucket public** sans auth, allowlist via `PUBLIC_READ_BUCKETS`

**Hardening apporté en review** :

- Validation regex slug stricte (anti path-traversal)
- Status upstream 404 → 404, autres → 503 (avec message contextuel)
- `Content-Length` header sur le woff2
- `OnceLock<reqwest::Client>` partagé, timeout 10s, redirects désactivés (anti-SSRF metadata)
- Validation scheme http/https sur `STORAGE_INTERNAL_URL`
- `Cache-Control` sans `immutable` (URL slug-keyed pas content-hashed)
- Cache headers : manifest 24h public, files 30j public

### Phase 2 — Script ingestion (Tasks 6-10)

5 commits :

| SHA | Commit |
|-----|--------|
| `cedff88f` | chore(scripts): scaffold sync-fonts ingestion script |
| `95fa935d` | feat(scripts): clone fonts sources in sync-fonts |
| `43eda3d1` | feat(scripts): parse google fonts METADATA.pb |
| `b5c9a320` | feat(scripts): parse nerd-fonts variants |
| `9cde382b` | feat(scripts): compress and upload fonts to storage |

**Livrables** :

- `scripts/sync-fonts/` : projet Node 20 / TypeScript strict / ESM
- `npm run sync` (depuis `scripts/sync-fonts/`) — clone + parse + woff2 + upload + manifest, idempotent via cache `.sync-fonts-work/`
- Parsers Google Fonts (regex sur METADATA.pb) et Nerd Fonts (filename heuristics)
- Compression `wawoff2` (TTF → WOFF2)
- Upload via `PUT /api/v1/files/system-fonts/...` du storage avec bearer admin
- Manifest généré + uploadé en dernier
- **Script jamais exécuté** — gated par approbation utilisateur (run = ~2-4h, ~7 GB)

### Phase 3 — Frontend FontPicker (Tasks 11-16)

8 commits (incluant 2 fixes post-review) :

| SHA | Commit |
|-----|--------|
| `e97ac77a` | feat(docs): add fonts manifest types |
| `5da64d1f` | feat(docs): add useFontsCatalog hook |
| `f12a8ab9` | feat(docs): add useDynamicFont with @font-face injection |
| `adcd6afd` | feat(docs): add FontPickerDropdown with recents and favorites |
| `af825826` | feat(docs): add FontBrowserDialog with virtualization and fuzzy search |
| `752c09f6` | refactor(docs): replace static font select with universal FontPicker |
| `da038888` | fix(docs): escape font name in dynamic @font-face |
| `711bf6cd` | chore(docs): silence dead_code on fonts schema types |

**Livrables** :

- `client/src/lib/fonts/types.ts` — mirror du schema backend
- `client/src/lib/fonts/use-fonts-catalog.ts` — React Query hook (manifest 24h cache, no-retry)
- `client/src/lib/fonts/use-dynamic-font.ts` — injection `@font-face` à la demande, dedup via Set, escape XSS
- `client/src/components/docs/font-picker/FontPicker.tsx` — wrapper composé
- `client/src/components/docs/font-picker/FontPickerDropdown.tsx` — dropdown shadcn récents (10) + favoris + bouton "Toutes les polices"
- `client/src/components/docs/font-picker/FontBrowserDialog.tsx` — modale virtualisée (`@tanstack/react-virtual`), recherche fuzzy `Fuse.js` debounced 150ms, filtres catégorie en chips, preview inline dans la fonte
- `client/src/components/docs/editor/editor-toolbar.tsx` — `<Select>` statique remplacé par `<FontPicker>`
- `client/src/components/docs/editor.tsx` — `loadGoogleFont` legacy supprimé (remplacé par `useDynamicFont`)

**Persistance localStorage** :

- `signapps_fonts_recent` (max 10, FIFO)
- `signapps_fonts_favorites`

**Dépendances ajoutées** :

- `@tanstack/react-virtual` (frontend)
- `axios`, `fast-glob`, `wawoff2`, `tsx`, `typescript`, `@types/node` (script)
- `url` (backend signapps-docs)

## Reviews

- **Phase 1 spec** : NEEDS FIXES (3 items) → fixés (`df0354c9`) → APPROVED
- **Phase 1 quality** : 1 critique + 3 importants → fixés (`22ec23da`, `e0a25379`) → APPROVED
- **Phase 2 combiné** : APPROVED with minor non-blocking notes
- **Phase 3 combiné** : APPROVED with NITS → escape XSS appliqué (`da038888`) → final

## Validation qualité

- `cargo clippy -p signapps-docs -p signapps-storage --no-deps -- -D warnings` : pass sur code Phase 1 (3 erreurs `office/*` pré-existantes hors scope)
- `cargo test -p signapps-docs fonts::tests` : 2/2 pass
- `cd client && npx tsc --noEmit` : aucune erreur sur fichiers fonts/picker
- `cd client && npm run lint` : aucun warning sur fichiers fonts/picker

## Hors scope respecté

- Pas de fontes payantes (Adobe Fonts, etc.)
- Pas d'upload utilisateur custom
- Pas d'auto-sync périodique (lancement manuel admin)
- Pas de propagation aux autres modules (Slides, Design Canvas)
- Pas d'i18n des noms de fontes

## STOP point

**Sync réel non lancé.** Le code de Task 10 est prêt, dépendances installées. Pour lancer :

```powershell
$env:STORAGE_ADMIN_TOKEN = "<bearer-admin-jwt>"
cd scripts/sync-fonts
npm run sync
```

Durée estimée : 2-4h, ~7 GB final dans le bucket `system-fonts/`. Logs dans la console (à rediriger vers fichier si besoin).

## Recommandations de suivi

1. **Lancer le sync** une fois en environnement contrôlé pour peupler le bucket
2. **Smoke E2E manuel** Task 17 du plan : ouvrir un document Docs, vérifier picker dropdown + modale, sélectionner Roboto / Fira Code Nerd Font, vérifier rendu
3. **Cache moka serveur** sur `get_manifest` reporté à plus tard si l'endpoint devient hot — actuellement chaque call refetch storage
4. **Hash dans slug** (`regular.ab12cd.woff2`) pour permettre un futur retour à `Cache-Control: immutable` propre
5. **Étendre le picker** aux modules Slides et Design Canvas — ils ont leurs propres font selectors aujourd'hui
6. **Service JWT mint** : le bucket `system-fonts` est public read aujourd'hui ; si plus tard on veut servir des fontes premium par utilisateur, basculer sur du token-based plutôt qu'allowlist

## Commits totaux

20 commits sur `feat/docs-fonts-catalog`, du SHA `a4ee0559` (premier) à `711bf6cd` (dernier). Branche prête à merger ou à push.
