# Docs Universal Fonts Catalog — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exposer ~1700 fontes Google + 57 Nerd Fonts dans l'éditeur Docs (Tiptap), self-hostées dans `system-fonts/` du bucket signapps-storage, sélectionnables via un picker hybride dropdown récents + modale browser virtualisée.

**Architecture:** 3 couches — script TypeScript de sync (one-shot, idempotent), 2 endpoints proxy publics dans `signapps-docs` (manifest + file), front Tiptap avec hook React Query + `@font-face` injection à la demande.

**Tech Stack:** Rust (Axum, sqlx, tracing, utoipa) pour `signapps-docs` ; Node 20 / TypeScript / `wawoff2` pour le script ; Next.js 16 / React 19 / `@tiptap/extension-font-family` / `@tanstack/react-virtual` / `Fuse.js` côté frontend.

**Design doc:** `docs/plans/2026-04-14-docs-fonts-catalog-design.md`

**Préconditions :**

- PostgreSQL up + signapps-storage up (port 3004) + signapps-docs up (port 3010)
- Frontend dev : `cd client && npm run dev`
- Token admin pour script ingest dans `.env.sync-fonts` (`STORAGE_ADMIN_TOKEN=...`)

---

## Phase 1 — Backend `signapps-docs` (manifest + file endpoints)

### Task 1 : Types Rust pour le manifest

**Files:**
- Create: `services/signapps-docs/src/handlers/fonts.rs`

**Step 1: Écrire le scaffolding du module + types**

```rust
//! Universal fonts catalog handlers.
//!
//! Exposes a read-only JSON manifest (`/fonts/manifest`) and per-file
//! streaming endpoint (`/fonts/files/:family/:variant`). Both routes are
//! public — fonts are static assets meant to be loaded by `<link>` and
//! `@font-face` from any origin.

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

/// Top-level manifest shape returned by `GET /fonts/manifest`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FontsManifest {
    pub generated_at: String,
    pub version: String,
    pub total: usize,
    pub families: Vec<FontFamily>,
}

/// One font family with all its variants.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FontFamily {
    pub id: String,
    pub name: String,
    pub category: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub foundry: Option<String>,
    pub license: String,
    pub variants: Vec<FontVariant>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub popularity: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subsets: Option<Vec<String>>,
}

/// One renderable variant (weight + style) of a family.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FontVariant {
    pub weight: u16,
    pub style: String,
    pub file: String,
    pub size_bytes: u64,
}
```

**Step 2: Vérifier que ça compile**

```bash
cargo check -p signapps-docs
```

Expected: `Finished` sans erreur.

**Step 3: Commit**

```bash
git add services/signapps-docs/src/handlers/fonts.rs
git commit -m "feat(docs): add fonts manifest types"
```

### Task 2 : Handler `get_manifest`

**Files:**
- Modify: `services/signapps-docs/src/handlers/fonts.rs`

**Step 1: Ajouter le handler avec lecture storage**

```rust
const MANIFEST_KEY: &str = "manifest.json";
const FONTS_BUCKET: &str = "system-fonts";

/// Stream the fonts catalog from the storage bucket.
///
/// # Errors
///
/// Returns `503` if the bucket has not been seeded yet (manifest missing).
#[utoipa::path(
    get,
    path = "/api/v1/fonts/manifest",
    responses(
        (status = 200, description = "Fonts catalog", body = FontsManifest),
        (status = 503, description = "Catalog not synced yet"),
    ),
    tag = "fonts"
)]
#[tracing::instrument(skip(state))]
pub async fn get_manifest(
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, String)> {
    let object = state
        .storage
        .get_object(FONTS_BUCKET, MANIFEST_KEY)
        .await
        .map_err(|e| {
            tracing::warn!(?e, "fonts manifest not available");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Catalog not synced — run scripts/sync-fonts".to_string(),
            )
        })?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(object.data))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

**Step 2: Vérifier compilation**

```bash
cargo check -p signapps-docs
```

Expected: pass. (Si `state.storage.get_object` n'existe pas avec cette signature, regarder `state` AppState dans `services/signapps-docs/src/main.rs` et adapter — peut-être passer par un client HTTP vers signapps-storage à la place.)

**Step 3: Commit**

```bash
git add services/signapps-docs/src/handlers/fonts.rs
git commit -m "feat(docs): add fonts manifest endpoint"
```

### Task 3 : Handler `get_font_file` avec validation slug

**Files:**
- Modify: `services/signapps-docs/src/handlers/fonts.rs`

**Step 1: Ajouter validateur + handler**

```rust
fn is_valid_slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 100
        && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Stream a single woff2 file from the bucket.
///
/// # Errors
///
/// Returns `400` for invalid slugs (anti path-traversal), `404` if the
/// font is missing.
#[utoipa::path(
    get,
    path = "/api/v1/fonts/files/{family}/{variant}",
    params(
        ("family" = String, Path),
        ("variant" = String, Path, description = "e.g. regular, bold-italic"),
    ),
    responses(
        (status = 200, description = "WOFF2 payload", content_type = "font/woff2"),
        (status = 400, description = "Invalid family or variant slug"),
        (status = 404, description = "Font not found"),
    ),
    tag = "fonts"
)]
#[tracing::instrument(skip(state))]
pub async fn get_font_file(
    State(state): State<AppState>,
    Path((family, variant)): Path<(String, String)>,
) -> Result<Response, (StatusCode, String)> {
    if !is_valid_slug(&family) || !is_valid_slug(&variant) {
        return Err((StatusCode::BAD_REQUEST, "invalid slug".into()));
    }

    let key = format!("{}/{}.woff2", family, variant);
    let object = state
        .storage
        .get_object(FONTS_BUCKET, &key)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "font not found".into()))?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "font/woff2")
        .header(header::CONTENT_LENGTH, object.content_length)
        .header(header::CACHE_CONTROL, "public, max-age=2592000, immutable")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(object.data))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

**Step 2: Ajouter test unitaire pour `is_valid_slug`**

À la fin du fichier :

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_accepts_simple_lowercase() {
        assert!(is_valid_slug("roboto"));
        assert!(is_valid_slug("fira-code-nerd-font"));
        assert!(is_valid_slug("regular"));
        assert!(is_valid_slug("bold-italic"));
    }

    #[test]
    fn slug_rejects_path_traversal() {
        assert!(!is_valid_slug(""));
        assert!(!is_valid_slug("../etc/passwd"));
        assert!(!is_valid_slug("foo/bar"));
        assert!(!is_valid_slug("foo.woff2"));
        assert!(!is_valid_slug("Foo"));
        assert!(!is_valid_slug("foo bar"));
    }
}
```

**Step 3: Run tests**

```bash
cargo nextest run -p signapps-docs fonts::tests
```

Expected: PASS (2/2).

**Step 4: Commit**

```bash
git add services/signapps-docs/src/handlers/fonts.rs
git commit -m "feat(docs): add fonts file streaming endpoint with slug guard"
```

### Task 4 : Câbler les routes dans `main.rs`

**Files:**
- Modify: `services/signapps-docs/src/main.rs`

**Step 1: Importer le module + ajouter les routes**

Localiser le bloc `Router::new()` qui assemble les routes existantes. Ajouter :

```rust
// Près des autres `mod handlers;` ou `use handlers::...;`
use crate::handlers::fonts;

// Dans le router (publique, pas d'auth requise) :
let fonts_routes = Router::new()
    .route("/fonts/manifest", get(fonts::get_manifest))
    .route("/fonts/files/:family/:variant", get(fonts::get_font_file));

// Merge dans le router public au même niveau que /health
let v1_routes = public_routes
    .merge(fonts_routes)
    // ... autres .merge(...)
    ;
```

**Step 2: Ajouter `pub mod fonts;` dans `services/signapps-docs/src/handlers/mod.rs`** (si ce fichier existe)

**Step 3: cargo check**

```bash
cargo check -p signapps-docs
```

Expected: pass.

**Step 4: Commit**

```bash
git add services/signapps-docs/src/main.rs services/signapps-docs/src/handlers/mod.rs
git commit -m "feat(docs): wire fonts routes into router"
```

### Task 5 : Smoke test backend (sans manifest)

**Step 1: Lancer signapps-docs**

```bash
cargo run -p signapps-docs
```

**Step 2: curl manifest endpoint**

```bash
curl -i http://localhost:3010/api/v1/fonts/manifest
```

Expected: `HTTP/1.1 503 Service Unavailable` avec body `Catalog not synced — run scripts/sync-fonts`.

**Step 3: curl avec slug invalide**

```bash
curl -i 'http://localhost:3010/api/v1/fonts/files/../etc/passwd'
```

Expected: `400 Bad Request`.

**Step 4: kill server (Ctrl+C). Pas de commit (smoke test).**

---

## Phase 2 — Script d'ingestion `scripts/sync-fonts/`

### Task 6 : Scaffolding du script

**Files:**
- Create: `scripts/sync-fonts/package.json`
- Create: `scripts/sync-fonts/tsconfig.json`
- Create: `scripts/sync-fonts/src/sync-fonts.ts` (squelette uniquement)

**Step 1: Créer `scripts/sync-fonts/package.json`**

```json
{
  "name": "signapps-sync-fonts",
  "private": true,
  "type": "module",
  "scripts": {
    "sync": "tsx src/sync-fonts.ts"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "fast-glob": "^3.3.0",
    "wawoff2": "^2.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Créer `scripts/sync-fonts/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Créer le squelette `src/sync-fonts.ts`**

```typescript
#!/usr/bin/env tsx
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const WORK_DIR = resolve(process.cwd(), ".sync-fonts-work");
const STORAGE_URL = process.env.STORAGE_URL ?? "http://localhost:3004/api/v1";
const ADMIN_TOKEN = process.env.STORAGE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("STORAGE_ADMIN_TOKEN env var required");
  process.exit(1);
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log(`Working in ${WORK_DIR}`);
  // TODO: clone, parse, convert, upload
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 4: Installer les deps**

```bash
cd scripts/sync-fonts && npm install
```

Expected: aucune erreur.

**Step 5: Commit**

```bash
git add scripts/sync-fonts/package.json scripts/sync-fonts/tsconfig.json scripts/sync-fonts/src/sync-fonts.ts scripts/sync-fonts/package-lock.json
git commit -m "chore(scripts): scaffold sync-fonts ingestion script"
```

### Task 7 : Clone des sources

**Files:**
- Modify: `scripts/sync-fonts/src/sync-fonts.ts`

**Step 1: Ajouter helper `cloneShallow`**

```typescript
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function cloneShallow(repo: string, dest: string) {
  if (existsSync(dest)) {
    console.log(`  cached: ${dest}`);
    return;
  }
  console.log(`  cloning ${repo} → ${dest}`);
  execSync(`git clone --depth 1 ${repo} ${dest}`, { stdio: "inherit" });
}
```

**Step 2: Appeler dans main()**

```typescript
async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log("Step 1/4 — clone sources");
  cloneShallow("https://github.com/google/fonts.git", `${WORK_DIR}/google-fonts`);
  cloneShallow("https://github.com/ryanoasis/nerd-fonts.git", `${WORK_DIR}/nerd-fonts`);
  cloneShallow("https://github.com/brabadu/awesome-fonts.git", `${WORK_DIR}/awesome-fonts`);
}
```

**Step 3: Smoke run**

```bash
cd scripts/sync-fonts && STORAGE_ADMIN_TOKEN=test npm run sync
```

Expected: 3 dossiers clonés dans `.sync-fonts-work/`. Le script s'arrêtera là (pas encore d'upload). Patience : google/fonts est lourd (~3 GB shallow).

**Step 4: Commit**

```bash
git add scripts/sync-fonts/src/sync-fonts.ts
git commit -m "feat(scripts): clone fonts sources in sync-fonts"
```

### Task 8 : Parser google/fonts

**Files:**
- Modify: `scripts/sync-fonts/src/sync-fonts.ts`

**Step 1: Ajouter parser METADATA.pb (regex-based, pas de protobuf full)**

```typescript
import { readFileSync } from "node:fs";
import { glob } from "fast-glob";
import { basename, dirname } from "node:path";

interface RawFamily {
  id: string;
  name: string;
  category: string;
  source: "google" | "nerd" | "awesome";
  foundry?: string;
  license: string;
  files: { weight: number; style: string; absPath: string }[];
}

function parseGoogleMetadata(metadataPath: string): RawFamily | null {
  const content = readFileSync(metadataPath, "utf8");
  const name = /name:\s*"([^"]+)"/.exec(content)?.[1];
  const category = /category:\s*"([^"]+)"/.exec(content)?.[1] ?? "SANS_SERIF";
  if (!name) return null;

  const id = name.toLowerCase().replace(/\s+/g, "-");
  const dir = dirname(metadataPath);
  const license = dir.split("/").includes("ofl") ? "OFL-1.1"
                : dir.split("/").includes("apache") ? "Apache-2.0"
                : "UFL-1.0";

  const files: RawFamily["files"] = [];
  const fontRegex = /filename:\s*"([^"]+)"\s+post_script_name:\s*"[^"]+"\s+full_name:\s*"[^"]+"\s+style:\s*"([^"]+)"\s+weight:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = fontRegex.exec(content))) {
    files.push({
      weight: Number(m[3]),
      style: m[2],
      absPath: `${dir}/${m[1]}`,
    });
  }

  return {
    id,
    name,
    category: category.toLowerCase().replace("_", "-"),
    source: "google",
    foundry: "Google Fonts",
    license,
    files,
  };
}

async function scanGoogleFonts(root: string): Promise<RawFamily[]> {
  const metadataPaths = await glob(`${root}/{ofl,apache,ufl}/*/METADATA.pb`);
  console.log(`  scanning ${metadataPaths.length} google families`);
  return metadataPaths
    .map(parseGoogleMetadata)
    .filter((f): f is RawFamily => f !== null);
}
```

**Step 2: Appeler depuis main**

```typescript
console.log("Step 2/4 — scan sources");
const googleFamilies = await scanGoogleFonts(`${WORK_DIR}/google-fonts`);
console.log(`  google: ${googleFamilies.length} families`);
```

**Step 3: Smoke run**

Expected: log `google: ~1700 families`.

**Step 4: Commit**

```bash
git add scripts/sync-fonts/src/sync-fonts.ts
git commit -m "feat(scripts): parse google fonts METADATA.pb"
```

### Task 9 : Parser nerd-fonts

**Files:**
- Modify: `scripts/sync-fonts/src/sync-fonts.ts`

**Step 1: Scanner nerd-fonts**

```typescript
async function scanNerdFonts(root: string): Promise<RawFamily[]> {
  const dirs = await glob(`${root}/patched-fonts/*`, { onlyDirectories: true });
  console.log(`  scanning ${dirs.length} nerd families`);
  return dirs.map((dir) => {
    const name = basename(dir).replace(/([A-Z])/g, " $1").trim();
    const id = basename(dir).toLowerCase().replace(/\s+/g, "-") + "-nerd-font";
    return {
      id,
      name: `${name} Nerd Font`,
      category: "programming",
      source: "nerd" as const,
      foundry: "Ryanoasis Nerd Fonts",
      license: "MIT",
      files: [], // populated next step
    };
  });
}
```

**Step 2: Pour chaque famille nerd, lister ses .ttf et déduire weight/style**

À étendre dans `scanNerdFonts` :

```typescript
for (const fam of families) {
  const ttfs = await glob(`${root}/patched-fonts/${basename(/* family dir */)}/**/*.ttf`);
  for (const f of ttfs) {
    const filename = basename(f).toLowerCase();
    const weight = filename.includes("bold") ? 700 : 400;
    const style = filename.includes("italic") ? "italic" : "normal";
    fam.files.push({ weight, style, absPath: f });
  }
}
```

**Step 3: Appeler depuis main**

```typescript
const nerdFamilies = await scanNerdFonts(`${WORK_DIR}/nerd-fonts`);
console.log(`  nerd: ${nerdFamilies.length} families`);
```

**Step 4: Smoke run**

Expected: `nerd: 57 families` (chiffre approximatif).

**Step 5: Commit**

```bash
git add scripts/sync-fonts/src/sync-fonts.ts
git commit -m "feat(scripts): parse nerd-fonts variants"
```

### Task 10 : Conversion `.ttf` → `.woff2` + upload

**Files:**
- Modify: `scripts/sync-fonts/src/sync-fonts.ts`

**Step 1: Helper compress + upload**

```typescript
import wawoff2 from "wawoff2";
import axios from "axios";
import { createHash } from "node:crypto";

async function compressTtfToWoff2(ttfPath: string): Promise<Buffer> {
  const ttf = readFileSync(ttfPath);
  const woff2 = await wawoff2.compress(ttf);
  return Buffer.from(woff2);
}

async function uploadFont(family: string, variant: string, woff2: Buffer) {
  const key = `${family}/${variant}.woff2`;
  const form = new FormData();
  form.append("file", new Blob([woff2]), key);
  await axios.put(
    `${STORAGE_URL}/files/system-fonts/${encodeURIComponent(key)}`,
    woff2,
    {
      headers: {
        "Content-Type": "font/woff2",
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    },
  );
}

function variantSlug(weight: number, style: string): string {
  const w = weight === 400 ? "regular" : weight === 700 ? "bold" : `w${weight}`;
  return style === "italic" ? `${w}-italic` : w;
}
```

**Step 2: Pipeline d'upload + manifest**

```typescript
async function processAll(families: RawFamily[]): Promise<FontFamilyOut[]> {
  const out: FontFamilyOut[] = [];
  for (const fam of families) {
    const variants = [];
    for (const f of fam.files) {
      const slug = variantSlug(f.weight, f.style);
      const woff2 = await compressTtfToWoff2(f.absPath);
      await uploadFont(fam.id, slug, woff2);
      variants.push({
        weight: f.weight,
        style: f.style,
        file: `${fam.id}/${slug}.woff2`,
        size_bytes: woff2.length,
      });
    }
    out.push({ ...fam, variants });
    console.log(`  uploaded ${fam.id} (${variants.length} variants)`);
  }
  return out;
}
```

(Type `FontFamilyOut` mirror du Rust — à définir en haut du fichier.)

**Step 3: Génération + upload manifest**

```typescript
async function uploadManifest(families: FontFamilyOut[]) {
  const manifest = {
    generated_at: new Date().toISOString(),
    version: `1.0.${Date.now()}`,
    total: families.length,
    families,
  };
  await axios.put(
    `${STORAGE_URL}/files/system-fonts/manifest.json`,
    JSON.stringify(manifest, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    },
  );
  console.log(`Manifest uploaded — ${families.length} families`);
}
```

**Step 4: Brancher dans main()**

```typescript
console.log("Step 3/4 — upload (this is the long one)");
const allFamilies = [...googleFamilies, ...nerdFamilies];
const uploaded = await processAll(allFamilies);

console.log("Step 4/4 — manifest");
await uploadManifest(uploaded);
console.log("Done.");
```

**Step 5: Run réel (long ! 2-4h)**

⚠️ STOP — demander à l'utilisateur avant cette étape : confirmer la quota storage et la patience pour le run.

**Step 6: Commit**

```bash
git add scripts/sync-fonts/src/sync-fonts.ts
git commit -m "feat(scripts): compress and upload fonts to storage"
```

---

## Phase 3 — Frontend hooks + UI

### Task 11 : Types TypeScript du manifest

**Files:**
- Create: `client/src/lib/fonts/types.ts`

**Step 1: Mirror du schema backend**

```typescript
export interface FontsManifest {
  generated_at: string;
  version: string;
  total: number;
  families: FontFamily[];
}

export interface FontFamily {
  id: string;
  name: string;
  category: FontCategory;
  source: FontSource;
  foundry?: string;
  license: string;
  variants: FontVariant[];
  popularity?: number;
  subsets?: string[];
}

export type FontCategory =
  | "sans-serif"
  | "serif"
  | "monospace"
  | "display"
  | "handwriting"
  | "programming";

export type FontSource = "google" | "nerd" | "awesome";

export interface FontVariant {
  weight: number;
  style: "normal" | "italic";
  file: string;
  size_bytes: number;
}
```

**Step 2: Commit**

```bash
git add client/src/lib/fonts/types.ts
git commit -m "feat(docs): add fonts manifest types"
```

### Task 12 : Hook `useFontsCatalog`

**Files:**
- Create: `client/src/lib/fonts/use-fonts-catalog.ts`

**Step 1: Implémenter**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getServiceUrl, ServiceName } from "@/lib/api/factory";
import type { FontsManifest } from "./types";

export function useFontsCatalog() {
  return useQuery({
    queryKey: ["fonts", "manifest"],
    queryFn: async (): Promise<FontsManifest> => {
      const url = `${getServiceUrl(ServiceName.DOCS)}/fonts/manifest`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Fonts manifest unavailable (${res.status})`);
      }
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
```

**Step 2: tsc check**

```bash
cd client && npx tsc --noEmit 2>&1 | grep "lib/fonts"
```

Expected: aucune erreur.

**Step 3: Commit**

```bash
git add client/src/lib/fonts/use-fonts-catalog.ts
git commit -m "feat(docs): add useFontsCatalog hook"
```

### Task 13 : Hook `useDynamicFont` (injection `@font-face`)

**Files:**
- Create: `client/src/lib/fonts/use-dynamic-font.ts`

**Step 1: Implémenter**

```typescript
import { useEffect } from "react";
import { getServiceBaseUrl, ServiceName } from "@/lib/api/factory";
import type { FontFamily } from "./types";
import { useFontsCatalog } from "./use-fonts-catalog";

const loadedFonts = new Set<string>();

function injectFontFace(family: FontFamily) {
  const baseUrl = `${getServiceBaseUrl(ServiceName.DOCS)}/api/v1/fonts/files`;
  const styleEl = document.createElement("style");
  styleEl.dataset.signappsFont = family.id;
  styleEl.textContent = family.variants
    .map((v) => {
      const variantSlug =
        v.weight === 400 ? "regular"
        : v.weight === 700 ? "bold"
        : `w${v.weight}`;
      const slug = v.style === "italic" ? `${variantSlug}-italic` : variantSlug;
      return `@font-face {
        font-family: "${family.name}";
        font-weight: ${v.weight};
        font-style: ${v.style};
        font-display: swap;
        src: url("${baseUrl}/${family.id}/${slug}.woff2") format("woff2");
      }`;
    })
    .join("\n");
  document.head.appendChild(styleEl);
}

export function useDynamicFont(familyId: string | undefined) {
  const { data: catalog } = useFontsCatalog();
  useEffect(() => {
    if (!familyId || !catalog) return;
    if (loadedFonts.has(familyId)) return;
    const fam = catalog.families.find((f) => f.id === familyId);
    if (!fam) return;
    injectFontFace(fam);
    loadedFonts.add(familyId);
  }, [familyId, catalog]);
}

/** Imperative variant (for hover/scroll triggers). */
export function ensureFontLoaded(familyId: string, catalog: { families: FontFamily[] } | undefined) {
  if (!catalog || loadedFonts.has(familyId)) return;
  const fam = catalog.families.find((f) => f.id === familyId);
  if (!fam) return;
  injectFontFace(fam);
  loadedFonts.add(familyId);
}
```

**Step 2: tsc check**

```bash
cd client && npx tsc --noEmit 2>&1 | grep "lib/fonts"
```

Expected: clean.

**Step 3: Commit**

```bash
git add client/src/lib/fonts/use-dynamic-font.ts
git commit -m "feat(docs): add useDynamicFont with @font-face injection"
```

### Task 14 : Composant `FontPickerDropdown`

**Files:**
- Create: `client/src/components/docs/font-picker/FontPickerDropdown.tsx`

**Step 1: Implémenter**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Star } from "lucide-react";
import { useFontsCatalog } from "@/lib/fonts/use-fonts-catalog";
import { ensureFontLoaded } from "@/lib/fonts/use-dynamic-font";

const RECENTS_KEY = "signapps_fonts_recent";
const FAVORITES_KEY = "signapps_fonts_favorites";
const MAX_RECENTS = 10;

function readArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(familyId: string) {
  const list = readArray(RECENTS_KEY).filter((id) => id !== familyId);
  list.unshift(familyId);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
}

interface Props {
  value?: string;
  onChange: (familyId: string) => void;
  onOpenBrowser: () => void;
}

export function FontPickerDropdown({ value, onChange, onOpenBrowser }: Props) {
  const { data: catalog } = useFontsCatalog();
  const [recents, setRecents] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setRecents(readArray(RECENTS_KEY));
    setFavorites(readArray(FAVORITES_KEY));
  }, []);

  const select = (id: string) => {
    pushRecent(id);
    setRecents(readArray(RECENTS_KEY));
    onChange(id);
  };

  const currentFamily = catalog?.families.find((f) => f.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
          <span style={{ fontFamily: currentFamily?.name ?? "inherit" }}>
            {currentFamily?.name ?? "Police par défaut"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 max-h-96 overflow-y-auto">
        {favorites.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Favoris</div>
            {favorites.map((id) => {
              const fam = catalog?.families.find((f) => f.id === id);
              if (!fam) return null;
              return (
                <DropdownMenuItem
                  key={`fav-${id}`}
                  onMouseEnter={() => ensureFontLoaded(id, catalog)}
                  onClick={() => select(id)}
                  style={{ fontFamily: fam.name }}
                >
                  <Star className="h-3 w-3 mr-2 fill-current" />
                  {fam.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        {recents.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Récents</div>
            {recents.map((id) => {
              const fam = catalog?.families.find((f) => f.id === id);
              if (!fam) return null;
              return (
                <DropdownMenuItem
                  key={`rec-${id}`}
                  onMouseEnter={() => ensureFontLoaded(id, catalog)}
                  onClick={() => select(id)}
                  style={{ fontFamily: fam.name }}
                >
                  {fam.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={onOpenBrowser}>
          Toutes les polices...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: tsc check**

```bash
cd client && npx tsc --noEmit 2>&1 | grep "FontPickerDropdown"
```

Expected: clean.

**Step 3: Commit**

```bash
git add client/src/components/docs/font-picker/FontPickerDropdown.tsx
git commit -m "feat(docs): add FontPickerDropdown with recents and favorites"
```

### Task 15 : Composant `FontBrowserDialog` (modale virtualisée)

**Files:**
- Create: `client/src/components/docs/font-picker/FontBrowserDialog.tsx`

**Step 1: Vérifier que `@tanstack/react-virtual` et `fuse.js` sont installés**

```bash
cd client && npm ls @tanstack/react-virtual fuse.js
```

Si manquant :

```bash
cd client && npm install @tanstack/react-virtual fuse.js
```

**Step 2: Implémenter**

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useFontsCatalog } from "@/lib/fonts/use-fonts-catalog";
import { ensureFontLoaded } from "@/lib/fonts/use-dynamic-font";
import type { FontCategory, FontFamily } from "@/lib/fonts/types";

const CATEGORIES: FontCategory[] = [
  "sans-serif",
  "serif",
  "monospace",
  "display",
  "handwriting",
  "programming",
];

const FAVORITES_KEY = "signapps_fonts_favorites";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string;
  onSelect: (familyId: string) => void;
}

export function FontBrowserDialog({ open, onOpenChange, value, onSelect }: Props) {
  const { data: catalog } = useFontsCatalog();
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<FontCategory>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () =>
      catalog
        ? new Fuse(catalog.families, {
            keys: ["name", "foundry", "category"],
            threshold: 0.3,
          })
        : null,
    [catalog],
  );

  const filtered = useMemo<FontFamily[]>(() => {
    if (!catalog) return [];
    let list = catalog.families;
    if (search.trim()) {
      list = fuse ? fuse.search(search).map((r) => r.item) : list;
    }
    if (activeCategories.size > 0) {
      list = list.filter((f) => activeCategories.has(f.category));
    }
    return list;
  }, [catalog, fuse, search, activeCategories]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  const toggleCategory = (cat: FontCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const list: string[] = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Toutes les polices ({catalog?.total ?? 0})</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 border-b">
          <Input
            placeholder="Rechercher une police..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={activeCategories.has(cat) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const fam = filtered[vRow.index];
              return (
                <div
                  key={fam.id}
                  className="absolute left-0 right-0 px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-center justify-between border-b"
                  style={{
                    transform: `translateY(${vRow.start}px)`,
                    height: vRow.size,
                  }}
                  onMouseEnter={() => ensureFontLoaded(fam.id, catalog)}
                  onClick={() => {
                    onSelect(fam.id);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs text-muted-foreground">{fam.category} · {fam.source}</span>
                    <span
                      className="text-lg truncate"
                      style={{ fontFamily: fam.name }}
                    >
                      {fam.name} — The quick brown fox
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => toggleFavorite(fam.id, e)}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>{filtered.length} police{filtered.length > 1 ? "s" : ""}</span>
          <span>{value ? `Active : ${catalog?.families.find(f => f.id === value)?.name}` : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: tsc check**

```bash
cd client && npx tsc --noEmit 2>&1 | grep "FontBrowserDialog"
```

Expected: clean.

**Step 4: Commit**

```bash
git add client/src/components/docs/font-picker/FontBrowserDialog.tsx client/package.json client/package-lock.json
git commit -m "feat(docs): add FontBrowserDialog with virtualization and fuzzy search"
```

### Task 16 : Wrapper `FontPicker` + refacto toolbar

**Files:**
- Create: `client/src/components/docs/font-picker/FontPicker.tsx`
- Modify: `client/src/components/docs/editor/editor-toolbar.tsx` (lignes 350-363)

**Step 1: Wrapper FontPicker**

```tsx
"use client";

import { useState } from "react";
import { useDynamicFont } from "@/lib/fonts/use-dynamic-font";
import { FontPickerDropdown } from "./FontPickerDropdown";
import { FontBrowserDialog } from "./FontBrowserDialog";

interface Props {
  value?: string;
  onChange: (family: string) => void;
}

export function FontPicker({ value, onChange }: Props) {
  const [browserOpen, setBrowserOpen] = useState(false);
  useDynamicFont(value);

  return (
    <>
      <FontPickerDropdown
        value={value}
        onChange={onChange}
        onOpenBrowser={() => setBrowserOpen(true)}
      />
      <FontBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        value={value}
        onSelect={onChange}
      />
    </>
  );
}
```

**Step 2: Remplacer le `<Select>` dans editor-toolbar.tsx**

Localiser le bloc lignes 350-363 (`<Select value={currentFontFamily} onValueChange={handleFontFamilyChange}>...`) et le remplacer par :

```tsx
<FontPicker
  value={currentFontFamily}
  onChange={(family) => handleFontFamilyChange(family)}
/>
```

Importer en haut du fichier :

```tsx
import { FontPicker } from "@/components/docs/font-picker/FontPicker";
```

**Step 3: Retirer la liste statique `FONT_FAMILIES` dans editor-toolbar.tsx (lignes 97-105) si elle n'est plus utilisée**

Vérifier avec :

```bash
grep -n FONT_FAMILIES client/src/components/docs/editor/editor-toolbar.tsx
```

Si plus de référence dans le fichier → supprimer la const.

**Step 4: Retirer `loadGoogleFont` de editor.tsx (lignes 75-96)**

Vérifier les call sites :

```bash
grep -rn loadGoogleFont client/src
```

Si seulement dans editor.tsx, supprimer la fonction. Le hook `useDynamicFont` (déclenché par `useFontsCatalog` + sélection) prend le relais.

**Step 5: tsc + lint**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -E "(FontPicker|editor-toolbar|editor\.tsx)"
cd client && npm run lint 2>&1 | grep -E "(FontPicker|editor-toolbar)"
```

Expected: clean.

**Step 6: Commit**

```bash
git add client/src/components/docs/font-picker/FontPicker.tsx client/src/components/docs/editor/editor-toolbar.tsx client/src/components/docs/editor.tsx
git commit -m "refactor(docs): replace static font select with universal FontPicker"
```

### Task 17 : Smoke test E2E

**Step 1: Vérifier services up**

```bash
curl -s -o /dev/null -w "docs:%{http_code}\n" http://localhost:3010/health
curl -s -o /dev/null -w "manifest:%{http_code}\n" http://localhost:3010/api/v1/fonts/manifest
```

Expected: `docs:200`, `manifest:200` (si sync exécuté) ou `503` (si pas encore).

**Step 2: Ouvrir Docs dans le browser**

`http://localhost:3000/docs` → ouvrir un document → cliquer sur le picker → vérifier dropdown.

**Step 3: Cliquer "Toutes les polices..." → modale s'ouvre**

Vérifier :

- Recherche fonctionne
- Filtres catégorie fonctionnent
- Sélection applique la fonte au texte sélectionné
- Étoile ajoute aux favoris

**Step 4: Pas de commit (smoke test). Si bug → fix dans une task supplémentaire.**

---

## Phase 4 — Validation finale & rapport

### Task 18 : Qualité globale

```bash
cargo clippy -p signapps-docs --all-features --no-deps -- -D warnings
cargo fmt --package signapps-docs -- --check
cd client && npx tsc --noEmit
cd client && npm run lint
```

Expected: tout pass.

Si fmt diff : `cargo fmt --package signapps-docs` puis commit `style(docs): apply rustfmt`.

### Task 19 : Rapport final

**Files:**
- Create: `docs/plans/2026-04-14-docs-fonts-catalog-report.md`

Inclure : commits, endpoints créés, taille bucket finale, durée sync, screenshots du picker (si possible), bugs trouvés et corrigés, recommandations de suivi.

**Commit :**

```bash
git add docs/plans/2026-04-14-docs-fonts-catalog-report.md
git commit -m "docs(docs): add fonts catalog implementation report"
```

---

## Règles globales d'exécution

1. **Conventional Commits** obligatoires : `feat(docs):`, `feat(scripts):`, `feat(storage):`, `chore(scripts):`, `style(docs):`, `docs(docs):`, `refactor(docs):`
2. **Pas de `.unwrap()` / `println!`** en code Rust hors tests
3. **`#[tracing::instrument]`** sur les handlers publics, **`#[utoipa::path]`** sur les endpoints
4. **`/// rustdoc`** sur tous items publics nouveaux
5. **Tokens Tailwind sémantiques** côté frontend (`bg-card`, `text-foreground`, etc.)
6. **STOP avant Task 10 step 5** (run réel du sync — long et lourd)
7. **STOP si quota storage** dépassé pendant l'upload → revenir à l'utilisateur
8. **STOP si licence ambiguë** sur une fonte awesome-fonts → skip + log warning, pas de fail
