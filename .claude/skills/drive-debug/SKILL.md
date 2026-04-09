---
name: drive-debug
description: Use when debugging, verifying, or extending the Drive (file storage + VFS) module of SignApps Platform. This skill references the product spec at docs/product-specs/05-drive.md as the source of truth. Covers file upload/download, folders, sharing (ACL + public links), trash, versions, previews, search, favorites, quotas. Backed by `signapps-storage` (port 3004) with OpenDAL. Recent migration from legacy drive.acl to the new signapps-sharing engine. IMPORTANT: ~40% spec coverage, 0 data-testids, minimal E2E tests.
---

# Drive — Debug Skill

Debug companion for the Drive module. **Core CRUD + sharing + versions implemented** (~40% spec). **~60% partial** (UI exists but integration unclear). **0 data-testids**. Recent migration from legacy `drive.acl` to `signapps-sharing`.

## Source of truth

**`docs/product-specs/05-drive.md`** — 11 categories, 200+ features.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-storage/` — port **3004**
- **Handlers** (24 in `src/handlers/`):
  - `drive.rs` — VFS (list_nodes, create_node, update_node, delete_node, download_node)
  - `files.rs` — upload/download with SHA-256 dedup
  - `shares.rs` — share links (expiration, password, max_downloads, access_type: view/download/edit)
  - `acl.rs` — ACLs (create_acl, update_acl, break/restore inheritance, effective_acl) **— legacy, being replaced by signapps-sharing**
  - `trash.rs` — soft delete (move_to_trash, restore_from_trash, empty_trash)
  - `favorites.rs` — star/unstar
  - `versions.rs` — version history
  - `preview.rs` — thumbnails, format-specific previews
  - `search.rs` — search, quick_search, recent_files, suggest, omni_search
  - `quotas.rs` — user storage quotas
  - `permissions.rs`, `tags.rs`, `audit.rs`, `backups.rs`, `buckets.rs`, `external.rs`, `mounts.rs`, `raid.rs`, `storage_settings.rs`, `webdav.rs`, `health.rs`, `openapi.rs`
- **Storage**: **OpenDAL** (Apache-2.0) — supports FS, S3, Azure, GCS
- **DB models** (`crates/signapps-db/src/models/`):
  - `drive.rs` — `DriveNode { id, parent_id, name, node_type: folder|file|document|spreadsheet|presentation, target_id, workspace_id, owner_id, size, mime_type, sha256, timestamps }`
  - `drive.rs` — `DrivePermission { id, node_id, user_id|group_id, role: viewer|editor|manager }`
  - `drive_acl.rs` — **legacy**, being phased out
- **Migrations**: `029_drive_vfs.sql`, `048_update_drive_nodes_check_constraint.sql`, `057_drive_workspace_isolation.sql`, `080_drive_nodes_sha256_hash.sql`, `118_drive_acl.sql` **(deprecated)**, `148_fix_drive_nodes_unique_constraint.sql`, `234_add_presentation_to_drive_constraint.sql`
- **Recent work**: commits `8b01cd56` (sharing engine migration), `2771a769` (5 critical journeys fix)

### Frontend
- **Routes**: `client/src/app/drive/{page,loading,error}.tsx`
- **Drive-specific components** (`client/src/components/drive/`):
  - `ShareDialog.tsx`, `file-previewer.tsx`, `pdf-viewer.tsx`, `pdf-watermark.tsx`, `secure-share.tsx`, `smart-folders.tsx`, `dedup-scanner.tsx`
- **Storage shared components** (`client/src/components/storage/`):
  - `drive-sidebar.tsx` — nav (My Drive, Shared, Recent, Starred, Trash)
  - `drive-right-sidebar.tsx` — file details + sharing + activity
  - `storage-file-grid.tsx`, `file-grid-item.tsx`, `file-list-item.tsx`, `drop-zone.tsx`, `upload-sheet.tsx`, `move-to-sheet.tsx`, `rename-sheet.tsx`, `share-sheet.tsx`, `folder-share-dialog.tsx`, `folder-tree.tsx`, `favorites-bar.tsx`, `version-history-sheet.tsx`, `permissions-sheet.tsx`, `acl-panel.tsx`, `audit-timeline.tsx`, `file-tags-sheet.tsx`, `bulk-action-toolbar.tsx`, `content-search-dialog.tsx`, `storage-quota.tsx`, `auto-categorize.tsx`
  - `previews/` — pdf, video, document, code, markdown, archive
- **State**: React Query (`useQuery`) — no Zustand store
- **API**: `client/src/lib/api/drive.ts` — `listNodes`, `createNode`, `updateNode`, `deleteNode`, `downloadNode`, `uploadFile`, `findNodeByTargetId`

### E2E tests (minimal)
- `client/e2e/storage.spec.ts` — page layout, tab nav, bucket selector, breadcrumb, file list header
- **No DrivePage.ts** Page Object
- **0 data-testids** in drive/storage components

## Feature categories (from spec)

1. **Navigation & vues** — sidebar, breadcrumb, grid/list/gallery, sort/filter, stars, pin, activity feed, recent, workspaces, spaces
2. **Création & upload** — drag-drop, folder upload, URL import, create doc directly, resume, queue, duplicate handling, OCR scan
3. **Prévisualisation** — 100+ formats, zoom, annotations (PDF), comments, open-with, thumbnails, fullscreen
4. **Partage & permissions** — share dialog, roles, public link, advanced restrictions (password, expiry, max DL, watermark), group share, audit, request access
5. **Recherche** — global, syntax, FTS, OCR, semantic, image similarity
6. **Versions** — auto-save, compare, rollback
7. **Sync** — desktop, mobile (not yet)
8. **Édition intégrée** — Docs/Sheets/Slides from Drive, real-time collab
9. **Sécurité** — encryption, Personal Vault, DLP, ransomware detection, audit, retention
10. **IA** — auto-tag, summarize, dedup, translate, OCR, Q&A
11. **Performance & accessibilité** — virtualized list, keyboard shortcuts, WCAG

## Key data-testids (TO BE ADDED — currently zero)

| data-testid | Target |
|---|---|
| `drive-root` | `/drive` page container |
| `drive-sidebar` | Left sidebar |
| `drive-sidebar-{section}` — `my-drive`, `shared-with-me`, `shared-drives`, `recent`, `starred`, `trash`, `quota` |
| `drive-breadcrumb`, `drive-breadcrumb-item-{index}` | Breadcrumb trail |
| `drive-view-toggle-{grid\|list}` | View mode toggle |
| `drive-sort-{name\|date\|size\|type}` | Sort controls |
| `drive-new-folder-button`, `drive-upload-button`, `drive-new-doc-button`, `drive-new-sheet-button`, `drive-new-slide-button` | Creation actions |
| `drive-file-container` | Main file area (grid or list) |
| `drive-file-item-{nodeId}` | Each file/folder — `data-node-type`, `data-file-name`, `data-mime-type`, `data-size`, `data-starred`, `data-shared` |
| `drive-file-item-checkbox-{nodeId}` | Multi-select |
| `drive-file-item-menu-{nodeId}` | Context menu trigger |
| `drive-bulk-actions`, `drive-bulk-{download\|move\|trash\|share\|tag}` | Multi-select actions |
| `drive-drop-zone` | Drag-drop upload target |
| `drive-share-dialog`, `drive-share-dialog-email-input`, `drive-share-dialog-role-{viewer\|editor\|manager}`, `drive-share-dialog-link-toggle`, `drive-share-dialog-link-copy`, `drive-share-dialog-submit` | Share dialog |
| `drive-move-dialog`, `drive-move-dialog-folder-{id}`, `drive-move-dialog-confirm` | Move destination picker |
| `drive-rename-dialog`, `drive-rename-input`, `drive-rename-confirm` | Rename |
| `drive-trash-restore-{nodeId}`, `drive-trash-delete-permanently-{nodeId}`, `drive-trash-empty` | Trash actions |
| `drive-version-history`, `drive-version-item-{versionId}`, `drive-version-restore-{versionId}`, `drive-version-preview-{versionId}` | Versions |
| `drive-preview-root`, `drive-preview-close`, `drive-preview-download`, `drive-preview-prev`, `drive-preview-next` | Preview modal |
| `drive-search-input`, `drive-search-filter-type-{type}`, `drive-search-result-{nodeId}` | Search |
| `drive-right-sidebar`, `drive-right-sidebar-tab-{details\|sharing\|activity}` | Right panel |

## Key E2E tests (to be written)

- `client/e2e/drive-upload.spec.ts` — drag-drop, button upload, folder, duplicate handling
- `client/e2e/drive-share.spec.ts` — share dialog, link generation, permission change, revocation
- `client/e2e/drive-trash.spec.ts` — delete → trash → restore → empty
- `client/e2e/drive-versions.spec.ts` — upload v1 → modify → compare → restore
- `client/e2e/drive-search.spec.ts` — search, filter by type, OCR search

### 5 key journeys

1. **Upload & organize** — drag 3 files, verify list, rename, move
2. **Share & access** — share dialog, add viewer email, toggle public link, revoke
3. **Trash & restore** — delete 2, view trash, restore one, empty
4. **Version history** — upload v1, re-upload v2, restore v1
5. **Search & filter** — create 5 mixed-type files, search partial name, filter by image type

## Debug workflow

### Step 1: Reproduce
- Current folder/workspace
- Node type (file vs folder vs doc/sheet/slide symlink)
- Share state and role
- Browser network tab (multipart uploads, presigned URLs)

### Step 2: Classify
1. **Upload** → `files.rs` + OpenDAL adapter + `drive.rs` node creation
2. **Share** → `shares.rs` or new `signapps-sharing` engine, legacy `acl.rs`
3. **Preview** → `preview.rs` + format-specific handlers + `previews/` components
4. **Search** → `search.rs` + Postgres FTS
5. **Trash** → `trash.rs` soft-delete flag + retention job
6. **Versions** → `versions.rs` + storage of deltas or full copies

### Step 3: Write a failing E2E first
### Step 4: Trace the code path
### Step 5: Fix + regression + update spec

## Common bug patterns (pre-populated watch list)

1. **Sharing engine migration drift** — legacy `drive.acl` table still has rows that aren't in `signapps-sharing`. Check the migration did full backfill.
2. **Upload of files > 100MB fails** — chunked upload / multipart config on reverse proxy (nginx client_max_body_size, Axum body limit).
3. **OpenDAL backend switch loses metadata** — if FS → S3 migration, check that `sha256` column is preserved.
4. **Public link leaks private data** — check that `SharedContext` enforces access_type before streaming.
5. **Dedup hash collisions** — SHA-256 is fine in practice, but watch for "file exists" false positives when two files have the same content.
6. **Trash retention job deletes too early** — cron setup should respect user's retention setting (default 30 days).
7. **Move-to-folder circular reference** — a folder can't be its own ancestor. DB constraint needed.
8. **Permission inheritance break** — when ACL inheritance is broken, child nodes should fall back to explicit permissions.
9. **File preview hangs on large PDFs** — preview generator needs timeout + streaming.

## Dependencies check (license compliance)

### Backend
- **opendal** — Apache-2.0 ✅
- **sha2** — MIT/Apache-2.0 ✅
- **tantivy** — MIT ✅ (search)

### Frontend
- **react-pdf** / **pdf.js** — Apache-2.0 ✅
- **@dnd-kit/core** — MIT ✅ (drag-drop)
- **fabric.js** — MIT ✅ (annotations, if any)

### Forbidden
- **Nextcloud** — AGPL ❌
- **Seafile CE** — AGPL ❌
- **Pydio CE** — AGPL ❌
- Reuse ideas from docs only.

## Cross-module interactions

- **Docs/Sheets/Slides** — files are opened in their respective editors
- **Mail** — "attach from Drive" in compose
- **Chat** — "share file" creates a smart chip
- **Forms** — file upload fields store in Drive
- **Calendar** — event attachments from Drive
- **AI** — OCR, semantic search, auto-tag via `signapps-ai`
- **Identity** — RBAC, workspace isolation
- **Workflows** — file added as trigger

## Spec coverage checklist

- [ ] All 11 categories at least partially implemented
- [ ] data-testids on sidebar, file grid, context menu, share dialog, trash, versions, preview
- [ ] Migration from legacy ACL to signapps-sharing fully complete
- [ ] Upload works for files up to 5GB (chunked)
- [ ] Preview for 20+ formats
- [ ] Share link respects expiration + password
- [ ] Trash auto-empty after retention period
- [ ] No forbidden storage lib introduced

## Historique

- **2026-04-09** : Skill créé. Basé sur spec `05-drive.md` et inventaire (24 handlers, 30+ storage components, OpenDAL, recent sharing migration, 0 data-testids, minimal E2E).
