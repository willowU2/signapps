---
name: docs-editor-debug
description: Use when debugging, verifying, or extending the Docs (collaborative document editor) module of SignApps Platform. This skill references the product spec at docs/product-specs/02-docs.md as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, Tiptap/Yjs dependencies, common pitfalls) for the Tiptap-based collaborative rich-text editor.
---

# Docs (Collaborative Editor) — Debug Skill

This skill is the **dedicated debugging companion** for the Docs module of SignApps Platform. Built on **Tiptap (MIT) + Yjs (MIT) + ProseMirror (MIT)** — the standard open-source collaborative editing stack used across SignApps for Docs, Wiki, Mail, Chat comments, and any rich-text area.

## Source of truth

**`docs/product-specs/02-docs.md`** defines expected behavior.

Always read the spec first. If observed behavior contradicts the spec: either fix the code, or update the spec via `product-spec-manager` workflow B.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-docs/` — port **3010**
- **Handlers**: `services/signapps-docs/src/handlers/` — document CRUD, version history, share links
- **DB models**: `crates/signapps-db/src/models/docs.rs` — Document, DocumentVersion, DocumentShare
- **Yjs server**: may use `signapps-collab` (port 3013) for websocket doc sync — check `services/signapps-collab/`
- **Storage**: OpenDAL via `signapps-storage` for attachments + snapshots

### Frontend (Next.js + React)
- **App route**: `client/src/app/docs/` — listing + editor
  - `page.tsx` — docs listing (grid/list with folders)
  - `editor/page.tsx` or `[id]/page.tsx` — editor entry point
- **Main component**: `client/src/components/docs/docs-editor.tsx` (or similar — Tiptap `EditorContent` root)
- **Extensions**: `client/src/components/docs/extensions/` — custom Tiptap marks/nodes
  - `collaboration.ts` — Yjs binding
  - `comment.ts`, `suggestion.ts`, `mention.ts`, `smart-chip.ts`, `embed-sheet.ts`, etc.
- **Toolbar**: `client/src/components/docs/toolbar.tsx` — format buttons
- **Sidebar**: `client/src/components/docs/outline.tsx`, `comments-panel.tsx`, `version-history.tsx`
- **Share dialog**: `client/src/components/docs/share-dialog.tsx`
- **Store**: `client/src/stores/docs-store.ts` (if any)
- **API client**: `client/src/lib/api/docs.ts`
- **Types**: `client/src/types/docs.ts`

### E2E tests
- `client/e2e/docs-editor.spec.ts` — 20 tests (formatting, headings, lists, undo/redo)
- Legacy: `client/e2e/docs.spec.ts` (if present — to modernize)
- **Page Object**: `client/e2e/pages/DocsEditorPage.ts` — uses `.ProseMirror` selector + `getByTitle` for toolbar

## Feature categories (from the spec)

1. **Édition texte et mise en forme** — headings, bold/italic/underline/strike, colors, alignment, indent, line height, fonts
2. **Listes et structure** — bullet/ordered/todo, nested, drag-to-reorder, outline view
3. **Médias et embeds** — images, videos, drawings, equations (KaTeX), code blocks (Shiki), charts, smart chips (links to other SignApps modules)
4. **Tables** — resize, merge, headers, sort, cell formatting, CSV paste
5. **Collaboration temps réel** — multi-cursor, presence, user colors, awareness, CRDT via Yjs
6. **Commentaires et suggestions** — thread comments, mentions, resolve, suggestion mode (track changes)
7. **Version history** — automatic snapshots, restore, compare, label versions
8. **Partage et permissions** — link share (view/comment/edit), specific users, expiration, password
9. **Recherche et navigation** — find/replace, outline, jump to heading, page breaks
10. **IA intégrée** — rewrite, summarize, translate, generate, slash commands
11. **Import/export** — DOCX, PDF, Markdown, HTML
12. **Mobile et accessibilité** — WCAG AA, keyboard shortcuts, screen reader, offline PWA

## Key data-testids

Tiptap uses `.ProseMirror` as the main editable div — the Page Object uses this selector. Additional testids should be added for toolbar buttons and dialogs:

| data-testid / selector | Purpose |
|---|---|
| `.ProseMirror` | The editable content root |
| `docs-editor-root` | Editor page container |
| `docs-editor-title` | Document title input |
| `docs-editor-toolbar` | Toolbar container |
| `toolbar-bold`, `toolbar-italic`, `toolbar-underline`, `toolbar-strike` | Format marks |
| `toolbar-heading-{1\|2\|3}`, `toolbar-bullet-list`, `toolbar-ordered-list`, `toolbar-todo-list` | Block types |
| `toolbar-link`, `toolbar-image`, `toolbar-table`, `toolbar-code`, `toolbar-quote` | Insert |
| `toolbar-undo`, `toolbar-redo` | History |
| `docs-outline` | Outline sidebar |
| `docs-comments-panel` | Comments sidebar |
| `docs-share-button`, `share-dialog`, `share-user-picker`, `share-permission-select` | Share |
| `version-history-button`, `version-history-panel`, `version-restore-{id}` | Versions |
| `slash-menu`, `slash-menu-item-{name}` | Slash command |

The current Page Object uses `getByTitle` for toolbar buttons (based on Tiptap standard titles like "Bold", "Italic"). If the title is localized, this breaks — migrate to explicit `data-testid`.

## Key E2E tests

```bash
cd client
# Run all docs tests
npx playwright test docs --project=chromium --reporter=list

# Single test
npx playwright test docs-editor -g "bold formatting" --project=chromium --headed
```

## Debug workflow

### Step 1: Reproduce
- Action sequence (exact keystrokes, clicks)
- Document state (empty? pre-filled? collaborative session?)
- Browser console (Tiptap emits warnings for invalid schemas)
- Network WS traffic (Yjs sync messages)

### Step 2: Classify

1. **Editing** (mark/node transform, paste, shortcut) → check the relevant extension
2. **Collaboration** (cursor desync, missing text) → check Yjs binding, awareness, WS connection
3. **Toolbar** (button not firing) → check `editor.can().chain().focus().xxx()` + `editor.chain().focus().xxx().run()`
4. **Serialization** (import/export, save) → check the HTML/Markdown/DOCX serializer
5. **Performance** (typing lag, scroll jank) → check for React re-renders on keystroke (should use uncontrolled Tiptap)

### Step 3: Write a failing E2E test

```ts
import { test, expect } from "./fixtures";
import { DocsEditorPage } from "./pages/DocsEditorPage";

test("reproduce bug", async ({ page }) => {
  const docs = new DocsEditorPage(page);
  await docs.gotoNew("BugRepro");
  await docs.typeText("hello");
  await docs.applyBold();
  await expect(await docs.expectBold()).toBeTruthy();
});
```

### Step 4: Trace the code path

- **Editing**: keystroke → ProseMirror input rule → transaction → Yjs update → rebroadcast → remote apply
- **Toolbar**: click → `editor.chain().focus().setMark('bold').run()` → schema commands → transaction
- **Save**: debounced `onUpdate` → API call → version snapshot
- **Collaboration**: WS message → Yjs apply → ProseMirror binding updates view

### Step 5: Fix + regression test + update spec

## Common bug patterns

### 1. `getByTitle("Bold")` breaks with localization
**Symptom**: Playwright `getByTitle("Bold")` times out after the toolbar is localized to French ("Gras").
**Root cause**: Page Object relies on English titles.
**Fix**: Add `data-testid="toolbar-bold"` to all toolbar buttons and update `DocsEditorPage.ts` to use testids.

### 2. Tiptap `setContent` doesn't fire onUpdate
**Symptom**: Calling `editor.commands.setContent(html)` in a test doesn't trigger save.
**Root cause**: `setContent` default `emitUpdate = false`.
**Fix**: Call with `editor.commands.setContent(html, { emitUpdate: true })`.

### 3. Yjs provider not disconnected on navigation
**Symptom**: WebSocket connections leak, server shows stale clients, memory grows.
**Root cause**: The Yjs `WebsocketProvider` isn't destroyed on unmount (missing `useEffect` cleanup).
**Diagnostic**: Chrome → Application → WebSockets → count connections.
**Fix**: In the collaboration extension hook, return `() => { provider.destroy(); ydoc.destroy(); }`.

### 4. Toolbar state out of sync with selection
**Symptom**: User selects bold text but toolbar "Bold" button is not highlighted.
**Root cause**: Toolbar re-renders on every selection change but uses stale `editor.isActive('bold')`. Must subscribe to `editor.on('selectionUpdate', ...)`.
**Fix**: Wrap toolbar in `useEditorState` hook or force re-render on `selectionUpdate`.

### 5. Paste from Word inserts `<span style="...">` garbage
**Symptom**: Pasting from Word produces weirdly-formatted text with inline styles.
**Root cause**: Default HTML paste handler preserves unknown inlines.
**Fix**: Add a paste extension that strips non-schema attributes via `DOMParser.fromSchema` + walk the tree.

### 6. Image upload bypasses storage quota
**Symptom**: Users upload 100MB images freely.
**Root cause**: Upload endpoint doesn't check user quota before writing.
**Fix**: Add quota check in `services/signapps-docs/src/handlers/upload.rs` before OpenDAL write.

### 7. Collaborative cursors jitter
**Symptom**: Multiple users' cursors flicker during fast typing.
**Root cause**: Awareness updates sent on every keystroke, no throttle.
**Fix**: Throttle awareness `setLocalStateField` to 50-100ms.

### 8. `editor` ref is null on first render
**Symptom**: `TypeError: Cannot read property 'chain' of null` in toolbar.
**Root cause**: Tiptap `useEditor` returns `null` on first render, toolbar tries to access before mount.
**Fix**: Guard with `if (!editor) return null;` at the top of the toolbar component.

### 9. ProseMirror strips trailing whitespace on paste
**Symptom**: Pasted content with intentional trailing spaces is trimmed.
**Root cause**: Default schema `parseDOM` normalizes whitespace.
**Fix**: Set `preserveWhitespace: 'full'` on the paragraph node.

*(This section grows over time as bugs are found and fixed.)*

## Dependencies check (license compliance)

Key dependencies used by Docs. Verify none introduce forbidden licenses:

### Runtime
- **@tiptap/core** — MIT ✅
- **@tiptap/react** — MIT ✅
- **@tiptap/starter-kit** — MIT ✅
- **@tiptap/extension-collaboration**, **collaboration-cursor** — MIT ✅
- **@tiptap/extension-{link,image,table,mention,placeholder,task-list,code-block-lowlight}** — MIT ✅
- **yjs** — MIT ✅
- **y-websocket** — MIT ✅
- **y-prosemirror** — MIT ✅
- **prosemirror-*** — MIT ✅
- **lowlight** / **highlight.js** — BSD-3-Clause ✅
- **katex** — MIT ✅
- **turndown** (HTML → Markdown) — MIT ✅
- **@hocuspocus/server** — MIT ✅ (if used instead of y-websocket)

### Forbidden (do NOT introduce)
- **CKEditor 5** — **GPL-2.0+ or commercial** ❌ — stick with Tiptap
- **TinyMCE** — **GPL-2.0+ or commercial** ❌
- **Slate.js plugins with GPL** — verify each plugin
- **Quill** — BSD-3 (OK) but mixing schemas is a nightmare — don't
- **Redactor** — commercial ❌

Run before committing any dependency change:
```bash
just deny-licenses
cd client && npm run license-check:strict
```

## Cross-module interactions

- **Drive** — document saved as a Drive file, folders, share
- **Spreadsheet** — `EmbedSheet` Tiptap node can embed a cell range
- **Slides** — `EmbedSlide` for live slide preview
- **Calendar** — meeting notes linked to an event
- **Chat** — share doc link creates a smart chip with title preview
- **Mail** — "insert from Docs" action
- **AI** — slash commands, rewrite, summarize
- **Wiki** — wiki pages use the same editor (shared extensions)
- **Notifications** — comment mentions trigger notifications

## Spec coverage checklist

- [ ] All 12 feature categories have at least one implementation
- [ ] `docs-editor.spec.ts` covers basic formatting (bold/italic/underline/strike)
- [ ] Collaborative cursors visible in realtime
- [ ] Version history saves on idle + manual "save version"
- [ ] Share link respects permissions (view/comment/edit/none)
- [ ] Comments thread + mention + resolve work
- [ ] Slash menu for insertions
- [ ] Tables resize + merge + format
- [ ] Import DOCX/Markdown, export DOCX/PDF/MD
- [ ] Offline PWA with Yjs local persistence
- [ ] No forbidden editor dependency introduced

## How to update this skill

When a new feature is added:
1. Update `docs/product-specs/02-docs.md` via `product-spec-manager` workflow B
2. Update data-testids, E2E tests here
3. Pre-populate common bug patterns for the new area

When a bug is fixed: add pattern with symptom, root cause, diagnostic, fix.

## Historique

- **2026-04-09** : Skill créé. Basé sur le spec `02-docs.md` et l'état actuel du code (20 E2E tests dans `docs-editor.spec.ts`, `DocsEditorPage` Page Object avec `.ProseMirror` + `getByTitle`).
