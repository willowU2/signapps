---
name: mail-debug
description: Use when debugging, verifying, or extending the Mail module of SignApps Platform. This skill references the product spec at docs/product-specs/04-mail.md as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, dependencies, common pitfalls) for the mail client, including inbox, threading, composition, search with operators, labels, rules, IA features, PGP, and team inboxes. IMPORTANT: as of 2026-04-09, backend is nearly complete (34 handlers) but frontend has ZERO data-testids and only 3 smoke E2E tests.
---

# Mail — Debug Skill

Debug companion for the Mail module. **Backend very complete** (34 handlers covering all spec categories), **frontend rich** (40 components), but **E2E instrumentation is zero**.

## Source of truth

**`docs/product-specs/04-mail.md`** — 9 categories, 100+ features.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-mail/` — port **3012**
- **Handlers** (34 in `src/handlers/`):
  - Accounts: `accounts.rs`, `accounts_connection.rs`, `ms_accounts.rs`, `autoconfig.rs`
  - Email ops: `emails.rs`, `send_email.rs`, `search.rs`, `email_send.rs`
  - Org: `folders.rs`, `labels.rs`, `threads.rs`
  - Rules: `rules.rs`, `sieve_admin.rs`, `sieve/`, `recurring.rs`, `scheduled.rs`
  - Team: `delegation.rs`, `mailing_lists.rs`
  - Security: `spam.rs`, `spam_bayes.rs`, `pgp.rs`
  - Config: `signatures.rs`, `templates.rs`, `domains.rs`, `aliases.rs`
  - AI: `categorize.rs`, `priority.rs`, `tracking.rs`, `newsletter.rs`
  - Admin: `queue_admin.rs`, `stats.rs`, `import_export.rs`, `internal_server.rs`
- **DB models**: `crates/signapps-db/src/models/mailserver.rs`
- **Migrations**: `026_mail_schema.sql`, `054_email_templates.sql`, `072_mail_pgp_configs.sql`, `096_mail_fts_index.sql` (Tantivy/Postgres FTS), `097_mail_incremental_sync.sql`, `099_mail_account_metadata.sql`, `149_mail_mailing_lists.sql`, `200_mailserver_schema.sql`, `223_infrastructure_mail_sync.sql`, `227_ad_node_mail_domains.sql`, `230_ad_mail.sql`

### Frontend (Next.js + React)
- **Routes** (`client/src/app/mail/`):
  - `page.tsx` — main inbox + split view
  - `settings/page.tsx`, `templates/page.tsx`, `advanced/page.tsx`, `analytics/page.tsx`
  - `callback/google/page.tsx`, `callback/microsoft/page.tsx` — OAuth2
- **Hook**: `client/src/app/mail/use-mail.ts`
- **Components** (40 in `client/src/components/mail/`):
  - UI blocks: `mail-list.tsx`, `mail-display.tsx`, `unified-inbox.tsx`, `mail-nav.tsx`, `mail-header.tsx`, `conversation-thread.tsx`
  - Composition: `compose-rich-dialog.tsx`, `compose-ai-dialog.tsx`, `quick-compose-dialog.tsx`, `email-editor.tsx` (Tiptap)
  - AI: `smart-compose.tsx`, `thread-summarizer.tsx`, `ai-categorizer.tsx`
  - Triage: `rules-editor.tsx`, `spam-filter-settings.tsx`, `snooze-picker.tsx`, `undo-send.tsx`
  - Schedule: `schedule-send-popup.tsx`
  - Attachments: `attachment-preview.tsx`
  - Team: `email-delegation.tsx`, `email-aliases.tsx`
  - Security: `pgp-indicator.tsx`, `pgp-settings.tsx`
  - Analytics: `read-tracking-dashboard.tsx`, `email-analytics.tsx`, `mail-merge-enhanced.tsx`
  - Templates: `template-manager.tsx`, `email-template-editor.tsx`
  - Multi-account: `account-switcher.tsx`, `workspace-header.tsx`
- **API client**: `client/src/lib/api/mail.ts` — `mailApi` with 30+ methods
- **Types**: `client/src/lib/data/mail.ts` — `Mail`, `MailAttachment`
- **State**: No dedicated store — React Query + local state

### E2E tests (current, minimal)
- `client/e2e/mail.spec.ts` (55 lines, **3 smoke tests only**): page load, settings add account, API health on `/api/v1/mail/stats`
- **No Page Object** — `MailPage.ts` to be created
- **Zero data-testids** in components

## Feature categories (from spec)

1. **Inbox & navigation** — list, threading, folders, labels, sort/filter, search (with operators), smart/focused inbox, bundles, snooze, pinning, set-aside
2. **Composition** — compose dialog, Tiptap editor, autocomplete recipients, signatures, attachments, templates, smart compose/reply, schedule send, undo send, multi-alias
3. **Triage** — archive, delete, rules, filters, swipe gestures, block sender, ignore thread, mute newsletters
4. **Search** — FTS, operators (`from:`, `to:`, `subject:`, `has:attachment`, `label:`, etc.), Boolean, fuzzy, saved searches
5. **AI** — thread summary, smart triage, action extraction, compose assist, translation, phishing detection, ask-AI panel
6. **Security** — TLS/AES-256, S/MIME, PGP, confidential mode, aliases, DLP, classification, DKIM/SPF/DMARC verification
7. **Team** — team inbox, assignation, internal comments, draft share, delegation, SLA, canned responses, analytics
8. **Settings** — multi-account (IMAP, OAuth Google/MS), notifications, theme, density, keyboard shortcuts, import
9. **Performance & mobile** — incremental sync, offline, push, virtualization, cache, mobile UI

## Key data-testids (TO BE ADDED — currently zero)

| data-testid | Target |
|---|---|
| `mail-root` | `/mail` page container |
| `mail-nav-sidebar` | Left sidebar (folders, labels, accounts) |
| `mail-nav-folder-{inbox\|sent\|drafts\|trash\|spam\|archive}` | System folder link |
| `mail-nav-folder-custom-{id}` | Custom folder link |
| `mail-nav-label-{id}` | Label in sidebar |
| `mail-account-switcher` | Account dropdown |
| `mail-compose-button` | "Compose" button |
| `mail-search-input` | Global search bar |
| `mail-search-advanced-button` | "Advanced search" toggle |
| `mail-list-root` | Email list virtualized container |
| `mail-list-item-{emailId}` | Each email row — `data-thread-id`, `data-unread`, `data-starred`, `data-has-attachment`, `data-label-ids` |
| `mail-list-checkbox-{emailId}` | Multi-select checkbox |
| `mail-bulk-actions` | Toolbar when items selected |
| `mail-bulk-archive`, `mail-bulk-delete`, `mail-bulk-mark-read`, `mail-bulk-label` | Bulk actions |
| `mail-display-root` | Right pane email display |
| `mail-display-subject`, `mail-display-from`, `mail-display-to`, `mail-display-date` | Metadata |
| `mail-display-body` | Body iframe/container |
| `mail-display-reply`, `mail-display-reply-all`, `mail-display-forward`, `mail-display-archive`, `mail-display-delete`, `mail-display-snooze`, `mail-display-label` | Actions |
| `mail-thread-message-{id}` | Each message in a thread (expanded) |
| `compose-dialog-root` | Compose dialog |
| `compose-dialog-to`, `compose-dialog-cc`, `compose-dialog-bcc`, `compose-dialog-subject` | Recipient/subject fields |
| `compose-dialog-body` | Tiptap editor root |
| `compose-dialog-attach`, `compose-dialog-send`, `compose-dialog-schedule`, `compose-dialog-save-draft` | Actions |
| `compose-dialog-undo-toast` | Undo send toast |
| `snooze-picker-option-{name}` | Snooze preset (tonight, tomorrow, etc.) |
| `rules-editor-root`, `rules-editor-add`, `rules-editor-save` | Rules UI |

## Key E2E tests (to be written)

File structure:
- `client/e2e/mail-inbox.spec.ts` — navigation, list, threading, read/unread, search
- `client/e2e/mail-compose.spec.ts` — compose, send, schedule send, undo send, drafts, attachments
- `client/e2e/mail-triage.spec.ts` — archive, delete, labels, snooze, bulk actions, rules
- `client/e2e/mail-search.spec.ts` — operators, Boolean, saved searches
- `client/e2e/mail-team.spec.ts` — team inbox, assignation, internal comments

```bash
cd client
npx playwright test mail --project=chromium --reporter=list
```

### 5 key journeys to E2E first

1. **Compose & send** — click compose, fill To/Subject/Body/attach, send → verify in Sent + recipient Inbox
2. **Thread expand & reply** — open thread with 3+ msgs, expand collapsed quote, reply → verify new message at bottom
3. **Search operators** — type `from:user has:attachment subject:"keyword"` → verify results
4. **Label & archive** — create label, apply to email, archive → verify email removed from inbox but findable via label
5. **Snooze & reappear** — snooze to "tomorrow 9am" → verify vanishes, time-advance mock → verify reappears

## Debug workflow

### Step 1: Reproduce
- Inbox view (unified vs per-account)
- Folder/label context
- Thread vs single-message view
- Backend logs (`tracing::instrument` on handlers)
- IMAP IDLE vs pull
- Network tab for `/api/v1/mail/*`

### Step 2: Classify
1. **Sync** (mail not appearing)? → `accounts_connection.rs` + IMAP IDLE or incremental sync migrations (096, 097)
2. **Display** (wrong threading, missing attachments)? → `threads.rs` + `emails.rs`
3. **Send** (smtp errors, schedule not firing)? → `send_email.rs` + `scheduled.rs` + lettre (SMTP)
4. **Search** (no results, wrong operators)? → `search.rs` + `096_mail_fts_index.sql`
5. **Rules** (not auto-applied)? → `rules.rs` + `sieve_admin.rs`
6. **AI** (wrong summary/triage)? → `categorize.rs`, `priority.rs` + `signapps-ai` gateway
7. **Team** (assignation not visible)? → `delegation.rs` + `mailing_lists.rs`

### Step 3: Write a failing E2E first
```ts
import { test, expect } from "./fixtures";
import { MailPage } from "./pages/MailPage";

test("reproduce bug", async ({ page }) => {
  const mail = new MailPage(page);
  await mail.goto();
  // ...
});
```

### Step 4: Trace the code path
- **Sync**: IMAP IDLE → `accounts_connection.rs` → DB insert → event bus → websocket push → inbox refresh
- **Send**: `POST /api/v1/mail/emails` → validate → lettre SMTP → on error retry queue
- **Search**: `GET /api/v1/mail/search?q=...` → parse operators → Postgres FTS with `tsvector` or Tantivy index

### Step 5: Fix + regression test + update spec

## Common bug patterns (to populate)

### Anticipated / pre-populated

1. **IMAP IDLE connection drops on long-running** — IDLE keeps connection open; after 29min need re-IDLE. Watch for stuck inbox.
2. **Schedule send not firing** — `scheduled.rs` needs a cron job that polls `scheduled_emails` table every 30s. Check Tokio interval.
3. **Thread detection wrong for same-subject threads** — use `References` + `In-Reply-To` headers, not subject matching alone.
4. **FTS index lags behind inserts** — rebuild trigger may be missing. Test: insert → search immediately should work.
5. **Undo send race** — 5s window must cancel the send. Check that the UI button actually hits a cancel endpoint, not client-side only.
6. **OAuth token refresh silent failure** — if Google/MS refresh token expires, sync silently stops. Should surface an "reauthenticate" banner.
7. **Spam classification feedback loop** — training must update bayes weights; check `spam.rs` `train_spam` handler.
8. **PGP decryption on mobile offline** — keys in localStorage? security concern.
9. **Multi-account unified inbox slow** — N+1 queries across accounts; need single query with UNION.

## Dependencies check (license compliance)

### Backend
- **lettre** — Apache-2.0/MIT ✅ (SMTP)
- **imap**/**async-imap** — MIT/Apache-2.0 ✅
- **mail-parser** / `mail-parser-rs` — Apache-2.0/MIT ✅
- **mailauth** — SPF/DKIM/DMARC — MIT ✅
- **tantivy** — MIT ✅ (FTS alternative)

### Frontend
- **Tiptap** — MIT ✅ (composition)
- **dompurify** — Apache-2.0/MPL-2.0 ✅ (sanitize email HTML)

### Forbidden
- **Roundcube**, **SnappyMail**, **Rainloop** — GPL/AGPL ❌
- **Stalwart**, **Maddy** — AGPL/GPL ❌
- **OpenPGP.js** — LGPL ⚠️ (linkage caution — prefer Rust `rage` or `sequoia`)

## Cross-module interactions

- **Calendar** — "Add to calendar" from detected meeting proposals
- **Contacts** — recipient autocomplete, contact cards
- **Drive** — "Attach from Drive" link instead of upload
- **Tasks** — "Create task from email" action
- **Chat** — "Share email to chat" smart chip
- **AI** — compose assist, summarize, triage via `signapps-ai` (port 3005)
- **Identity** — user session, OAuth tokens
- **Workflows** — email rules can trigger workflows

## Spec coverage checklist

- [ ] All 40 components have data-testids on interactive elements
- [ ] Threading follows RFC (References + In-Reply-To)
- [ ] FTS search supports all operators from spec 4.2
- [ ] Schedule send fires at the right time (cron tested)
- [ ] Undo send cancels within 5s window
- [ ] PGP round-trip (send encrypted → read encrypted)
- [ ] OAuth token refresh automatic
- [ ] Team inbox assignation visible to all members
- [ ] No forbidden mail library introduced

## Historique

- **2026-04-09** : Skill créé. Basé sur spec `04-mail.md` et inventaire (34 backend handlers, 40 frontend components, 9 mail-related migrations, 0 data-testids, 3 smoke E2E tests).
