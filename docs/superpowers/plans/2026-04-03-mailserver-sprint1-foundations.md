# Mail Server Sprint 1: Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the PostgreSQL schema, MIME parser crate, DKIM crate, and restructure signapps-mail for multi-port listening.

**Architecture:** 3 new crates (`signapps-mime`, `signapps-dkim`, `signapps-smtp`) as pure Rust libraries with no I/O. Database migration creates the `mailserver` schema. `signapps-mail` gets a multi-listener main.rs that spawns TCP servers on ports 25, 587, 993 alongside the existing Axum HTTP on 3012.

**Tech Stack:** Rust 1.75+, tokio, sqlx, sha2, rsa, ed25519-dalek, trust-dns-resolver, base64, nom (parsing)

---

## Task 1: PostgreSQL Migration — `mailserver` schema

**Files:**
- Create: `migrations/200_mailserver_schema.sql`

- [ ] **Step 1: Write the migration SQL**

Create the complete `mailserver` schema with all tables from the design spec: domains, accounts, aliases, message_contents, messages, message_mailboxes, mailboxes, attachments, threads, queue, sieve_scripts, cal_calendars, cal_events, card_addressbooks, card_contacts, dmarc_reports, plus all indexes.

- [ ] **Step 2: Apply the migration**

```bash
docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/200_mailserver_schema.sql
```

Expected: All CREATE TABLE/INDEX statements succeed.

- [ ] **Step 3: Verify**

```bash
docker exec signapps-postgres psql -U signapps -d signapps -c "\dt mailserver.*"
```

Expected: 16 tables listed.

- [ ] **Step 4: Commit**

```bash
git add migrations/200_mailserver_schema.sql
git commit -m "feat(db): add mailserver schema — domains, messages, mailboxes, queue, calendar, contacts"
```

---

## Task 2: Crate `signapps-mime` — MIME parser

**Files:**
- Create: `crates/signapps-mime/Cargo.toml`
- Create: `crates/signapps-mime/src/lib.rs`
- Create: `crates/signapps-mime/src/parser.rs` — RFC 2045/2046 MIME parsing
- Create: `crates/signapps-mime/src/headers.rs` — RFC 5322 header parsing
- Create: `crates/signapps-mime/src/encoding.rs` — base64, quoted-printable, RFC 2047
- Create: `crates/signapps-mime/src/builder.rs` — construct MIME messages
- Create: `crates/signapps-mime/src/body_structure.rs` — IMAP BODYSTRUCTURE builder
- Modify: `Cargo.toml` (workspace) — add member

### Subtask 2a: Scaffold crate + header parser

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "signapps-mime"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
base64 = "0.22"
sha2 = "0.10"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }

[dev-dependencies]
```

- [ ] **Step 2: Write header parser with tests**

Parse RFC 5322 headers: unfold continuation lines, decode RFC 2047 encoded words, extract structured headers (From, To, Subject, Date, Message-ID, Content-Type, List-Unsubscribe, etc.).

Tests: parse simple header, folded header, RFC 2047 UTF-8 subject, multiple recipients.

- [ ] **Step 3: Add to workspace and build**

```bash
# Add "crates/signapps-mime" to workspace members in Cargo.toml
rtk cargo build -p signapps-mime
rtk cargo test -p signapps-mime
```

- [ ] **Step 4: Commit**

### Subtask 2b: MIME body parser

- [ ] **Step 1: Write MIME multipart parser with tests**

Parse Content-Type boundaries, extract parts recursively, handle multipart/mixed, multipart/alternative, multipart/related. Decode quoted-printable and base64 bodies.

Tests: simple text email, multipart/alternative (text+html), nested multipart with attachment, base64 attachment extraction.

- [ ] **Step 2: Build BODYSTRUCTURE generator**

Convert parsed MIME tree to JSON matching IMAP BODYSTRUCTURE format.

- [ ] **Step 3: Commit**

### Subtask 2c: MIME builder

- [ ] **Step 1: Write MimeBuilder with tests**

Fluent API: `MimeBuilder::new().from(addr).to(addr).subject(s).text(body).html(html).attach(name, data, content_type).build() → Vec<u8>`

Tests: build simple text email, text+html, with attachment, verify output is valid MIME.

- [ ] **Step 2: Commit**

---

## Task 3: Crate `signapps-dkim` — DKIM/SPF/DMARC

**Files:**
- Create: `crates/signapps-dkim/Cargo.toml`
- Create: `crates/signapps-dkim/src/lib.rs`
- Create: `crates/signapps-dkim/src/dkim.rs` — sign and verify
- Create: `crates/signapps-dkim/src/spf.rs` — SPF check
- Create: `crates/signapps-dkim/src/dmarc.rs` — DMARC evaluation
- Create: `crates/signapps-dkim/src/keygen.rs` — RSA/Ed25519 key generation
- Modify: `Cargo.toml` (workspace) — add member

### Subtask 3a: DKIM signing

- [ ] **Step 1: Create crate with DKIM signer**

Implement RFC 6376 DKIM signing: canonicalize headers (relaxed), canonicalize body (relaxed), compute body hash (SHA-256), sign with RSA-SHA256 or Ed25519-SHA256, generate DKIM-Signature header.

Dependencies: `rsa`, `ed25519-dalek`, `sha2`, `base64`.

Tests: sign a test message, verify the DKIM-Signature header format is correct, round-trip sign → verify.

- [ ] **Step 2: DKIM verification**

Parse DKIM-Signature header, extract selector/domain, simulate DNS lookup (trait-based for testing), verify signature against public key.

Tests: verify a self-signed message, reject a tampered message.

- [ ] **Step 3: Commit**

### Subtask 3b: SPF checker

- [ ] **Step 1: SPF record parser + evaluator**

Parse SPF TXT records (`v=spf1 mx ip4:1.2.3.0/24 include:_spf.google.com ~all`). Evaluate against sender IP.

DNS lookup via trait `DnsResolver` (mockable for tests).

Results: Pass, Fail, SoftFail, Neutral, None, TempError, PermError.

Tests: ip4 match, ip6 match, mx mechanism, include, redirect, ~all vs -all.

- [ ] **Step 2: Commit**

### Subtask 3c: DMARC evaluator

- [ ] **Step 1: DMARC policy parser + evaluator**

Parse DMARC TXT record (`v=DMARC1; p=reject; rua=mailto:...`). Evaluate alignment: SPF domain aligns with From header? DKIM domain aligns with From header? Apply policy (none/quarantine/reject).

Tests: SPF+DKIM pass → DMARC pass, DKIM fail + SPF pass aligned → pass, both fail → apply policy.

- [ ] **Step 2: Key generation utility**

Generate RSA-2048 and Ed25519 key pairs for DKIM. Output PEM private key + DNS TXT record value.

- [ ] **Step 3: Commit**

---

## Task 4: Crate `signapps-smtp` — SMTP protocol

**Files:**
- Create: `crates/signapps-smtp/Cargo.toml`
- Create: `crates/signapps-smtp/src/lib.rs`
- Create: `crates/signapps-smtp/src/parser.rs` — command parser
- Create: `crates/signapps-smtp/src/session.rs` — state machine
- Create: `crates/signapps-smtp/src/reply.rs` — response codes
- Create: `crates/signapps-smtp/src/auth.rs` — SASL PLAIN/LOGIN/XOAUTH2
- Create: `crates/signapps-smtp/src/envelope.rs` — MAIL FROM/RCPT TO
- Modify: `Cargo.toml` (workspace) — add member

### Subtask 4a: SMTP command parser

- [ ] **Step 1: Parse SMTP commands**

Parse: EHLO, HELO, MAIL FROM, RCPT TO, DATA, QUIT, RSET, NOOP, STARTTLS, AUTH. Handle parameters (SIZE=, BODY=8BITMIME, AUTH=).

Tests: parse EHLO, MAIL FROM with angle brackets, RCPT TO, AUTH PLAIN with base64 credentials.

- [ ] **Step 2: Commit**

### Subtask 4b: SMTP state machine

- [ ] **Step 1: Implement SmtpSession state machine**

States: Connected → Greeted → MailFrom → RcptTo → Data → Done.
`session.feed_line(bytes) → Vec<SmtpAction>`.
Actions: Reply(code, text), StartTls, Authenticate(mechanism, initial_response), Deliver(envelope, data).

Validate transitions: MAIL FROM only after EHLO, RCPT TO only after MAIL FROM, DATA only after at least one RCPT TO.

Tests: happy path EHLO→MAIL→RCPT→DATA→QUIT, invalid sequence errors, multiple RCPT TO, RSET resets state.

- [ ] **Step 2: EHLO capabilities response**

Generate 250-EHLO response with: PIPELINING, SIZE 52428800, 8BITMIME, STARTTLS, AUTH PLAIN LOGIN XOAUTH2, ENHANCEDSTATUSCODES.

- [ ] **Step 3: Commit**

### Subtask 4c: SASL authentication

- [ ] **Step 1: SASL PLAIN and LOGIN parser**

PLAIN: decode base64 → split by \0 → (authzid, authcid, password).
LOGIN: two-step challenge (Username:, Password:).
XOAUTH2: decode base64 → extract user + token.

Tests: PLAIN with valid credentials, LOGIN two-step, XOAUTH2 bearer token extraction.

- [ ] **Step 2: Commit**

---

## Task 5: Multi-listener `signapps-mail` restructure

**Files:**
- Modify: `services/signapps-mail/src/main.rs` — multi-port listener
- Create: `services/signapps-mail/src/state.rs` — shared MailServerState
- Create: `services/signapps-mail/src/smtp/mod.rs` — SMTP server stub
- Create: `services/signapps-mail/src/smtp/inbound.rs` — port 25 listener
- Create: `services/signapps-mail/src/smtp/submission.rs` — port 587 listener
- Create: `services/signapps-mail/src/imap/mod.rs` — IMAP server stub
- Create: `services/signapps-mail/src/imap/server.rs` — port 993 listener stub
- Modify: `services/signapps-mail/Cargo.toml` — add new crate dependencies

### Subtask 5a: MailServerState + multi-listener main.rs

- [ ] **Step 1: Create shared state**

```rust
// state.rs
pub struct MailServerState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub cache: CacheService,
    pub event_bus: PgEventBus,
    pub indexer: AiIndexerClient,
}
```

- [ ] **Step 2: Restructure main.rs for multi-port**

Keep existing Axum HTTP on port 3012. Add `tokio::spawn` for SMTP inbound (25), SMTP submission (587), IMAP (993). Each spawns a `TcpListener::bind` loop. Initially just accept connections and respond with a banner then close.

```rust
tokio::join!(
    http_server(state.clone(), port),      // existing Axum
    smtp_inbound_stub(state.clone(), 25),  // new
    smtp_submission_stub(state.clone(), 587), // new
    imap_stub(state.clone(), 993),         // new
);
```

- [ ] **Step 3: SMTP inbound stub (port 25)**

Accept TCP, send `220 signapps.local ESMTP ready\r\n`, read one line, reply `221 Bye\r\n`, close. Just enough to verify the port works.

- [ ] **Step 4: IMAP stub (port 993)**

Accept TCP (no TLS for now in dev), send `* OK IMAP4rev2 signapps ready\r\n`, read one line, reply `* BYE\r\n`, close.

- [ ] **Step 5: Build and test**

```bash
rtk cargo build -p signapps-mail
# Start service, verify 4 ports respond:
# curl http://localhost:3012/health
# echo "QUIT" | nc localhost 25
# echo "QUIT" | nc localhost 587
# echo "LOGOUT" | nc localhost 993
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mail): multi-listener foundation — SMTP/IMAP stubs on ports 25/587/993"
```

---

## Task 6: Database models in signapps-db

**Files:**
- Create: `crates/signapps-db/src/models/mailserver.rs` — all mailserver models
- Create: `crates/signapps-db/src/repositories/mailserver_repo.rs` — CRUD operations
- Modify: `crates/signapps-db/src/models/mod.rs` — register module
- Modify: `crates/signapps-db/src/repositories/mod.rs` — register module

- [ ] **Step 1: Define Rust models matching the schema**

Domain, Account, Alias, MessageContent, Message, MessageMailbox, Mailbox, Attachment, Thread, QueueEntry, SieveScript, CalCalendar, CalEvent, CardAddressbook, CardContact, DmarcReport.

All derive `Debug, Clone, Serialize, Deserialize, sqlx::FromRow`.

- [ ] **Step 2: Basic repository — Domain CRUD**

```rust
impl DomainRepository {
    pub async fn create(pool, domain) → Result<Domain>
    pub async fn get(pool, id) → Result<Domain>
    pub async fn list_by_tenant(pool, tenant_id) → Result<Vec<Domain>>
    pub async fn delete(pool, id) → Result<()>
}
```

- [ ] **Step 3: Basic repository — Account CRUD**

- [ ] **Step 4: Basic repository — Mailbox CRUD**

Including `create_default_mailboxes(account_id)` that creates INBOX, Sent, Drafts, Trash, Junk, Archive with proper special_use flags and uid_validity.

- [ ] **Step 5: Basic repository — Message insert + query**

Insert message_content (with dedup by hash), insert message, insert message_mailbox with UID allocation.

- [ ] **Step 6: Build and commit**

```bash
rtk cargo build -p signapps-db
git commit -m "feat(db): mailserver models and repositories — domains, accounts, mailboxes, messages"
```

---

## Completion Criteria

Sprint 1 is complete when:
1. `mailserver.*` schema exists in PostgreSQL with 16 tables
2. `signapps-mime` crate parses and builds MIME messages with tests passing
3. `signapps-dkim` crate signs/verifies DKIM, checks SPF/DMARC with tests passing
4. `signapps-smtp` crate parses SMTP commands and runs state machine with tests passing
5. `signapps-mail` listens on 4 ports (3012 + 25 + 587 + 993) with stub responses
6. `signapps-db` has all mailserver models and basic CRUD repositories
7. Full workspace builds with `rtk cargo build --workspace` — 0 errors
