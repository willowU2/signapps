---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'Suite Office SignApps - Migration Tiptap v3 + Multi-format Support'
session_goals: 'Extensions Tiptap, Export/Import Office, PDF, Features Pro DIY, Optimisations Rust'
selected_approach: 'ai-recommended'
techniques_used: ['morphological-analysis', 'cross-pollination', 'scamper', 'reverse-brainstorming']
ideas_generated: [127]
context_file: ''
constraints:
  license: 'Apache 2.0 ou MIT uniquement'
  backend: 'Rust only'
  stack: 'Conserver Next.js 16 + Tiptap + Yjs + Fabric.js'
  optimization: 'Performance, mémoire, temps de réponse'
---

# Brainstorming Session Results - Suite Office SignApps

**Facilitator:** Etienne
**Date:** 2026-03-11
**Duration:** Mode Automatique

---

## Contraintes Directrices

| Contrainte | Valeur |
|------------|--------|
| **Licence** | Apache 2.0 ou MIT uniquement |
| **Backend** | Rust only (pas de Node.js serveur) |
| **Stack Frontend** | Next.js 16 + Tiptap v3 + Yjs + Fabric.js |
| **Optimisation** | Performance, mémoire, temps de réponse |

---

## PHASE 1: ANALYSE MORPHOLOGIQUE

### Matrice Dimensionnelle Complète

| Dimension | Options |
|-----------|---------|
| **Modules App** | Docs, Sheets, Slides, PDF Viewer, Board, Mail Merge |
| **Formats Import** | DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP, RTF, CSV, TSV, TXT, MD, HTML, EPUB, JSON |
| **Formats Export** | DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP, RTF, CSV, TSV, TXT, MD, HTML, PNG, SVG, EPUB, JSON |
| **Extensions Tiptap v3** | FontFamily, FontSize, CharacterCount, Typography, DragHandle, Mathematics, Comments, TrackChanges, Markdown |
| **Features Pro DIY** | Comments, TrackChanges, Import/Export, Templates, Mail Merge, Content Migrations |
| **Collaboration** | Real-time (Yjs/Yrs), Offline-first, Presence, Cursors, History, Permissions |
| **Backend Rust** | PDF engine, Office parser, Format converter, Template engine, Collaboration server |

---

## PHASE 2: CROSS-POLLINATION - Bibliothèques Rust Open Source

### PDF - Génération et Manipulation

| Crate | Fonction | Licence | Notes |
|-------|----------|---------|-------|
| **[krilla](https://github.com/LaurenzV/krilla)** | PDF generation high-level | MIT/Apache 2.0 | Recommandé - API ergonomique |
| **[pdf-writer](https://lib.rs/crates/pdf-writer)** | PDF low-level step-by-step | MIT/Apache 2.0 | Pour contrôle fin |
| **[lopdf](https://github.com/J-F-Liu/lopdf)** | PDF manipulation | MIT | Rust 1.85+, object streams |
| **[pdf_oxide](https://crates.io/crates/pdf_oxide)** | Text extraction ultra-rapide | MIT/Apache 2.0 | 5x plus rapide que alternatives |
| **[printpdf](https://github.com/fschutt/printpdf)** | PDF + WASM | MIT | Support WebAssembly |

### Office Formats - DOCX/XLSX/PPTX

| Crate | Fonction | Licence | Notes |
|-------|----------|---------|-------|
| **[office2pdf](https://lib.rs/crates/office2pdf)** | DOCX/XLSX/PPTX → PDF | Apache 2.0 | Pure Rust, Typst-powered |
| **[docx-rust](https://crates.io/crates/docx-rust)** | DOCX read/write | MIT | Complet |
| **[rust_xlsxwriter](https://github.com/jmcnamara/rust_xlsxwriter)** | XLSX write | MIT/Apache 2.0 | Création Excel |
| **[calamine](https://github.com/tafia/calamine)** | XLSX/XLS/ODS read | MIT | Lecture rapide |
| **[shiva](https://docs.rs/shiva)** | Multi-format | MIT/Apache 2.0 | HTML, MD, PDF, RTF, DOCX, ODS, XLSX |

### Documents Alternatifs

| Crate | Fonction | Licence | Notes |
|-------|----------|---------|-------|
| **[rbook](https://github.com/DevinSterling/rbook)** | EPUB read | Apache 2.0 | WASM support |
| **[epub-builder](https://docs.rs/epub-builder)** | EPUB write | MPL 2.0 | Génération |
| **[comrak](https://github.com/kivikakk/comrak)** | Markdown CommonMark+GFM | MIT | Utilisé par crates.io, GitLab |
| **[markdown-rs](https://github.com/wooorm/markdown-rs)** | Markdown + MDX + Math | MIT | 100% safe, #![no_std] |
| **[rtf-parser](https://github.com/d0rianb/rtf-parser)** | RTF lexer/parser | MIT | Rapide, memory efficient |

### Collaboration Backend

| Crate | Fonction | Licence | Notes |
|-------|----------|---------|-------|
| **[yrs](https://crates.io/crates/yrs)** | Yjs Rust port | MIT | Déjà utilisé dans signapps-docs |
| **[lib0](https://crates.io/crates/lib0)** | Encoding pour Yjs | MIT | Déjà utilisé |

---

## PHASE 3: SCAMPER - Optimisation par Composant

### S - SUBSTITUTE (Substituer)

| ID | Idée | Détail |
|----|------|--------|
| S1 | **Remplacer Tiptap v2 → v3** | Migration obligatoire pour features modernes |
| S2 | **Remplacer `html-to-docx` JS → `docx-rust`** | Export DOCX natif Rust, plus rapide |
| S3 | **Remplacer `xlsx` JS → `rust_xlsxwriter`** | Export XLSX backend Rust |
| S4 | **Remplacer `mammoth` JS → `office2pdf` + parsing Rust** | Import DOCX backend |
| S5 | **TextStyleKit remplace extensions séparées** | FontFamily + FontSize + Color en un seul import |

### C - COMBINE (Combiner)

| ID | Idée | Détail |
|----|------|--------|
| C1 | **Service `signapps-office` unifié** | Combines docs/sheets/slides format processing |
| C2 | **PDF + Print combinés** | Export PDF = Print preview = même rendering |
| C3 | **Comments + Presence combinés** | Curseurs + commentaires dans même système temps réel |
| C4 | **Import/Export pipeline unifié** | Format detection → parsing → conversion → output |
| C5 | **shiva comme couche d'abstraction** | Un seul crate pour tous les formats |

### A - ADAPT (Adapter)

| ID | Idée | Détail |
|----|------|--------|
| A1 | **Adapter pattern Google Docs comments** | Implementation open-source `tiptap-comment-extension` |
| A2 | **Adapter Notion blocks → Tiptap nodes** | Block-based editing pour Docs |
| A3 | **Adapter Excel formulas → custom parser** | Engine de formules déjà existant, étendre |
| A4 | **Adapter Figma multiplayer → Slides** | Presence + curseurs sur canvas Fabric.js |
| A5 | **Adapter VS Code diff → Track Changes** | Diff algorithm pour suggestions |

### M - MODIFY (Modifier)

| ID | Idée | Détail |
|----|------|--------|
| M1 | **Modifier rendering pipeline** | Server-side rendering pour PDF, client-side pour preview |
| M2 | **Modifier storage** | Documents stockés en JSON + binaires séparés pour médias |
| M3 | **Modifier collaboration** | Yrs (Rust) pour backend, y-websocket pour frontend |
| M4 | **Modifier export flow** | Streaming export pour gros fichiers |
| M5 | **Modifier caching** | moka cache pour templates pré-compilés |

### P - PUT TO OTHER USES (Autres usages)

| ID | Idée | Détail |
|----|------|--------|
| P1 | **PDF viewer → annotation tool** | Réutiliser viewer pour annotations |
| P2 | **Slides canvas → diagrammes** | Fabric.js pour flowcharts, mindmaps |
| P3 | **Sheets engine → data analysis** | Formulas + charts pour dashboards |
| P4 | **Docs comments → review workflow** | Système de review/approval intégré |
| P5 | **EPUB export → documentation** | Générer docs produit en EPUB |

### E - ELIMINATE (Éliminer)

| ID | Idée | Détail |
|----|------|--------|
| E1 | **Éliminer dépendances JS lourdes** | mammoth, html-to-docx → Rust |
| E2 | **Éliminer conversions multiples** | Direct parsing sans intermédiaire HTML |
| E3 | **Éliminer round-trips réseau** | Process côté serveur quand possible |
| E4 | **Éliminer Tiptap Pro dependency** | Tout custom ou open-source |
| E5 | **Éliminer formats legacy** | Focus sur formats modernes (OOXML, ODF) |

### R - REVERSE (Inverser)

| ID | Idée | Détail |
|----|------|--------|
| R1 | **Export-first design** | Design formats autour de l'export, pas l'inverse |
| R2 | **Backend-first processing** | Rust fait le gros travail, JS affiche seulement |
| R3 | **Offline-first collaboration** | Sync quand connecté, travail local sinon |
| R4 | **Template-driven content** | Templates définissent structure, contenu remplit |
| R5 | **Pull vs Push collaboration** | Clients pull changes vs server push |

---

## PHASE 4: REVERSE BRAINSTORMING - Risques et Mitigations

### Comment faire échouer le projet ?

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Migration Tiptap v3 casse tout** | Critique | Tests exhaustifs, migration incrémentale |
| **Bibliothèques Rust immatures** | Élevé | Fallback vers libs établies, contribuer upstream |
| **Performance export PDF lente** | Moyen | Streaming, cache templates, workers |
| **Compatibilité Office imparfaite** | Élevé | Tests avec vrais fichiers Office, validation suite |
| **Collaboration conflicts** | Moyen | CRDTs robustes (Yrs), conflict resolution UI |
| **Memory leaks gros documents** | Élevé | Streaming parsing, lazy loading, pagination |
| **Complexité maintenance** | Moyen | Architecture modulaire, documentation |
| **Lock-in sur crates abandonnés** | Moyen | Préférer crates actifs, fork si nécessaire |

---

## IDÉES GÉNÉRÉES - Catalogue Complet

### Epic 1: Migration Tiptap v3 (15 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 1.1 | Uninstall all Tiptap v2, clean install v3 | P0 | M |
| 1.2 | Update imports BubbleMenu/FloatingMenu from `@tiptap/react/menus` | P0 | S |
| 1.3 | Set `immediatelyRender: false` for SSR (Next.js) | P0 | S |
| 1.4 | Set `shouldRerenderOnTransaction: true` in useEditor | P0 | S |
| 1.5 | Rename `history: false` → `undoRedo: false` in StarterKit | P0 | S |
| 1.6 | Update collaboration cursor CSS `.collaboration-cursor` → `.collaboration-carets` | P1 | S |
| 1.7 | Test `setContent(content, options)` signature change | P0 | M |
| 1.8 | Migrate vers TextStyleKit pour FontFamily/FontSize/Color | P1 | M |
| 1.9 | Activer Markdown input/output natif v3 | P2 | M |
| 1.10 | Implémenter Content Migrations pour schema changes | P2 | L |
| 1.11 | Utiliser Decorations API pour highlights custom | P2 | M |
| 1.12 | Tester CharacterCount extension v3 | P1 | S |
| 1.13 | Implémenter Mathematics extension (KaTeX) | P2 | M |
| 1.14 | Ajouter DragHandle extension pour blocks | P2 | M |
| 1.15 | Tester Typography extension pour smart quotes | P3 | S |

### Epic 2: Extensions Tiptap Custom (12 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 2.1 | Fork `tiptap-comment-extension` pour Comments | P1 | L |
| 2.2 | Adapter comments pour collaboration Yjs | P1 | L |
| 2.3 | Implémenter Track Changes comme marks custom | P1 | XL |
| 2.4 | Suggestion mode (accept/reject changes) | P1 | L |
| 2.5 | Comments sidebar component React | P1 | M |
| 2.6 | Thread resolution workflow | P2 | M |
| 2.7 | Mention system (@user) dans comments | P2 | M |
| 2.8 | Comments avec attachments (images) | P3 | M |
| 2.9 | Export comments vers JSON séparé | P2 | S |
| 2.10 | Import comments depuis DOCX | P2 | L |
| 2.11 | Diff view pour Track Changes | P2 | L |
| 2.12 | Comments notifications backend | P2 | M |

### Epic 3: Service Rust `signapps-office` (20 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 3.1 | Créer service `signapps-office` port 3010 | P0 | M |
| 3.2 | Endpoint `/api/v1/convert` format-agnostic | P0 | L |
| 3.3 | Intégrer `docx-rust` pour DOCX read/write | P0 | L |
| 3.4 | Intégrer `rust_xlsxwriter` pour XLSX write | P0 | L |
| 3.5 | Intégrer `calamine` pour XLSX/XLS/ODS read | P0 | M |
| 3.6 | Intégrer `krilla` ou `printpdf` pour PDF write | P0 | L |
| 3.7 | Intégrer `pdf_oxide` pour PDF read/extract | P1 | M |
| 3.8 | Intégrer `shiva` comme fallback multi-format | P1 | M |
| 3.9 | PPTX generation custom (OPC format) | P1 | XL |
| 3.10 | Template engine pour documents | P1 | L |
| 3.11 | Mail merge avec JSON data | P2 | L |
| 3.12 | Batch conversion endpoint | P2 | M |
| 3.13 | Streaming response pour gros fichiers | P1 | M |
| 3.14 | Conversion queue avec priorités | P2 | L |
| 3.15 | Format detection automatique | P1 | S |
| 3.16 | Validation format avant conversion | P1 | M |
| 3.17 | Métriques conversion (temps, taille) | P2 | S |
| 3.18 | Cache conversions fréquentes (moka) | P2 | M |
| 3.19 | Compression output (zip, gzip) | P2 | S |
| 3.20 | Watermark support PDF | P3 | M |

### Epic 4: PDF Features (15 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 4.1 | PDF Viewer component React (pdf.js wrapper) | P1 | L |
| 4.2 | PDF text extraction backend | P1 | M |
| 4.3 | PDF annotations overlay (highlights, notes) | P2 | L |
| 4.4 | PDF form filling | P2 | L |
| 4.5 | PDF signature support | P2 | L |
| 4.6 | PDF merge/split endpoint | P2 | M |
| 4.7 | PDF page reordering | P2 | M |
| 4.8 | PDF compression/optimization | P2 | M |
| 4.9 | PDF/A compliance pour archivage | P3 | L |
| 4.10 | OCR intégration (ocrs) pour scanned PDFs | P2 | L |
| 4.11 | PDF thumbnail generation | P2 | S |
| 4.12 | PDF print preview | P1 | M |
| 4.13 | PDF search in document | P2 | M |
| 4.14 | PDF bookmarks/outline | P3 | M |
| 4.15 | PDF accessibility (tags) | P3 | L |

### Epic 5: Sheets/Excel Integration (15 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 5.1 | Import XLSX vers grid existante | P0 | L |
| 5.2 | Export grid → XLSX complet | P0 | L |
| 5.3 | Préserver formules import/export | P1 | XL |
| 5.4 | Styles cells (fonts, colors, borders) | P1 | L |
| 5.5 | Conditional formatting | P2 | L |
| 5.6 | Charts export (PNG fallback) | P2 | L |
| 5.7 | Multiple sheets support | P1 | L |
| 5.8 | CSV/TSV import/export | P1 | S |
| 5.9 | ODS format support via calamine | P2 | M |
| 5.10 | Data validation rules | P2 | M |
| 5.11 | Pivot tables (simplified) | P3 | XL |
| 5.12 | Frozen rows/columns export | P2 | M |
| 5.13 | Cell comments export | P2 | M |
| 5.14 | Named ranges | P2 | M |
| 5.15 | Print areas | P2 | S |

### Epic 6: Slides/PowerPoint Integration (15 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 6.1 | Améliorer exportToPPTX() existant | P0 | M |
| 6.2 | Import PPTX → Fabric.js objects | P1 | XL |
| 6.3 | Master slides / templates | P1 | L |
| 6.4 | Slide transitions metadata | P2 | M |
| 6.5 | Animations export (basique) | P3 | L |
| 6.6 | Speaker notes | P1 | M |
| 6.7 | Export PNG/SVG par slide | P1 | S |
| 6.8 | PDF export multi-slides | P1 | M |
| 6.9 | ODP format support | P2 | L |
| 6.10 | Slide sorter view | P2 | M |
| 6.11 | Presenter mode | P2 | L |
| 6.12 | Embed videos metadata | P3 | M |
| 6.13 | SmartArt / diagrams | P3 | XL |
| 6.14 | Themes/color schemes | P2 | M |
| 6.15 | Grid/guides export | P3 | S |

### Epic 7: Formats Additionnels (15 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 7.1 | Markdown export depuis Docs | P1 | M |
| 7.2 | Markdown import vers Docs | P1 | M |
| 7.3 | HTML export clean | P1 | S |
| 7.4 | HTML import avec styles | P1 | M |
| 7.5 | RTF import/export via shiva | P2 | M |
| 7.6 | ODT import via shiva | P2 | M |
| 7.7 | ODT export | P2 | L |
| 7.8 | EPUB export pour Docs longs | P2 | L |
| 7.9 | EPUB import (rbook) | P3 | M |
| 7.10 | Plain text export | P1 | S |
| 7.11 | JSON document format (internal) | P1 | M |
| 7.12 | ZIP archives pour bundles | P2 | S |
| 7.13 | LaTeX export (math docs) | P3 | L |
| 7.14 | AsciiDoc export | P3 | M |
| 7.15 | reStructuredText export | P3 | M |

### Epic 8: Performance et Optimisation (15 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 8.1 | Lazy loading documents sections | P1 | L |
| 8.2 | Virtual scrolling gros docs | P1 | L |
| 8.3 | Web Workers pour parsing client | P1 | M |
| 8.4 | Streaming parsing backend | P1 | L |
| 8.5 | Incremental export (changements only) | P2 | L |
| 8.6 | Compression WASM (zstd) | P2 | M |
| 8.7 | Image optimization pipeline | P1 | M |
| 8.8 | Font subsetting pour PDF | P2 | L |
| 8.9 | Connection pooling conversions | P1 | S |
| 8.10 | Rate limiting endpoints | P1 | S |
| 8.11 | Batch operations API | P2 | M |
| 8.12 | Progress events SSE | P1 | M |
| 8.13 | Cancelable conversions | P2 | M |
| 8.14 | Memory-mapped files gros docs | P2 | L |
| 8.15 | Precompiled templates cache | P2 | M |

### Epic 9: Tests et Qualité (10 idées)

| # | Idée | Priorité | Effort |
|---|------|----------|--------|
| 9.1 | Test suite fichiers Office réels | P0 | L |
| 9.2 | Round-trip tests (import → export → import) | P0 | L |
| 9.3 | Visual regression tests exports | P1 | L |
| 9.4 | Performance benchmarks | P1 | M |
| 9.5 | Fuzzing input malformés | P1 | M |
| 9.6 | Integration tests API endpoints | P0 | M |
| 9.7 | E2E tests Playwright complets | P1 | L |
| 9.8 | Coverage formats supportés | P1 | S |
| 9.9 | Documentation API auto-générée | P2 | M |
| 9.10 | Changelog automatique | P2 | S |

---

## ARCHITECTURE PROPOSÉE

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                     │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   Docs      │   Sheets    │   Slides    │   PDF Viewer      │
│  (Tiptap v3)│  (Custom)   │ (Fabric.js) │   (pdf.js)        │
└──────┬──────┴──────┬──────┴──────┬──────┴────────┬──────────┘
       │             │             │               │
       ▼             ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                 signapps-collab (Yrs/Yjs)                   │
│              Real-time collaboration WebSocket               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                  signapps-office (NEW)                       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │  DOCX    │  XLSX    │  PPTX    │   PDF    │  Others  │   │
│  │docx-rust │xlsx-writer│ custom  │  krilla  │  shiva   │   │
│  │          │ calamine │         │ pdf_oxide │ comrak   │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                   signapps-storage                           │
│                 (OpenDAL: FS or S3)                          │
└─────────────────────────────────────────────────────────────┘
```

### Nouveau Service: signapps-office

```toml
# services/signapps-office/Cargo.toml
[package]
name = "signapps-office"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
axum = { version = "0.7", features = ["multipart"] }
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.5", features = ["cors", "trace"] }

# Document formats
docx-rust = "0.5"           # DOCX read/write
rust_xlsxwriter = "0.79"    # XLSX write
calamine = "0.26"           # XLSX/XLS/ODS read
shiva = { version = "1.4", features = ["all"] }  # Multi-format

# PDF
krilla = "0.4"              # PDF generation
pdf_oxide = "0.3"           # PDF extraction

# Markdown
comrak = "0.31"             # CommonMark + GFM

# EPUB
rbook = "0.5"               # EPUB read

# Utilities
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tempfile = "3"
bytes = "1"
mime_guess = "2"
moka = { version = "0.12", features = ["future"] }
tracing = "0.1"

# Workspace
signapps-common = { path = "../../crates/signapps-common" }
signapps-storage = { path = "../signapps-storage" }
```

---

## PLAN D'IMPLÉMENTATION RECOMMANDÉ

### Phase 1: Fondations (Sprint 1-2)
1. Migration Tiptap v2 → v3
2. Créer service signapps-office squelette
3. TextStyleKit (FontFamily, FontSize, Color)
4. CharacterCount extension

### Phase 2: Export Core (Sprint 3-4)
1. DOCX export backend (docx-rust)
2. XLSX export backend (rust_xlsxwriter)
3. PDF export backend (krilla)
4. API endpoints conversion

### Phase 3: Import Core (Sprint 5-6)
1. DOCX import (parsing vers Tiptap JSON)
2. XLSX import (calamine → grid)
3. PDF text extraction
4. Format detection automatique

### Phase 4: Features Pro DIY (Sprint 7-9)
1. Comments extension custom
2. Track Changes basics
3. Comments sync Yjs
4. Suggestions mode

### Phase 5: Formats Secondaires (Sprint 10-11)
1. Markdown import/export
2. HTML import/export
3. RTF via shiva
4. ODT/ODS via shiva

### Phase 6: PDF Avancé (Sprint 12-13)
1. PDF Viewer component
2. PDF annotations
3. PDF merge/split
4. OCR integration

### Phase 7: Polish (Sprint 14-15)
1. EPUB support
2. Performance optimizations
3. Tests exhaustifs
4. Documentation

---

## DÉCISIONS CLÉS

| Décision | Choix | Justification |
|----------|-------|---------------|
| PDF Generation | krilla | API ergonomique, MIT/Apache 2.0, actif |
| DOCX | docx-rust | Read/write complet, MIT |
| XLSX Write | rust_xlsxwriter | Fonctionnalités complètes, actif |
| XLSX Read | calamine | Rapide, supporte XLS/ODS aussi |
| Multi-format fallback | shiva | Couvre RTF, ODS, HTML, MD |
| Markdown | comrak | Standard industrie (crates.io, GitLab) |
| Comments | Fork tiptap-comment-extension | Open-source, adaptable |
| Collaboration | yrs (existant) | Déjà intégré, robuste |

---

## Sources

### PDF
- [krilla](https://github.com/LaurenzV/krilla) - High-level PDF generation
- [pdf_oxide](https://crates.io/crates/pdf_oxide) - Fast PDF extraction
- [lopdf](https://github.com/J-F-Liu/lopdf) - PDF manipulation

### Office
- [office2pdf](https://lib.rs/crates/office2pdf) - Pure Rust DOCX/XLSX/PPTX to PDF
- [docx-rust](https://crates.io/crates/docx-rust) - DOCX read/write
- [rust_xlsxwriter](https://github.com/jmcnamara/rust_xlsxwriter) - XLSX creation
- [calamine](https://github.com/tafia/calamine) - Excel/ODS reader

### Multi-format
- [shiva](https://docs.rs/shiva) - Multi-format conversion

### Markdown
- [comrak](https://github.com/kivikakk/comrak) - CommonMark + GFM

### EPUB
- [rbook](https://github.com/DevinSterling/rbook) - EPUB reader

### Tiptap
- [Tiptap v3 Migration Guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)
- [What's new in Tiptap V3](https://tiptap.dev/docs/resources/whats-new)
- [FontFamily Extension](https://tiptap.dev/docs/editor/extensions/functionality/fontfamily)
- [TextStyleKit Extension](https://tiptap.dev/docs/editor/extensions/functionality/text-style-kit)
- [tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension) - Community comments

---

*Session générée automatiquement avec BMAD Method v6.0.4*
