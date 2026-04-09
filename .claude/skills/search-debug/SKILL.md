---
name: search-debug
description: Debug skill for the Search module (omni-search + semantic search). Cross-service full-text and vector search via pgvector. No dedicated backend — leverages signapps-db VectorRepository.
---

# Search — Debug Skill

## Source of truth

**`docs/product-specs/29-search.md`** — read spec first.

## Code map

### Backend
- **No dedicated service** — search endpoints in `signapps-gateway` (3099) or per-service
- **Vector search**: `crates/signapps-db/` — `VectorRepository` (384d), `MultimodalVectorRepository` (1024d)
- **Full-text**: PostgreSQL `tsvector` / `tsquery` on relevant tables
- **AI embeddings**: via `signapps-ai` port 3005

### Frontend (Next.js)
- **Search bar**: `client/src/components/search/` (global omni-search in header)
- **Results page**: `client/src/app/search/page.tsx`
- **API client**: `client/src/lib/api/search.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `search-input` | Global search input |
| `search-results-root` | Results container |
| `search-result-{id}` | Individual result item |
| `search-filter-type` | Filter by content type |
| `search-filter-date` | Filter by date range |
| `search-semantic-toggle` | Toggle semantic search |

## Key E2E journeys

1. **Basic text search** — type query, verify results from multiple modules
2. **Semantic search** — toggle semantic, search concept not exact words, verify relevant results
3. **Filter by type** — search, filter to "documents only", verify filtered results
4. **Click-through** — click a result, verify navigation to correct module/item

## Common bug patterns

1. **Index staleness** — new content not searchable until next indexing cycle
2. **Cross-service auth** — search returns items user cannot access (permission leak)
3. **Embedding dimension mismatch** — 384d vs 1024d vectors queried against wrong index

## Dependencies (license check)

- **pgvector** — PostgreSQL extension, open-source (PostgreSQL license)
- **Backend**: sqlx, signapps-db — MIT/Apache-2.0
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
