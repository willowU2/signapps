---
name: wiki-debug
description: Use when debugging the Wiki (knowledge base) module. Spec at docs/product-specs/13-wiki.md. Frontend minimal (1 page, 2 components — sidebar + page editor). Uses the same Tiptap editor as Docs. Backend likely shares signapps-docs. 0 data-testids, 0 E2E tests. Wiki is essentially "Docs with hierarchical navigation + search + versioning".
---

# Wiki — Debug Skill

## Source of truth
**`docs/product-specs/13-wiki.md`**

## Code map
- **Backend**: Likely `services/signapps-docs/` (port 3010) — wiki pages are a variant of docs with hierarchy
- **Frontend**: `client/src/app/wiki/` (1 page), `client/src/components/wiki/` (2 components: sidebar + page)
- **Editor**: Tiptap (same as Docs) — see `docs-editor-debug` skill for Tiptap-specific patterns
- **E2E**: 0 tests, 0 data-testids, no Page Object

## Key data-testids to add
`wiki-root`, `wiki-sidebar`, `wiki-page-tree`, `wiki-page-item-{id}`, `wiki-new-page-button`, `wiki-page-editor`, `wiki-page-title`, `wiki-breadcrumb`, `wiki-search-input`, `wiki-page-history-button`

## Key journeys to test
1. Navigate sidebar → select a page → content loads
2. Create new page → appears in tree
3. Edit page content → auto-save
4. Search wiki → find page by content
5. View page history → restore previous version

## Common bug patterns (anticipated)
1. **Page tree doesn't update after create** — sidebar query cache stale
2. **Circular parent reference** — a page can't be its own ancestor
3. **Tiptap content lost on fast navigation** — unmount before debounced save fires
4. **Search indexing lag** — new page not searchable immediately
5. **Shared Tiptap extensions conflict** — wiki may need different extension set than Docs

## Dependencies
Same as Docs: **Tiptap** (MIT), **Yjs** (MIT), **prosemirror-*** (MIT)

## Historique
- **2026-04-09** : Skill créé. 1 page + 2 composants (minimal — wiki may be early stage), 0 E2E, 0 testids.
