# Module Search (Global Search) -- Functional Specification

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Workspace Search** | Recherche unifiee cross-app (Gmail, Drive, Calendar, Contacts, Chat), chips de filtres contextuels, suggestions autocomplete, resultats classes par pertinence + recence, Knowledge Graph cards, search operators (from:, to:, has:, is:, after:, before:) |
| **Microsoft 365 Search** | Microsoft Search unifie (SharePoint, OneDrive, Outlook, Teams), Copilot integre, bookmarks admin, Q&A cards, acronyms, people cards, org chart, topic cards, custom verticals |
| **Elasticsearch** | Full-text search distribue, analyzers custom (stemming, synonymes, n-grams), fuzzy matching, aggregations facettees, boosting par champ, highlighting, suggest (did-you-mean), relevance tuning |
| **Algolia** | Typo-tolerance instantanee, faceted search, filters, InstantSearch UI components, analytics (clicks, conversions), A/B testing relevance, synonymes, regles personnalisees, geo-search |
| **MeiliSearch** | Search-as-you-type ultra-rapide (< 50ms), typo-tolerance integree, faceted filters, highlighting, multi-index search, tenant tokens, auto-batching |
| **Typesense** | Typo-tolerance native, faceted search, geo-search, curation (pins/hides), synonymes, vector search hybride, groupage de resultats, scoped API keys |
| **Notion Search** | Recherche full-text dans les pages/databases, filtres par espace/createur/date, sort par pertinence/date, quick search (Ctrl+K), search in page (Ctrl+F), AI search avec resume |
| **Slack Search** | Filtres contextuels (in:channel, from:user, has:link, during:, before:, after:), resultats par type (messages, fichiers, channels), search modifiers, saved searches, search history |
| **Confluence Search** | Recherche dans les espaces/pages/blogs, filtres par espace/label/auteur/date, CQL (Confluence Query Language), macros de recherche, content by label |
| **Coveo** | Relevance cloud, machine learning rankings, query suggestions, facets dynamiques, analytics avancees, unified index multi-source, personalized results |
| **Apache Solr** | Full-text search, faceted search, highlighting, spell-check, more-like-this, spatial search, join queries, streaming expressions |
| **Qdrant** | Recherche vectorielle pure, filtrage payload, hybrid search (sparse + dense vectors), multi-tenancy, quantization, recommendations |

## Principes directeurs

1. **Universal search, one field** -- a single search bar (`Ctrl+K` / `Cmd+K`) queries all modules simultaneously (Documents, Emails, Contacts, Events, Files, Tasks, Chat, Wiki). The user does not choose where to search; they search.
2. **Two complementary modes** -- standard search (full-text, exact, fast) and semantic search (vector-based, meaning-aware) coexist as tabs. Standard is the default; semantic is one click away.
3. **Instant results** -- search-as-you-type with results displayed in < 200ms. No blank screen between keystrokes. Debounce at 200ms to avoid overloading the backend.
4. **Progressive filters** -- filters appear after the first search, contextualised to the results (type, date, author, module). No complex form to fill before searching.
5. **Save and reuse** -- frequent searches are saved as shortcuts. Search history is accessible and deletable.
6. **Learned relevance** -- clicks on results feed a relevance signal. Results most-clicked for a given query rise progressively.

---

## Category 1 -- Command Palette (Ctrl+K / Cmd+K)

### 1.1 Global keyboard shortcut
`Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS) opens a centered modal search bar (Spotlight/Alfred style). Available from any page of SignApps, including inside the editor, calendar, mail, and settings. Pressing the shortcut again while the palette is open focuses the input. `Escape` closes the palette. Clicking outside the modal also closes it. The overlay uses `bg-black/50` backdrop with `transition-opacity duration-150`.

### 1.2 Fuzzy matching engine
The input field supports fuzzy matching: typing `metnig` matches "meeting". The fuzzy algorithm uses trigram similarity (`pg_trgm`) for candidate generation and Levenshtein distance for ranking. Fuzzy tolerance is capped at edit distance 2 for queries under 8 characters and edit distance 3 for longer queries. Results with exact prefix match are always ranked above fuzzy matches.

### 1.3 Search scopes
Below the input, a row of scope pills: **All** (default), **Files**, **Docs**, **Mail**, **Contacts**, **Tasks**, **Calendar**, **Chat**. Clicking a pill restricts results to that module. Keyboard shortcut: `Tab` cycles through scopes; `Shift+Tab` cycles backward. The active scope pill is highlighted with `bg-primary text-primary-foreground`. The scope is reflected in the URL query param `?scope=mail` so it persists on page reload.

### 1.4 Real-time suggestions with debounce
As the user types, suggestions appear below the input after a 200ms debounce. Each keystroke resets the debounce timer. While waiting, a subtle shimmer skeleton (3 rows) is shown. If the backend responds in < 200ms, the skeleton never appears. Suggestions are grouped into sections: **Recent Searches** (clock icon), **Contacts** (person icon), **Documents** (file icon), **Emails** (envelope icon), **Events** (calendar icon), **Tasks** (checkbox icon), **Chat messages** (bubble icon). Maximum 3 results per section in the dropdown, with a "See all N results" link per section.

### 1.5 Result cards per type
Each suggestion card displays type-specific information:
- **Document**: icon (Word/PDF/Sheet), title with highlight, last modified date, owner avatar
- **Email**: envelope icon, subject with highlight, sender name, date, snippet of body
- **Contact**: avatar, full name with highlight, email, company
- **Event**: calendar icon, title with highlight, date/time, location
- **Task**: checkbox icon (checked/unchecked), title with highlight, assignee avatar, due date
- **File**: file-type icon, filename with highlight, size, folder path
- **Chat message**: bubble icon, message snippet with highlight, channel name, sender, timestamp

### 1.6 Recent searches history
Clicking the input when empty displays the 10 most recent searches with timestamps ("2 minutes ago", "yesterday"). Each entry has a delete button (trash icon, `opacity-0 group-hover:opacity-100`). A "Clear all history" link at the bottom. History is stored per-user in the `search_history` table. Pressing `ArrowDown` from the empty input navigates into the recent searches list.

### 1.7 Keyboard navigation in results
- `ArrowDown` / `ArrowUp`: move selection highlight through results (wraps around)
- `Enter`: open the selected result (navigates to the item's page)
- `Tab`: jump to the next section header
- `Shift+Tab`: jump to the previous section header
- `Ctrl+Enter`: open the selected result in a new browser tab
- `Escape`: clear the input if non-empty; close the palette if input is empty
- The selected item has `bg-accent` background. Focus is managed via `aria-activedescendant` for screen reader compatibility.

### 1.8 Command actions in palette
Beyond search, the palette supports command actions prefixed with `>`:
- `> Create document` -- opens new document editor
- `> Create event` -- opens calendar event creation dialog
- `> Settings` -- navigates to settings page
- `> Dark mode` -- toggles dark mode
Commands are filterable and extensible via a registry. They appear in a separate "Actions" section with a lightning bolt icon.

---

## Category 2 -- Standard Search (Full-Text)

### 2.1 Standard search tab
First tab on the results page (`/search?q=term&mode=standard`). Full-text search based on exact term matching with tokenization, stemming (French `french` + English `english` dictionaries), and stop word removal. Powered by PostgreSQL `tsvector` / `tsquery` with GIN indexes.

### 2.2 Highlighting in results
Searched terms are highlighted with `<mark class="bg-yellow-200 dark:bg-yellow-800">` in the title and body snippet. The snippet shows the most relevant passage (2-3 lines around the matched term), extracted via `ts_headline()` with `StartSel`, `StopSel`, `MaxWords=35`, `MinWords=15`.

### 2.3 Relevance ranking algorithm
Score is computed as a weighted sum:
- **Title exact match**: boost x5 (via `setweight(to_tsvector(title), 'A')`)
- **Title partial match**: boost x3
- **Body match**: boost x1 (weight 'B')
- **Metadata match** (tags, labels): boost x0.5 (weight 'C')
- **Recency bonus**: `log(1 + 1 / (days_since_modified + 1))` multiplied by 0.3
- **Popularity bonus**: `log(1 + view_count) * 0.1`
- **Click signal**: results previously clicked for this query get `+0.5` per click, capped at `+3.0`
Final score: `ts_rank_cd(document, query, 32) * title_boost + recency + popularity + click_signal`. Results with score below 0.01 are excluded.

### 2.4 Exact phrase search
Wrapping terms in double quotes forces phrase matching: `"quarterly report Q1"` only returns documents containing that exact phrase in order. Implemented via `phraseto_tsquery()` in PostgreSQL.

### 2.5 Boolean operators
`AND`, `OR`, `NOT` supported: `budget AND 2026 NOT draft`. Parentheses for grouping: `(budget OR forecast) AND Q1`. By default, multiple terms are combined with implicit AND. The query parser translates these into `tsquery` operators (`&`, `|`, `!`).

### 2.6 Wildcard search
`budget*` matches "budget", "budgets", "budgetaire". `*port` matches "rapport", "transport". Prefix wildcards are more expensive; a warning toast appears if the query takes > 2s: "Prefix wildcard search may be slow. Consider rephrasing." Implemented via `to_tsquery('budget:*')`.

### 2.7 Spelling correction (did-you-mean)
If zero or fewer than 3 results are found, the system suggests "Did you mean: [corrected term]?". Based on trigram similarity (`pg_trgm`) against the dictionary of indexed terms. The suggestion with the highest `similarity()` score above 0.3 is shown. Clicking the suggestion re-runs the search with the corrected term.

### 2.8 Synonyms and abbreviations
Admin-configurable synonym table: `HR` = `Human Resources`, `CA` = `Revenue`, `GDPR` = `RGPD`. Searching "HR" also returns documents containing "Human Resources". Synonyms are expanded at query time (not at index time) to allow dynamic updates without full re-indexation. Admin UI: table with columns (term, synonyms CSV, created_at). Import/export CSV.

---

## Category 3 -- Semantic Search (Vector-Based)

### 3.1 Semantic search tab
Second tab on the results page (`/search?q=term&mode=semantic`). Uses embedding similarity rather than text matching. Allows finding relevant documents even without exact keywords.

### 3.2 Natural language queries
The user types a question or description: "company remote work policy" returns documents about the topic even if they contain different words (e.g., "telework charter", "work from home guidelines"). The query text is embedded via `signapps-ai` (port 3005) using the same model as document embeddings.

### 3.3 Pre-computed embeddings
Every document, email, contact, and event is vectorized at indexation via `signapps-ai` (port 3005). Embeddings are stored in pgvector: 384 dimensions for text (`VectorRepository` in `signapps-db`), 1024 dimensions for multimodal content (`MultimodalVectorRepository`). Re-vectorization is incremental on each modification. Embedding generation is asynchronous (PgEventBus triggers a worker).

### 3.4 Hybrid search (full-text + vector)
"Hybrid" option that combines full-text scores and vector similarity with configurable weighting (default: 60% semantic, 40% full-text). Implementation: run both queries in parallel, normalize scores to [0,1], then `final_score = 0.6 * cosine_sim + 0.4 * ts_rank_normalized`. Better precision than either method alone.

### 3.5 Document similarity (more-like-this)
From any result, a "Find similar documents" button. Uses the document's embedding as the query vector to find the N nearest documents in vector space. Implemented via `ORDER BY embedding <=> $1 LIMIT 10` (pgvector cosine distance operator).

### 3.6 Confidence score display
Each semantic result displays a similarity score (0-100%) so the user can assess relevance. Results below a configurable threshold (default: < 30%) are hidden. The score badge uses color coding: green (>70%), yellow (40-70%), gray (<40%).

### 3.7 Semantic search scope control
Semantic search respects the same scope pills as standard search. When scoped to "Mail", only email embeddings are queried. The vector query adds a `WHERE content_type = 'email'` filter before the nearest-neighbor lookup, using pgvector's filtered search.

---

## Category 4 -- Search Operators

### 4.1 Operator syntax
Advanced syntax recognized in the search bar:
- `from:alice` -- filter by author/sender name
- `in:mail` / `in:docs` / `in:drive` / `in:calendar` / `in:tasks` / `in:chat` -- filter by module
- `type:pdf` / `type:docx` / `type:xlsx` / `type:image` -- filter by file type
- `after:2026-01-01` -- results created/modified after date
- `before:2026-04-01` -- results created/modified before date
- `has:attachment` -- only results with attachments
- `is:unread` -- only unread emails
- `label:urgent` -- filter by label/tag
- `tag:project-alpha` -- filter by tag
- `assigned:bob` -- tasks assigned to bob
Operators are parsed client-side before the query is sent. Unrecognized operators are treated as plain text.

### 4.2 Operator autocompletion
When the user types a recognized prefix (e.g., `from:`), a dropdown appears showing matching values (user names for `from:`, module names for `in:`, file types for `type:`, etc.). The dropdown supports keyboard navigation. Each operator has a help tooltip: "from: -- Filter by author or sender".

### 4.3 Operator combination
Multiple operators combine with AND: `from:alice in:mail after:2026-01-01` returns emails from Alice after Jan 1, 2026. Operators and free-text combine: `budget from:alice type:pdf` searches for "budget" in PDFs authored by Alice.

---

## Category 5 -- Filters and Facets

### 5.1 Side filter panel
Left panel on the results page with facets: Content Type, Source Module, Creation Date, Modification Date, Author/Owner, Tags/Labels, Status. Each facet displays a result counter. The panel is collapsible (toggle arrow at top). On mobile, filters open as a bottom sheet.

### 5.2 Content type filter
Checkboxes: Documents (Word, Excel, PDF, etc.), Emails, Contacts, Events, Tasks, Files (images, videos, archives), Chat Messages, Wiki Pages. Multi-selection. Counters update in real time as filters change. Unchecking all is equivalent to "All types".

### 5.3 Date filter
Predefined ranges: Today, This Week, This Month, This Quarter, This Year, Custom (date picker start/end). Applicable to creation date or last modification date (toggle). The date picker uses the shadcn Calendar component. Custom range validates that start <= end.

### 5.4 Author filter
Field with autocomplete on organization users. Multi-selection. Displays avatar and full name. Typing filters the list. Maximum 5 selected authors displayed as chips; overflow shows "+N more".

### 5.5 Tags/labels filter
Selection from existing tags (autocomplete). Tags come from module sources (Gmail-style labels, Drive tags, Calendar categories). Multi-selection with colored chips matching the tag color.

### 5.6 Combined filters
All filters combine with AND. Active filter state is displayed as removable chips above the results: "Type: Email x | Author: Alice x | After: 2026-01-01 x". Click the `x` on a chip to remove it. "Reset all filters" button clears everything. Filter state is persisted in URL query params (`?type=email&author=alice&after=2026-01-01`).

### 5.7 Dynamic facet counters
Facet counters recalculate based on already-applied filters. If "Type: Email" is active, the Author facet counters reflect only emails. Counters showing 0 are grayed out but still clickable (they would return 0 results -- shown as dimmed). Implemented via PostgreSQL `GROUP BY` with `COUNT` on the filtered result set.

### 5.8 Saved filter presets
Users can save a combination of filters as a named preset ("My team's docs this quarter"). Presets appear in a dropdown at the top of the filter panel. Admin can create organization-wide presets.

---

## Category 6 -- Results Display

### 6.1 Unified result list
Results are displayed in a vertical list. Each result card shows: type icon (colored by module), title (with highlighting), source module badge (`bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs`), body snippet (with highlighting), author avatar + name, date, file size (for files). Cards have `hover:bg-accent` transition and `border-b border-border` separator.

### 6.2 Inline preview panel
Clicking the chevron `>` on the right side of a result (or pressing `ArrowRight` when a result is selected) opens a preview panel on the right (40% width) without leaving the results page. Preview content:
- **Documents**: rendered content (first 2 pages)
- **Emails**: subject + body + attachments list
- **Contacts**: full contact card
- **Events**: event details with participants
- **Files**: image preview, PDF first page, or file metadata
The panel has a close button and keyboard shortcut `Escape` to dismiss.

### 6.3 Sort options
Dropdown at the top of results: Relevance (default), Date (newest first), Date (oldest first), Name (A-Z), Size (largest first). Sort choice persists for the session. Keyboard shortcut: none (mouse-only interaction).

### 6.4 Pagination and infinite scroll
Default: infinite scroll loading 20 results per batch. Scroll sentinel at the bottom triggers the next batch load. A "Loading more..." spinner appears during fetch. Option to toggle to classic pagination (20 results per page with page numbers) via a toggle in the footer. Total result count displayed: "About 1,234 results".

### 6.5 Grouped-by-module view
Alternative display mode: results grouped by module (Documents section, Emails section, Contacts section, etc.) with a "See all N results" link per section. Each section shows the top 3 results. Toggle between "All results" and "By module" views via segmented control above the results. Keyboard shortcut: `Ctrl+G` toggles views.

### 6.6 Result actions
Right-click context menu (or `...` button) on each result:
- Open
- Open in new tab
- Copy link
- Share (opens share dialog)
- Download (for files)
- Add to favorites
- Add to collection
- Find similar (triggers semantic similarity search)
Actions are permission-aware: "Download" only appears if the user has download rights.

### 6.7 Zero results state
If no results: message "No results for [query]" with suggestions:
- Spelling correction ("Did you mean: [term]?")
- Alternative queries ("Try searching for: ...")
- Switch mode suggestion ("Try semantic search" if currently on standard, and vice versa)
- Remove filters suggestion ("Try removing some filters")
Illustration: empty search icon (magnifying glass with X).

### 6.8 Error states
- **Network error**: "Search is temporarily unavailable. Please try again." with a retry button.
- **Timeout** (> 10s): "This search is taking longer than expected. Try a more specific query."
- **Rate limited**: "Too many searches. Please wait a moment." (429 status)
All error states use the `bg-destructive/10 text-destructive` alert style.

---

## Category 7 -- Saved Searches and Collections

### 7.1 Save a search
"Save this search" button (bookmark icon) at the top of the results page. Opens a dialog: name (text input, auto-filled with the query), optional description. The saved search preserves: query text, filters, mode (standard/semantic), sort order.

### 7.2 Saved searches list
Accessible from the sidebar menu under "Saved Searches" or from the user menu. Displays: name, query, current result count (dynamic, refreshed on load), creation date, last-used date. Click to re-execute. Swipe-to-delete on mobile, delete icon on desktop.

### 7.3 Search alerts
Option on a saved search: "Alert me when new results appear". Runs the search daily (configurable: hourly, daily, weekly) and sends a notification (push + email) when the result count increases. The notification includes: "3 new results for [saved search name]" with a link. Alert frequency is configurable per saved search.

### 7.4 Result collections
Create a named collection and add search results manually. A collection is like a folder of bookmarks. Use case: build a thematic dossier ("Q1 Competitive Intelligence", "Project Alpha Documents"). Collections are shareable with team members.

### 7.5 Search sharing
Generate a link to a search (query + filters). The recipient sees results filtered by their own permissions (no privilege escalation). URL format: `/search?q=budget&type=pdf&after=2026-01-01&shared=true`. The link is copyable to clipboard with a toast confirmation.

---

## Category 8 -- Indexing Pipeline

### 8.1 Real-time incremental indexing
Every create/update/delete in any module triggers an asynchronous re-indexing via PgEventBus. The new content is searchable within < 5 seconds of the modification. Events consumed:
- `document.created`, `document.updated`, `document.deleted`
- `email.received`, `email.sent`, `email.deleted`
- `contact.created`, `contact.updated`, `contact.deleted`
- `event.created`, `event.updated`, `event.deleted`
- `task.created`, `task.updated`, `task.deleted`
- `file.uploaded`, `file.renamed`, `file.deleted`
- `chat.message.sent`, `chat.message.deleted`

### 8.2 Full-text index (PostgreSQL GIN)
`tsvector` column on the `search_index` table with GIN index. Dictionaries configured: `french` and `english` (auto-detected by language field). Field weights: title = 'A', body = 'B', metadata (tags, labels, author name) = 'C'. The `tsvector` is computed via a trigger on INSERT/UPDATE. Index rebuild: `REINDEX INDEX CONCURRENTLY idx_search_index_fts`.

### 8.3 Vector index (pgvector)
Embeddings stored in `search_index.embedding` (vector(384)) and `search_index.embedding_multimodal` (vector(1024)). Index type: HNSW for datasets > 100k rows (`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`), IVFFlat for smaller datasets. Re-vectorization is handled by a dedicated worker that listens to PgEventBus events and calls `signapps-ai` for embedding generation.

### 8.4 Indexing worker architecture
The indexing worker runs inside `signapps-gateway` (port 3099) as a background Tokio task. It:
1. Listens to PgEventBus events matching `*.created`, `*.updated`, `*.deleted`
2. For create/update: fetches the full content from the source module's repository
3. Computes `tsvector` for full-text
4. Calls `signapps-ai` REST API `POST /api/v1/embeddings` for vector embedding
5. Upserts into `search_index` table
6. For delete: removes the row from `search_index`
Batch processing: events are buffered for 500ms and processed in batch (up to 50 items per batch) for efficiency.

### 8.5 Trigram index for fuzzy search
Extension `pg_trgm` enabled. GIN index on `search_index.title` using `gin_trgm_ops`. Used for fuzzy matching and "did you mean" suggestions. Query: `SELECT DISTINCT title FROM search_index WHERE similarity(title, $1) > 0.3 ORDER BY similarity(title, $1) DESC LIMIT 5`.

---

## Category 9 -- Search Administration

### 9.1 Search statistics dashboard (admin)
Admin panel showing:
- Top 50 queries (by frequency, this week/month)
- Zero-hit queries (queries returning 0 results) -- action items for content gaps
- Click-through rate per result position
- Average response time (p50, p95, p99)
- Search volume per day (bar chart, last 30 days)
- Module distribution (pie chart: 40% docs, 25% mail, etc.)

### 9.2 Synonym management (admin)
Admin interface for adding/editing/deleting synonyms. Table with columns: Term, Synonyms (comma-separated), Created At, Updated By. Apply immediately without full re-indexation (expansion at query time). Import/export CSV. Bulk operations: select multiple rows, delete selected.

### 9.3 Weight and boosting configuration (admin)
Configure per-module weights: Documents x2, Emails x1, Chat x0.5. Configure per-field weights: title x5, body x1, metadata x0.5. Slider interface with live preview showing sample query results with old vs new ranking. Changes take effect immediately (weights applied at query time).

### 9.4 Permission-aware filtering
Search results are filtered by the connected user's permissions. A document shared only with Alice does not appear in Bob's results. Filtering is applied at the query level (not post-filter) via a `WHERE` clause joining on permission tables. Implementation: `INNER JOIN resource_permissions rp ON si.resource_id = rp.resource_id AND (rp.user_id = $current_user OR rp.is_public = true OR rp.org_id = $current_org)`.

### 9.5 Content exclusion rules
Admin can exclude specific content from search: by module (disable chat indexing), by tag (exclude "draft" tagged items), by classification ("Secret" documents are not indexed). Rules are evaluated at indexation time; excluded content is not added to `search_index`.

### 9.6 Index health monitoring
Dashboard widget showing: total indexed items, items pending indexation, indexation lag (time since oldest pending event), index size on disk, last full reindex date. Alert if indexation lag exceeds 1 minute.

---

## Category 10 -- PostgreSQL Schema

### 10.1 search_index table
```sql
CREATE TABLE search_index (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     UUID NOT NULL,
    resource_type   TEXT NOT NULL,  -- 'document', 'email', 'contact', 'event', 'task', 'file', 'chat_message'
    org_id          UUID NOT NULL REFERENCES organizations(id),
    owner_id        UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}',  -- tags, labels, file_type, etc.
    language        TEXT NOT NULL DEFAULT 'french',
    fts_vector      TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector(language::regconfig, title), 'A') ||
        setweight(to_tsvector(language::regconfig, body), 'B') ||
        setweight(to_tsvector(language::regconfig, COALESCE(metadata->>'tags', '')), 'C')
    ) STORED,
    embedding       VECTOR(384),       -- text embedding from signapps-ai
    embedding_multimodal VECTOR(1024),  -- multimodal embedding (images, etc.)
    view_count      INTEGER NOT NULL DEFAULT 0,
    click_count     INTEGER NOT NULL DEFAULT 0,
    is_public       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_index_fts ON search_index USING GIN (fts_vector);
CREATE INDEX idx_search_index_trgm ON search_index USING GIN (title gin_trgm_ops);
CREATE INDEX idx_search_index_embedding ON search_index USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
CREATE INDEX idx_search_index_type ON search_index (resource_type);
CREATE INDEX idx_search_index_org ON search_index (org_id);
CREATE INDEX idx_search_index_owner ON search_index (owner_id);
CREATE INDEX idx_search_index_created ON search_index (created_at DESC);
CREATE INDEX idx_search_index_updated ON search_index (updated_at DESC);
```

### 10.2 search_history table
```sql
CREATE TABLE search_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query       TEXT NOT NULL,
    scope       TEXT,  -- null = all, 'docs', 'mail', etc.
    mode        TEXT NOT NULL DEFAULT 'standard',  -- 'standard', 'semantic', 'hybrid'
    filters     JSONB NOT NULL DEFAULT '{}',
    result_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_history_user ON search_history (user_id, created_at DESC);
```

### 10.3 saved_searches table
```sql
CREATE TABLE saved_searches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES organizations(id),
    name        TEXT NOT NULL,
    description TEXT,
    query       TEXT NOT NULL,
    scope       TEXT,
    mode        TEXT NOT NULL DEFAULT 'standard',
    filters     JSONB NOT NULL DEFAULT '{}',
    sort_by     TEXT NOT NULL DEFAULT 'relevance',
    alert_enabled   BOOLEAN NOT NULL DEFAULT false,
    alert_frequency TEXT DEFAULT 'daily',  -- 'hourly', 'daily', 'weekly'
    last_result_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON saved_searches (user_id);
CREATE INDEX idx_saved_searches_alert ON saved_searches (alert_enabled) WHERE alert_enabled = true;
```

### 10.4 search_click_signals table
```sql
CREATE TABLE search_click_signals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_hash  TEXT NOT NULL,  -- SHA-256 of normalized query
    resource_id UUID NOT NULL,
    position    INTEGER NOT NULL,  -- position in result list when clicked
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_click_signals_query ON search_click_signals (query_hash, resource_id);
```

### 10.5 search_synonyms table
```sql
CREATE TABLE search_synonyms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id),
    term        TEXT NOT NULL,
    synonyms    TEXT[] NOT NULL,  -- array of synonym strings
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, term)
);
```

### 10.6 search_collections table
```sql
CREATE TABLE search_collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES organizations(id),
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE search_collection_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   UUID NOT NULL REFERENCES search_collections(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL,
    resource_type   TEXT NOT NULL,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collection_items ON search_collection_items (collection_id);
```

---

## Category 11 -- REST API Endpoints

### 11.1 Search query
```
GET /api/v1/search
Query params: q (string, required), scope (string), mode (standard|semantic|hybrid),
              page (int), per_page (int, default 20), sort (relevance|date_desc|date_asc|name|size),
              type (string[]), author (uuid[]), after (date), before (date), tag (string[])
Response 200: { results: SearchResult[], total: number, page: number, facets: Facets }
Response 400: { error: "Query too short (min 1 char)" }
Response 429: { error: "Rate limit exceeded" }
Auth: Bearer JWT required. Results filtered by user permissions.
```

### 11.2 Search suggestions (typeahead)
```
GET /api/v1/search/suggest
Query params: q (string, required, min 1 char), scope (string), limit (int, default 15)
Response 200: { suggestions: GroupedSuggestion[] }
Debounce: client-side 200ms. Server response target: < 100ms.
Auth: Bearer JWT required.
```

### 11.3 Search history
```
GET    /api/v1/search/history          -- list recent searches (limit 10)
DELETE /api/v1/search/history           -- clear all history
DELETE /api/v1/search/history/:id       -- delete one entry
Auth: Bearer JWT required. User can only access own history.
```

### 11.4 Saved searches CRUD
```
GET    /api/v1/search/saved             -- list saved searches
POST   /api/v1/search/saved             -- create saved search { name, query, scope, mode, filters, sort_by }
PUT    /api/v1/search/saved/:id         -- update saved search
DELETE /api/v1/search/saved/:id         -- delete saved search
PATCH  /api/v1/search/saved/:id/alert   -- toggle alert { enabled: bool, frequency: string }
Auth: Bearer JWT required. User can only manage own saved searches.
```

### 11.5 Collections CRUD
```
GET    /api/v1/search/collections                   -- list collections
POST   /api/v1/search/collections                   -- create { name, description }
PUT    /api/v1/search/collections/:id               -- update { name, description }
DELETE /api/v1/search/collections/:id               -- delete collection
POST   /api/v1/search/collections/:id/items         -- add item { resource_id, resource_type }
DELETE /api/v1/search/collections/:id/items/:item_id -- remove item
Auth: Bearer JWT required.
```

### 11.6 Admin endpoints
```
GET    /api/v1/admin/search/stats           -- search statistics dashboard data
GET    /api/v1/admin/search/synonyms        -- list synonyms
POST   /api/v1/admin/search/synonyms        -- create { term, synonyms[] }
PUT    /api/v1/admin/search/synonyms/:id    -- update
DELETE /api/v1/admin/search/synonyms/:id    -- delete
GET    /api/v1/admin/search/config          -- get search config (weights, thresholds)
PUT    /api/v1/admin/search/config          -- update search config
POST   /api/v1/admin/search/reindex         -- trigger full re-indexation (async)
GET    /api/v1/admin/search/index-health    -- index health metrics
Auth: Bearer JWT required. Role: admin only.
```

### 11.7 Similarity endpoint
```
POST /api/v1/search/similar
Body: { resource_id: uuid, limit: int (default 10) }
Response 200: { results: SearchResult[] }
Auth: Bearer JWT required. Results filtered by user permissions.
```

---

## Category 12 -- PgEventBus Events

### 12.1 Events consumed by search indexer
| Event | Source Module | Action |
|---|---|---|
| `document.created` | signapps-docs | Index new document |
| `document.updated` | signapps-docs | Re-index document |
| `document.deleted` | signapps-docs | Remove from index |
| `email.received` | signapps-mail | Index new email |
| `email.deleted` | signapps-mail | Remove from index |
| `contact.created` | signapps-contacts | Index new contact |
| `contact.updated` | signapps-contacts | Re-index contact |
| `contact.deleted` | signapps-contacts | Remove from index |
| `event.created` | signapps-calendar | Index new event |
| `event.updated` | signapps-calendar | Re-index event |
| `event.deleted` | signapps-calendar | Remove from index |
| `task.created` | signapps-calendar | Index new task |
| `task.updated` | signapps-calendar | Re-index task |
| `task.deleted` | signapps-calendar | Remove from index |
| `file.uploaded` | signapps-storage | Index new file metadata |
| `file.renamed` | signapps-storage | Re-index file metadata |
| `file.deleted` | signapps-storage | Remove from index |
| `chat.message.sent` | signapps-chat | Index chat message |
| `chat.message.deleted` | signapps-chat | Remove from index |

### 12.2 Events emitted by search module
| Event | Trigger | Payload |
|---|---|---|
| `search.alert.triggered` | Saved search alert detects new results | `{ saved_search_id, user_id, new_count }` |
| `search.reindex.completed` | Full re-index finishes | `{ total_items, duration_ms }` |
| `search.reindex.failed` | Re-index worker error | `{ error, items_processed, items_total }` |

---

## Category 13 -- Inter-Module Integration

### 13.1 Integration with signapps-docs (port 3010)
Search indexes all document content (title, body, metadata). The inline preview panel renders document content via the Tiptap read-only renderer. Opening a search result navigates to `/docs/:id`.

### 13.2 Integration with signapps-mail (port 3012)
Search indexes email subject, body (plain text extracted from HTML), sender, recipients, and attachment filenames. The inline preview shows the email body. Operators `from:`, `to:`, `is:unread`, `has:attachment` map to mail-specific fields.

### 13.3 Integration with signapps-calendar (port 3011)
Search indexes event title, description, location, and participants. The inline preview shows event details. Operator `after:`/`before:` can also filter by event date (not just creation date).

### 13.4 Integration with signapps-storage (port 3004)
Search indexes file metadata (name, path, size, MIME type) and, for text-based files (PDF, DOCX, TXT), the extracted text content. Text extraction is performed by the indexing worker using `signapps-office` (port 3018) for document conversion. Binary files (images, videos) are indexed by metadata only, plus multimodal embeddings when available.

### 13.5 Integration with signapps-contacts
Search indexes contact name, email, phone, company, notes. The inline preview shows the full contact card. Operator `from:` also matches contact names.

### 13.6 Integration with signapps-chat (port 3020)
Search indexes chat messages (text content, channel name, sender). Only messages in channels the user has access to are returned. The inline preview shows the message in context (3 messages before and after).

### 13.7 Integration with signapps-ai (port 3005)
Used for: (1) generating embeddings for semantic search, (2) spelling correction suggestions, (3) query understanding for natural language queries. All calls are via REST API with auth token passthrough.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Workspace Search** (support.google.com) -- documentation sur les operateurs de recherche, filtres, Cloud Search.
- **Microsoft 365 Search** (learn.microsoft.com/microsoftsearch) -- guides sur les bookmarks, Q&A, custom verticals, search analytics.
- **Elasticsearch Reference** (elastic.co/guide) -- documentation exhaustive sur les analyzers, queries, aggregations, relevance tuning.
- **Algolia Documentation** (algolia.com/doc) -- guides InstantSearch, typo-tolerance, faceted search, analytics, A/B testing.
- **MeiliSearch Documentation** (docs.meilisearch.com) -- guides sur le search-as-you-type, facets, filters, tenant tokens.
- **Typesense Documentation** (typesense.org/docs) -- guides sur la curation, synonymes, vector search hybride.
- **Notion Search Help** (notion.so/help/search) -- documentation sur la recherche full-text, filtres, quick search.
- **Slack Search Tips** (slack.com/help/articles) -- guide des operateurs de recherche, filtres contextuels, search modifiers.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **MeiliSearch** (github.com/meilisearch/meilisearch) | **MIT** | Moteur de recherche full-text en Rust. Pattern pour le search-as-you-type, typo-tolerance, facets. Reference architecturale. |
| **Typesense** (github.com/typesense/typesense) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Etudier les docs publiques uniquement. |
| **Tantivy** (github.com/quickwit-oss/tantivy) | **MIT** | Moteur de recherche full-text en Rust (equivalent Lucene). Pattern pour l'indexation, le scoring, les analyzers. |
| **Sonic** (github.com/valeriansaliou/sonic) | **MPL-2.0** | Moteur d'auto-suggestion rapide en Rust. Pattern pour le search-as-you-type leger. Consommation OK (MPL-2.0). |
| **cmdk** (github.com/pacocoursey/cmdk) | **MIT** | Composant React pour commande palette (Ctrl+K). Pattern direct pour la barre de recherche modale. |
| **kbar** (github.com/timc1/kbar) | **MIT** | Command bar React extensible. Alternative a cmdk avec animations et groupes. |
| **instantsearch.js** (github.com/algolia/instantsearch) | **MIT** | Widgets UI pour la recherche facettee (hits, facets, pagination, search box). Pattern pour les composants de resultats. |
| **react-instantsearch** (github.com/algolia/instantsearch) | **MIT** | Version React d'InstantSearch. Pattern pour les hooks de recherche et les composants facettes. |
| **Qdrant** (github.com/qdrant/qdrant) | **Apache-2.0** | Moteur de recherche vectorielle en Rust. Pattern pour le hybrid search et le filtrage payload. |
| **pgvector** (github.com/pgvector/pgvector) | **PostgreSQL License** (permissive) | Extension PostgreSQL pour les embeddings vectoriels. Deja utilisee dans SignApps. |

### Pattern d'implementation recommande
1. **Full-text** : index GIN PostgreSQL natif avec `tsvector`/`ts_query`. Dictionnaires `french` et `english`. Pas de moteur externe pour limiter la complexite operationnelle.
2. **Semantique** : embeddings via `signapps-ai` (port 3005), stockes dans pgvector, requetes via `signapps-db` `VectorRepository`.
3. **Barre de recherche** : `cmdk` (MIT) pour la commande palette Ctrl+K. Composant custom pour la page de resultats.
4. **Facettes** : compteurs calcules par des requetes PostgreSQL `GROUP BY` avec `COUNT`. Pas d'aggregation engine externe.
5. **Indexation** : evenements PgEventBus declenches a chaque CRUD dans les modules. Worker asynchrone pour la vectorisation.
6. **Permissions** : clause `WHERE` ajoutee dynamiquement aux requetes de recherche, basee sur les permissions de l'utilisateur (proprietaire, partage, public).

---

## Assertions E2E cles (a tester)

- Ctrl+K opens the search modal from any page
- Typing a term displays suggestions within < 200ms debounce
- Suggestions are grouped by type (Documents, Emails, Contacts, etc.) with correct icons
- ArrowDown/ArrowUp navigates through suggestions; Enter opens the selected result
- Escape closes the search modal
- Scope pills (All, Files, Docs, Mail, etc.) restrict results to the selected module
- Tab cycles through scope pills
- Standard search tab returns full-text results with highlighted terms
- Semantic search tab returns relevant results for a natural language question
- Hybrid mode combines full-text and semantic scores
- Search operators work: `from:`, `in:`, `type:`, `after:`, `before:`, `has:`, `is:`
- Operator autocompletion appears when typing `from:` prefix
- Exact phrase search with double quotes returns only exact matches
- Boolean operators (AND, OR, NOT) work correctly
- Fuzzy matching: typing "metnig" suggests "meeting"
- Did-you-mean correction appears when zero results are found
- Content type filter checkboxes reduce results to selected types
- Date filter restricts results to the chosen range
- Author filter restricts results to the selected author
- Facet counters update dynamically when filters change
- Active filter chips display above results and are removable by clicking X
- Sort by relevance, date, and name produces correct ordering
- Inline preview panel shows document/email/contact content on chevron click
- Infinite scroll loads the next batch at the bottom of the list
- Grouped-by-module view shows sections with "See all N results" links
- Saving a search creates an entry in the Saved Searches list
- Search alert triggers a notification when new results appear
- Search history shows the 10 most recent queries when input is empty
- Clearing history removes all entries
- A document not shared with the user does not appear in their results
- "Find similar documents" button returns semantically similar results
- Collections can be created, items added, and items removed
- Admin synonym management adds a synonym that affects future queries
- Admin weight configuration changes result ordering
- Index health dashboard shows total items and indexation lag
- Zero results state shows suggestions and mode switch recommendation
- Command palette actions (> Create document, > Settings) work
- Ctrl+Enter opens a result in a new tab
