# Docs Module — Universal Fonts Catalog (Design)

**Date** : 2026-04-14
**Statut** : Validé, prêt pour planification
**Modules touchés** : `signapps-docs` (backend), `client/src/components/docs/` (frontend), nouveau script d'ingestion

## Contexte & objectif

Le module Docs (éditeur Tiptap) propose actuellement 7 fontes système (Arial, Times New Roman, Georgia, Verdana, Courier New, Trebuchet MS, Palatino) via un `<Select>` dans la toolbar. Un loader Google Fonts dynamique existe déjà (`editor.tsx:75-96`) mais aucun catalogue n'est exposé.

**Objectif** : exposer dans Docs l'ensemble des fontes libres provenant de :

- [google/fonts](https://github.com/google/fonts) — ~1700 familles
- [brabadu/awesome-fonts](https://github.com/brabadu/awesome-fonts) — best-effort selon licence
- [ryanoasis/nerd-fonts](https://github.com/ryanoasis/nerd-fonts) — 57 familles patches programmation

Self-hostés dans le bucket `system-fonts/` du service `signapps-storage` (port 3004), exposés via deux endpoints proxy sur `signapps-docs` (port 3010), sélectionnables dans l'éditeur via un picker hybride dropdown récents + modale browser virtualisée.

## Scope

**In scope** :

- Ingestion complète des 3 sources via script CLI (Node/TypeScript)
- Conversion `.ttf` → `.woff2` (gain ~30% taille)
- Manifest unique JSON listant familles + variants + métadonnées
- Endpoints backend : `GET /api/v1/fonts/manifest`, `GET /api/v1/fonts/files/{family}/{variant}`
- Hook frontend `useFontsCatalog` (React Query) + `useDynamicFont` (injection `@font-face`)
- UI : `FontPickerDropdown` (récents/favoris) + `FontBrowserDialog` (modale virtualisée avec recherche fuzzy + filtres catégorie/source)
- Refacto `editor-toolbar.tsx` pour utiliser le nouveau picker
- Suppression de l'ancien `loadGoogleFont` dans `editor.tsx`

**Hors scope** :

- Upload de fontes custom utilisateur
- Fontes commerciales payantes (Adobe Fonts, etc.)
- Synchronisation auto périodique (script lancé manuellement par admin)
- Internationalisation des noms de fontes (affichés tels quels)
- Application aux autres modules (Slides, Design Canvas — out of scope this iteration)

## Architecture

Trois couches strictes :

```
Sources GitHub        →  Script sync          →  Storage bucket          →  Backend proxy           →  Frontend
(google/nerd/awesome)    (scripts/sync-fonts)    (system-fonts/)             (signapps-docs)            (Tiptap toolbar)
```

### 1. Ingestion — `scripts/sync-fonts/sync-fonts.ts`

- Clone shallow des 3 repos dans `/tmp/fonts-sync/`
- Parse Google Fonts via `METADATA.pb` (parser regex simple)
- Scan Nerd Fonts via convention de nom de fichier
- Best-effort sur awesome-fonts (parse README links + fetch + license check)
- Conversion `.ttf` → `.woff2` via `wawoff2` ou wasm équivalent
- Upload vers bucket `system-fonts/` via API storage avec auth admin
- Génère `manifest.json` agrégé
- Idempotent : SHA-256 par fichier, skip si inchangé
- Logs dans `logs/sync-fonts/<timestamp>.log`
- État local : `system-fonts/.sync-state.json`

### 2. Backend — `services/signapps-docs/src/handlers/fonts.rs`

Deux handlers, routes publiques (pas d'auth) :

- `GET /api/v1/fonts/manifest`
  - Lit `system-fonts/manifest.json` depuis le bucket
  - Cache mémoire serveur 1h (moka)
  - HTTP `Cache-Control: public, max-age=86400` + `ETag`
  - 503 si manifest absent

- `GET /api/v1/fonts/files/{family}/{variant}`
  - Validation slug regex `[a-z0-9-]+` (anti path traversal)
  - Stream depuis `system-fonts/{family}/{variant}.woff2`
  - HTTP `Cache-Control: public, max-age=2592000, immutable`
  - `Content-Type: font/woff2` + CORS `*`

Conventions CLAUDE.md respectées : `#[tracing::instrument]`, `AppError` RFC 7807, `#[utoipa::path]` + `ToSchema`, `/// rustdoc`, pas de `.unwrap()` hors tests.

### 3. Frontend

```
client/src/
├── lib/fonts/
│   ├── types.ts                    # Mirror du schema backend
│   ├── use-fonts-catalog.ts        # React Query hook (manifest)
│   └── use-dynamic-font.ts         # Inject @font-face on demand
└── components/docs/font-picker/
    ├── FontPicker.tsx              # Wrapper composant
    ├── FontPickerDropdown.tsx      # Dropdown récents + favoris + bouton "Toutes"
    └── FontBrowserDialog.tsx       # Modale browse virtualisée (@tanstack/react-virtual)
```

- Récents persistés dans `localStorage["signapps_fonts_recent"]` (max 10, FIFO)
- Favoris persistés dans `localStorage["signapps_fonts_favorites"]`
- Recherche fuzzy : `Fuse.js` sur nom + foundry + category (debounce 150ms)
- Lazy-load au scroll (intersection observer) — n'injecte les `@font-face` que pour les fontes visibles
- `font-display: swap` dans toutes les `@font-face` (anti layout shift)

## Manifest schema

```typescript
interface FontsManifest {
  generated_at: string;        // ISO 8601
  version: string;             // semver, bumped à chaque sync
  total: number;
  families: FontFamily[];
}

interface FontFamily {
  id: string;                  // slug: "roboto", "fira-code-nerd-font"
  name: string;                // display
  category: "sans-serif" | "serif" | "monospace" | "display" | "handwriting" | "programming";
  source: "google" | "nerd" | "awesome";
  foundry?: string;
  license: string;             // "OFL-1.1", "Apache-2.0", "MIT", ...
  variants: FontVariant[];
  popularity?: number;         // ranking Google Fonts (1 = top)
  subsets?: string[];
}

interface FontVariant {
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
  file: string;                // path bucket: "roboto/regular.woff2"
  size_bytes: number;
}
```

## Stratégie de cache

| Couche | TTL | Mécanisme |
|--------|-----|-----------|
| Browser HTTP (manifest) | 24h | `Cache-Control: max-age=86400` + ETag |
| Browser HTTP (font files) | 30j immutable | `Cache-Control: max-age=2592000, immutable` |
| Server memory (manifest) | 1h | moka cache dans handler |
| React Query (frontend) | 24h | `staleTime: 86400000` |

## Critères de succès

- Ouverture dropdown < 50 ms (catalog cached)
- Ouverture modale < 200 ms
- Recherche fuzzy < 100 ms par frappe pour 1700 entries
- Sélection d'une fonte → application visible < 500 ms (download + apply)
- Aucun layout shift au load (`font-display: swap`)
- Manifest endpoint < 50 ms en cache mémoire serveur
- Fonts endpoint < 100 ms (passthrough storage)
- Premier sync : 2-4h selon connexion + CPU (woff2 = CPU-intensive)
- Sync incrémentale : 5-15 min

## Risques & points d'arrêt

- **Taille bucket** : ~6-8 GB. Vérifier capacité storage avant ingestion. STOP si quota dépassé.
- **Licences awesome-fonts** : si parser README échoue ou licence ambiguë → skip silencieux + log warning.
- **Path traversal sur `/fonts/files/...`** : validation regex stricte obligatoire. Test unitaire dédié.
- **Performance modale** : si > 2000 entries dégradent l'UX, tomber sur pagination côté client (max 500 visibles).

## Conventions appliquées

- Rust : `#[tracing::instrument]`, `AppError`, `#[utoipa::path]`, `/// rustdoc`, pas de `.unwrap()` hors tests
- TypeScript : tokens Tailwind sémantiques, path alias `@/*`, hooks React Query
- Commits : Conventional Commits (`feat(docs):`, `feat(storage):`, `chore(scripts):`)
- Endpoints publics : pas de JWT requis (assets statiques publics)
- Sécurité : validation regex sur tous les paths utilisateurs
