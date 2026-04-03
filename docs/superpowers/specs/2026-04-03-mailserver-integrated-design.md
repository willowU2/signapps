# SignApps Integrated Mail Server — Design Specification

**Date**: 2026-04-03
**Status**: Approved
**Author**: Claude Opus 4.6 + Etienne ROPP

## Overview

Full Rust mail/calendar/contacts server integrated into the SignApps platform workspace. Inspired by Stalwart's architecture but built from scratch under MIT license, using PostgreSQL as the sole storage backend, with full REST/JMAP API and RAG search capabilities.

## Goals

- Complete mail server: SMTP inbound/outbound, IMAP4rev2, JMAP, ManageSieve
- CalDAV + CardDAV for external client compatibility
- Anti-spam with DKIM/SPF/DMARC + LLM classification
- Multi-tenant with multi-domain per tenant
- All data in existing PostgreSQL (no separate DB)
- RAG search via pgvector embeddings
- Single binary (`signapps-mail`) listening on 6 ports

## Non-Goals

- No Java, no external mail server dependency
- No code copied from Stalwart (AGPL) — clean-room implementation
- No separate storage engine (RocksDB, etc.) — PostgreSQL only

---

## Architecture

### Workspace Layout

```
crates/
  signapps-smtp/        # SMTP protocol (parser, state machine, extensions)
  signapps-imap/        # IMAP4rev2 protocol (parser, commands, state)
  signapps-jmap/        # JMAP core (RFC 8620/8621) + Calendars + Contacts
  signapps-sieve/       # Sieve engine (RFC 5228) + extensions
  signapps-dkim/        # DKIM sign/verify + SPF + DMARC + ARC
  signapps-spam/        # Anti-spam (DNSBL, greylisting, scoring, LLM)
  signapps-mime/        # MIME parser (replaces mailparse)
  signapps-dav/         # CalDAV + CardDAV (RFC 4791/6352)
  signapps-common/      # (existing) JWT, middleware, AppError
  signapps-db/          # (existing) + new mail models/repos
  signapps-cache/       # (existing) rate limiting, sessions
  signapps-service/     # (existing) bootstrap utilities

services/
  signapps-mail/        # (enriched) Single multi-port service
    src/
      main.rs           # Multi-listener (3012 + 25 + 587 + 993 + 4190 + 8443)
      smtp/             # SMTP server (inbound + outbound queue)
      imap/             # IMAP server (sessions, mailbox state)
      jmap/             # JMAP endpoints (mail, calendar, contacts)
      dav/              # CalDAV/CardDAV endpoints
      sieve/            # ManageSieve server
      handlers/         # (existing) REST API admin + enriched
      queue/            # SMTP outbound queue
      dns/              # DNS resolution + securelink integration
      auth/             # SASL + OAuth unified auth
      sync_service.rs   # (existing) External IMAP sync
```

### Design Principles

1. **Crates are pure libraries** — no I/O, only parsing and logic. The service does network binding.
2. **Single binary** — `signapps-mail` listens on 6 ports (3012 REST, 25 SMTP-in, 587 SMTP-out, 993 IMAP, 4190 Sieve, 8443 DAV).
3. **PostgreSQL only** — all data in the existing database, schema `mailserver.*`.
4. **Deduplication** — `message_contents` stores content once by SHA-256 hash; `message_mailboxes` is the N:N join for labels/folders.
5. **IMAP-ready schema** — UID, MODSEQ, UIDVALIDITY, flags bitmask.
6. **RAG-ready** — tsvector full-text + pgvector(384) embeddings on every message.

### Port Allocation

| Port | Protocol | Auth | Purpose |
|------|----------|------|---------|
| 3012 | HTTP | JWT Bearer | REST API + JMAP |
| 25 | SMTP | optional STARTTLS | Inbound mail reception |
| 587 | SMTP | STARTTLS + SASL | Authenticated submission |
| 993 | IMAPS | TLS + SASL | Mail access (clients) |
| 4190 | ManageSieve | STARTTLS + SASL | Filter management |
| 8443 | HTTPS | Basic Auth | CalDAV/CardDAV |

---

## Data Flow

### Inbound Email (SMTP port 25)

```
TCP accept → STARTTLS
→ EHLO → MAIL FROM → RCPT TO (verify local domain + account)
→ DATA → receive raw MIME
→ Pipeline:
  1. signapps-dkim::verify() → DKIM result
  2. signapps-dkim::spf_check() → SPF result
  3. signapps-dkim::dmarc_check() → DMARC result
  4. signapps-spam::check() → score + verdict
  5. If spam → quarantine or reject
  6. signapps-mime::parse() → extract headers, body, attachments
  7. signapps-sieve::execute() → apply user filters
  8. Store in PostgreSQL (message_contents + messages + message_mailboxes)
  9. Generate embedding via signapps-ai (RAG)
  10. NOTIFY 'mailbox_changes' → wake IMAP IDLE
  11. Webhook → push notification
→ 250 OK
```

### Outbound Email (SMTP port 587)

```
TCP accept → STARTTLS mandatory
→ AUTH PLAIN/LOGIN/XOAUTH2
→ MAIL FROM (verify sender owns address)
→ RCPT TO → DATA
→ signapps-dkim::sign() → add DKIM header
→ If local recipient → deliver directly
→ If remote → INSERT into mailserver.queue
→ Queue worker:
  DNS MX lookup → connect remote SMTP → send
  Retry: 1min, 5min, 30min, 2h, 12h, 24h
  After 72h → bounce to sender
```

### IMAP IDLE (Real-time Push)

```
Client: "A005 IDLE"
Server: "+ idling"
PostgreSQL LISTEN 'mailbox_changes'
On new message: NOTIFY payload = {account_id, mailbox_id}
If match session: "* 42 EXISTS\r\n"
Client: "DONE"
```

---

## Database Schema

### Schema: `mailserver`

#### Domains & Accounts

```sql
mailserver.domains (
  id UUID PK,
  tenant_id UUID FK → identity.tenants,
  name VARCHAR(255) UNIQUE,
  dkim_private_key TEXT,
  dkim_selector VARCHAR(63),
  dkim_algorithm VARCHAR(10),      -- "rsa-sha256" | "ed25519-sha256"
  spf_record TEXT,
  dmarc_policy VARCHAR(10),        -- "none" | "quarantine" | "reject"
  catch_all_address VARCHAR(255),
  max_accounts INT DEFAULT 0,
  is_verified BOOL DEFAULT false,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

mailserver.accounts (
  id UUID PK,
  domain_id UUID FK → domains,
  user_id UUID FK → identity.users,
  address VARCHAR(255) UNIQUE,
  display_name VARCHAR(255),
  password_hash TEXT,               -- Argon2id
  quota_bytes BIGINT DEFAULT 5368709120,
  used_bytes BIGINT DEFAULT 0,
  is_active BOOL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

mailserver.aliases (
  id UUID PK,
  account_id UUID FK → accounts,
  alias_address VARCHAR(255) UNIQUE,
  domain_id UUID FK → domains,
  is_active BOOL DEFAULT true
)
```

#### Messages & Storage (with dedup)

```sql
mailserver.message_contents (
  id UUID PK,
  content_hash CHAR(64) UNIQUE,     -- SHA-256
  raw_size BIGINT,
  storage_key TEXT,                  -- key in signapps-storage
  headers_json JSONB,
  body_text TEXT,
  body_html TEXT,
  body_structure JSONB,             -- MIME tree (IMAP BODYSTRUCTURE)
  text_search TSVECTOR,             -- full-text FR+EN
  embedding VECTOR(384),            -- pgvector for RAG
  created_at TIMESTAMPTZ
)

mailserver.messages (
  id UUID PK,
  account_id UUID FK → accounts,
  content_id UUID FK → message_contents,
  message_id_header VARCHAR(255),
  in_reply_to VARCHAR(255),
  thread_id UUID,
  sender VARCHAR(255),
  sender_name VARCHAR(255),
  recipients JSONB,
  subject TEXT,
  date TIMESTAMPTZ,
  has_attachments BOOL DEFAULT false,
  spam_score FLOAT DEFAULT 0,
  spam_status VARCHAR(20),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

mailserver.message_mailboxes (
  message_id UUID FK → messages,
  mailbox_id UUID FK → mailboxes,
  uid INT NOT NULL,
  modseq BIGINT NOT NULL,
  flags INT DEFAULT 0,              -- bitmask: Seen=1,Answered=2,Flagged=4,Deleted=8,Draft=16
  PRIMARY KEY (message_id, mailbox_id)
)

mailserver.mailboxes (
  id UUID PK,
  account_id UUID FK → accounts,
  name VARCHAR(255),
  special_use VARCHAR(20),
  uid_validity INT NOT NULL,
  uid_next INT DEFAULT 1,
  highest_modseq BIGINT DEFAULT 0,
  total_messages INT DEFAULT 0,
  unread_messages INT DEFAULT 0,
  parent_id UUID FK → mailboxes,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ
)

mailserver.attachments (
  id UUID PK,
  content_id UUID FK → message_contents,
  filename VARCHAR(255),
  content_type VARCHAR(127),
  size BIGINT,
  storage_key TEXT,
  content_disposition VARCHAR(20),
  cid VARCHAR(255)
)

mailserver.threads (
  id UUID PK,
  account_id UUID FK → accounts,
  subject_base VARCHAR(255),
  last_message_at TIMESTAMPTZ,
  message_count INT DEFAULT 1,
  unread_count INT DEFAULT 0,
  participants JSONB
)
```

#### SMTP Queue

```sql
mailserver.queue (
  id UUID PK,
  account_id UUID FK → accounts,
  from_address VARCHAR(255),
  recipients JSONB,
  raw_message_key TEXT,
  priority INT DEFAULT 0,
  status VARCHAR(20),               -- queued|sending|deferred|bounced|sent
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
)
```

#### Sieve

```sql
mailserver.sieve_scripts (
  id UUID PK,
  account_id UUID FK → accounts,
  name VARCHAR(255),
  script TEXT,
  is_active BOOL DEFAULT false,
  compiled BYTEA,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

#### Calendar (CalDAV + JMAP)

```sql
mailserver.cal_calendars (
  id UUID PK,
  account_id UUID FK → accounts,
  name VARCHAR(255),
  color VARCHAR(7),
  description TEXT,
  timezone VARCHAR(64) DEFAULT 'Europe/Paris',
  ctag VARCHAR(64),
  sort_order INT DEFAULT 0,
  is_default BOOL DEFAULT false,
  created_at TIMESTAMPTZ
)

mailserver.cal_events (
  id UUID PK,
  calendar_id UUID FK → cal_calendars,
  uid VARCHAR(255) UNIQUE,
  ical_data TEXT,                   -- raw iCalendar source of truth
  summary TEXT,
  description TEXT,
  location TEXT,
  dtstart TIMESTAMPTZ,
  dtend TIMESTAMPTZ,
  rrule TEXT,
  organizer VARCHAR(255),
  attendees JSONB,
  status VARCHAR(20),
  transparency VARCHAR(20),
  etag VARCHAR(64),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

#### Contacts (CardDAV + JMAP)

```sql
mailserver.card_addressbooks (
  id UUID PK,
  account_id UUID FK → accounts,
  name VARCHAR(255),
  description TEXT,
  ctag VARCHAR(64),
  is_default BOOL DEFAULT false,
  created_at TIMESTAMPTZ
)

mailserver.card_contacts (
  id UUID PK,
  addressbook_id UUID FK → card_addressbooks,
  uid VARCHAR(255) UNIQUE,
  vcard_data TEXT,                  -- raw vCard source of truth
  display_name VARCHAR(255),
  emails JSONB,
  phones JSONB,
  organization VARCHAR(255),
  etag VARCHAR(64),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

#### DMARC Reports

```sql
mailserver.dmarc_reports (
  id UUID PK,
  domain_id UUID FK → domains,
  reporter_org VARCHAR(255),
  report_xml TEXT,
  date_range_begin TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

#### Critical Indexes

```sql
CREATE INDEX idx_mc_text_search ON mailserver.message_contents USING GIN(text_search);
CREATE INDEX idx_mc_embedding ON mailserver.message_contents USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_mm_uid ON mailserver.message_mailboxes(mailbox_id, uid);
CREATE INDEX idx_mm_modseq ON mailserver.message_mailboxes(mailbox_id, modseq);
CREATE INDEX idx_msg_thread ON mailserver.messages(thread_id, received_at);
CREATE INDEX idx_queue_retry ON mailserver.queue(status, next_retry_at) WHERE status IN ('queued','deferred');
CREATE INDEX idx_cal_events_calendar ON mailserver.cal_events(calendar_id, updated_at);
```

---

## Crate APIs

### signapps-smtp
```rust
SmtpSession::new(config) → session
session.feed_line(bytes) → Vec<SmtpAction>
// SmtpAction::Reply | SendData | StartTls | Authenticate | Deliver
```

### signapps-imap
```rust
ImapSession::new(capabilities) → session
session.process(bytes) → Vec<ImapResponse>
// ImapResponse::Data | Tagged | Continue
```

### signapps-jmap
```rust
JmapRequest::parse(json) → Vec<MethodCall>
JmapProcessor::execute(calls, store) → JmapResponse
```

### signapps-sieve
```rust
SieveScript::compile(source) → Result<CompiledScript>
script.execute(message, context) → Vec<SieveAction>
// SieveAction::Keep | FileInto | Redirect | Reject | Vacation
```

### signapps-dkim
```rust
DkimSigner::new(key, selector, domain).sign(message) → signed
DkimVerifier::verify(message, dns) → DkimResult
SpfChecker::check(ip, domain, sender, dns) → SpfResult
DmarcChecker::evaluate(spf, dkim, from, dns) → DmarcResult
```

### signapps-spam
```rust
SpamChecker::new(config).check(message, context) → SpamVerdict
// SpamVerdict { score, tests, action: Accept|Quarantine|Reject }
```

### signapps-mime
```rust
MimeMessage::parse(bytes) → Result<MimeMessage>
message.text_body() / .html_body() / .attachments() / .body_structure()
MimeBuilder::new().from().to().subject().text().build() → Vec<u8>
```

### signapps-dav
```rust
DavRequest::parse(method, headers, body) → DavOperation
CalDavProcessor::handle(op, store) → DavResponse
CardDavProcessor::handle(op, store) → DavResponse
```

---

## Security

### Authentication
- REST/JMAP: JWT Bearer (existing SignApps auth)
- IMAP/SMTP/Sieve/DAV: SASL PLAIN, LOGIN, XOAUTH2
- All verify against mailserver.accounts.password_hash (Argon2id) or OAuth2 token
- Rate limiting: 10 attempts/min per IP, auto-block after 20 failures

### Anti-spam Pipeline
```
Scoring (parallel):
  DNSBL check         → +3 to +8
  SPF/DKIM/DMARC      → -2 (pass) or +5 (fail)
  Greylisting          → defer 5 min first time
  Header analysis      → +1 to +5
  URL blacklist        → +4 per URL
  Bayesian local       → -3 to +5
  Pyzor hash           → +8
  LLM classification   → -2 to +6

Decision:
  < 3.0  → HAM (deliver to INBOX)
  3-6    → SUSPECT (deliver, mark X-Spam)
  6-10   → QUARANTINE (Junk folder)
  > 10   → REJECT (550)
```

### DNS Auto-Configuration
When adding a domain, auto-generate:
- DKIM key pair (RSA-2048 or Ed25519)
- DNS records via signapps-securelink: MX, SPF, DKIM, DMARC, MTA-STS
- Verify DNS propagation
- ACME certificate via signapps-proxy

### TLS
- Port 25: STARTTLS opportunistic
- Port 587: STARTTLS mandatory before AUTH
- Port 993: TLS implicit (IMAPS)
- Port 4190: STARTTLS mandatory
- Port 8443: TLS implicit (HTTPS)

---

## Multi-Tenancy

- One tenant can have multiple domains (Option B)
- mailserver.domains.tenant_id links to identity.tenants
- Cross-domain aliases within same tenant
- Per-tenant quotas and account limits
- Tenant admins manage their own domains/accounts

---

## Observability

### Prometheus Metrics
```
signapps_mail_smtp_received_total{domain,status}
signapps_mail_smtp_sent_total{domain,status}
signapps_mail_smtp_queue_size
signapps_mail_spam_score_histogram{verdict}
signapps_mail_imap_connections_active
signapps_mail_imap_commands_total{command}
signapps_mail_jmap_requests_total{method}
signapps_mail_storage_bytes{domain}
signapps_mail_dkim_results{domain,result}
signapps_mail_dmarc_results{domain,policy}
```

### Webhooks
- message.received → push notification
- message.bounced → admin alert
- spam.quarantined → user notification
- queue.stuck → ops alert (>1h in queue)
- account.quota_warning → 80%/90%/100% notification

---

## Implementation Plan

### Sprint 1 (Week 1-2): Foundations
- PostgreSQL migration mailserver.* schema
- Crate signapps-mime (MIME parser)
- Crate signapps-dkim (sign/verify + SPF)
- Restructure signapps-mail main.rs multi-listener

### Sprint 2 (Week 3-4): SMTP
- Crate signapps-smtp (state machine)
- SMTP inbound (port 25)
- SMTP submission (port 587)
- Queue worker (DNS MX + retry)
- DKIM signing + SPF/DMARC verification

### Sprint 3 (Week 5-6): IMAP
- Crate signapps-imap (parser + state machine)
- IMAP server (port 993)
- Commands: LOGIN, SELECT, FETCH, SEARCH, STORE, COPY, MOVE
- IMAP IDLE via PostgreSQL LISTEN/NOTIFY
- CONDSTORE/QRESYNC

### Sprint 4 (Week 7-8): JMAP + Frontend
- Crate signapps-jmap (core + mail)
- JMAP endpoints in signapps-mail
- Migrate frontend from custom REST → JMAP
- Threads, SearchSnippets

### Sprint 5 (Week 9-10): CalDAV/CardDAV
- Crate signapps-dav (WebDAV + CalDAV + CardDAV)
- iCalendar/vCard parser
- Integration with existing calendar.*
- Bidirectional CalDAV ↔ signapps-calendar sync

### Sprint 6 (Week 11-12): Anti-spam + Sieve + Polish
- Crate signapps-spam (scoring pipeline)
- Crate signapps-sieve (parser + executor)
- ManageSieve server (port 4190)
- DNS auto (securelink integration)
- RAG embeddings
- Admin UI (domains, queue, metrics)
- E2E tests

---

## License

All code produced under **MIT License** — no AGPL, no GPL, no copyleft.
Clean-room implementation inspired by Stalwart's architecture but with zero code reuse.
