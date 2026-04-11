# Mail Interne Org-Aware — Design Spec

## Summary

Enhance the internal mail server (Stalwart) to auto-provision mailboxes based on organizational structure. Email addresses are generated from inherited naming rules in the org tree. Each employee gets a mailbox automatically. Distribution lists are auto-generated per org node. Portal users communicate via a dedicated message channel that surfaces in employees' mail clients.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provisioning | **Automatic** — mailbox created on employee affiliation, address from org rules | Zero friction, Google Workspace model |
| Naming rules | **Inherited in org tree** — pattern + domain resolved by climbing up org_closure | Flexible per-department customization |
| Alias model | **Implicit** — all descendant domains available as send-from aliases | Managers can send from any team domain |
| Group mail | **Distribution lists (auto) + shared mailboxes (manual)** | Lists cover 80%, shared boxes for support/info@ |
| Portal comms | **Message channel** — portal users message via dedicated channel, appears in employee mail | No mail infra cost for external users |

## Data Model Changes

### New table: `mailserver.naming_rules`

```sql
CREATE TABLE IF NOT EXISTS mailserver.naming_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL DEFAULT '{first_name}.{last_name}',
    -- Pattern variables: {first_name}, {last_name}, {first_name[0]} (first letter),
    -- {last_name[0]}, {function}, {department}, {employee_number}
    -- Example patterns: '{first_name}.{last_name}', '{first_name[0]}{last_name}',
    -- 'support.{first_name}', '{function}.{first_name}.{last_name}'
    domain_id UUID REFERENCES mailserver.domains(id),
    -- If NULL, inherit domain from parent node
    collision_strategy TEXT DEFAULT 'append_number',
    -- 'append_number' (jean.dupont2), 'append_initial' (jean.m.dupont), 'manual'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(node_id)
);
CREATE INDEX IF NOT EXISTS idx_naming_rules_node ON mailserver.naming_rules(node_id);
```

### New table: `mailserver.distribution_lists`

```sql
CREATE TABLE IF NOT EXISTS mailserver.distribution_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    address TEXT NOT NULL, -- e.g. 'dev@it.signapps.com'
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id),
    description TEXT,
    allow_external_senders BOOLEAN DEFAULT false,
    is_auto BOOLEAN DEFAULT true, -- auto-generated from org node
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(address)
);
CREATE INDEX IF NOT EXISTS idx_distlist_node ON mailserver.distribution_lists(node_id);
```

### New table: `mailserver.shared_mailboxes`

```sql
CREATE TABLE IF NOT EXISTS mailserver.shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL, -- e.g. 'support@signapps.com'
    display_name TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id),
    description TEXT,
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_reply_subject TEXT,
    auto_reply_body TEXT,
    quota_bytes BIGINT DEFAULT 5368709120, -- 5GB
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(address)
);

CREATE TABLE IF NOT EXISTS mailserver.shared_mailbox_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_mailbox_id UUID NOT NULL REFERENCES mailserver.shared_mailboxes(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'sender', 'manager')),
    -- reader: can read emails in shared mailbox
    -- sender: can read + send from shared address
    -- manager: can read + send + manage members + configure
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shared_mailbox_id, person_id)
);
```

### New table: `mail.portal_messages`

```sql
CREATE TABLE IF NOT EXISTS mail.portal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID, -- groups replies together
    from_person_id UUID NOT NULL REFERENCES core.persons(id),
    from_context_type TEXT NOT NULL, -- 'employee', 'client', 'supplier'
    to_person_id UUID NOT NULL REFERENCES core.persons(id),
    to_context_type TEXT NOT NULL,
    company_id UUID REFERENCES core.companies(id), -- portal company context
    subject TEXT NOT NULL,
    body TEXT NOT NULL, -- HTML
    body_text TEXT, -- plaintext version
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]', -- [{name, size, url, mime_type}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_portal_msg_to ON mail.portal_messages(to_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_from ON mail.portal_messages(from_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_thread ON mail.portal_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_portal_msg_company ON mail.portal_messages(company_id);
```

### Alter `mailserver.accounts`

```sql
-- Link accounts to org structure
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES core.persons(id);
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS node_id UUID REFERENCES core.org_nodes(id);
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS naming_rule_id UUID REFERENCES mailserver.naming_rules(id);
```

### Alter `mailserver.aliases`

```sql
ALTER TABLE mailserver.aliases ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
-- Auto aliases are generated from descendant domains and regenerated on org changes
ALTER TABLE mailserver.aliases ADD COLUMN IF NOT EXISTS source_node_id UUID REFERENCES core.org_nodes(id);
```

## Auto-Provisioning Engine

### Trigger: PgEventBus `affiliation.created`

When a `core.person_companies` record is created with `role_in_company = 'employee'`:

```
1. Get person record (first_name, last_name, etc.)
2. Get assignment node_id from core.assignments (or use company root node)
3. Resolve naming rule:
   - Walk up org_closure from node_id
   - First node with a mailserver.naming_rules entry wins
   - If none found, use company-level default pattern '{first_name}.{last_name}'
4. Resolve domain:
   - Walk up org_closure from node_id
   - First node with naming_rule.domain_id set wins
   - Must find at least one (enforced: root company node must have domain)
5. Generate address:
   - Apply pattern: replace {first_name}, {last_name}, etc.
   - Normalize: lowercase, remove accents (e -> e, e -> e), replace spaces with dots
   - Check collision: if address exists, apply collision_strategy
6. Create mailserver.accounts:
   - address, user_id, person_id, node_id, is_auto_provisioned=true
   - Generate random password (user resets on first login)
   - Create default IMAP mailboxes (INBOX, Sent, Drafts, Trash, Junk, Archive)
7. Generate auto-aliases:
   - Query descendant domains via org_closure
   - For each descendant domain: create alias with same local part + descendant domain
   - Set is_auto=true, source_node_id
8. Emit PgEventBus: mailbox.provisioned {person_id, address, domain}
```

### Trigger: PgEventBus `assignment.changed`

When a person moves to a different org node:

```
1. Check if new node has a different naming rule or domain
2. If domain changed: add new alias with new domain (keep old as secondary)
3. If naming rule changed: optionally rename (admin config: rename_on_move = true|false)
4. Regenerate auto-aliases based on new position in tree
5. Update mailserver.accounts.node_id
```

### Address collision handling

```
Strategy: append_number (default)
  jean.dupont@signapps.com (taken)
  → jean.dupont2@signapps.com

Strategy: append_initial
  jean.dupont@signapps.com (taken)
  → jean.m.dupont@signapps.com (middle name initial)
  → jean.dupont.2@signapps.com (fallback if no middle name)

Strategy: manual
  → provisioning paused, admin notified to choose address
```

## Distribution Lists

### Auto-generation

When a domain is assigned to an org node, the system auto-creates a distribution list:

```
Node: "Equipe Dev" (code: "dev") + domain: it.signapps.com
→ Distribution list: dev@it.signapps.com
→ Members: all persons assigned to "Equipe Dev" node (via core.assignments)
```

### Member resolution (dynamic)

Distribution list members are NOT stored — they are resolved at SMTP delivery time:

```sql
SELECT DISTINCT a.email
FROM mailserver.accounts a
JOIN core.assignments ca ON ca.person_id = a.person_id
JOIN core.org_closure oc ON oc.descendant_id = ca.node_id
WHERE oc.ancestor_id = $node_id
  AND ca.end_date IS NULL
  AND a.is_active = true
```

This means adding/removing someone from an org node automatically updates their distribution list membership.

### SMTP expansion

When the mail server receives a message to a distribution list address:
1. Look up `mailserver.distribution_lists` by address
2. Resolve members via org_closure query
3. Expand to individual recipient addresses
4. Deliver to each member's mailbox
5. Add `List-Id` and `List-Unsubscribe` headers

## Shared Mailboxes

### Admin creation

```
POST /api/v1/mailserver/shared-mailboxes
{
  "address": "support@signapps.com",
  "display_name": "Support Technique",
  "domain_id": "...",
  "members": [
    {"person_id": "...", "role": "manager"},
    {"person_id": "...", "role": "sender"},
    {"person_id": "...", "role": "reader"}
  ]
}
```

### Access model

- **Reader**: sees all emails in the shared mailbox (read-only IMAP folder)
- **Sender**: can reply/compose from the shared address (shows in "Envoyer depuis" dropdown)
- **Manager**: full control + add/remove members + configure auto-reply

### IMAP integration

Shared mailbox appears as an additional IMAP namespace:
```
INBOX
Sent
Drafts
Shared/Support Technique/INBOX
Shared/Support Technique/Sent
```

## Portal Message Channel

### Architecture

Portal users (client/supplier context) communicate via `mail.portal_messages` — not real email. This appears seamlessly in the employee's mail client.

### Portal → Employee flow

1. Client Marie (portal context) composes a message in portal UI
2. System creates `mail.portal_messages` record
3. PgEventBus emits `portal.message.sent`
4. Mail service listener creates a synthetic email in the employee's mailbox:
   - From: `marie.dupont@portal.acme-client.signapps.local` (virtual address)
   - To: employee's real address
   - Headers: `X-SignApps-Portal: true`, `X-SignApps-Thread: {thread_id}`
5. Employee sees the message in a "Portail" folder in their mail client

### Employee → Portal flow

1. Employee replies to the synthetic email (or composes to a portal address)
2. Mail service intercepts outbound to `*.portal.*.signapps.local`
3. Creates `mail.portal_messages` record (reverse direction)
4. PgEventBus emits `portal.message.received`
5. Portal user sees the reply in their message inbox
6. Push notification sent to portal user

### Portal UI

Simple message interface in the portal sidebar:
- Inbox (unread badge)
- Compose (to: account manager or support)
- Thread view (conversation history)
- Attachments (upload/download)
- No folders, labels, or advanced mail features

## API Endpoints

### Naming Rules

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/mailserver/naming-rules | List all naming rules |
| GET | /api/v1/mailserver/naming-rules/resolve/:person_id | Preview resolved address for a person |
| POST | /api/v1/mailserver/naming-rules | Create rule for a node |
| PUT | /api/v1/mailserver/naming-rules/:id | Update rule |
| DELETE | /api/v1/mailserver/naming-rules/:id | Delete rule |

### Distribution Lists

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/mailserver/distribution-lists | List all |
| POST | /api/v1/mailserver/distribution-lists | Create manual list |
| GET | /api/v1/mailserver/distribution-lists/:id/members | Resolve current members |
| PUT | /api/v1/mailserver/distribution-lists/:id | Update |
| DELETE | /api/v1/mailserver/distribution-lists/:id | Delete |

### Shared Mailboxes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/mailserver/shared-mailboxes | List all |
| POST | /api/v1/mailserver/shared-mailboxes | Create |
| GET | /api/v1/mailserver/shared-mailboxes/:id | Get with members |
| PUT | /api/v1/mailserver/shared-mailboxes/:id | Update |
| DELETE | /api/v1/mailserver/shared-mailboxes/:id | Delete |
| POST | /api/v1/mailserver/shared-mailboxes/:id/members | Add member |
| DELETE | /api/v1/mailserver/shared-mailboxes/:id/members/:person_id | Remove member |

### Portal Messages

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/mail/portal-messages | List messages (filtered by context) |
| POST | /api/v1/mail/portal-messages | Send message |
| GET | /api/v1/mail/portal-messages/:id | Get message |
| PUT | /api/v1/mail/portal-messages/:id/read | Mark as read |
| GET | /api/v1/mail/portal-messages/threads/:thread_id | Get thread |
| GET | /api/v1/mail/portal-messages/unread-count | Unread count |

### Auto-Provisioning

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/mailserver/provision/:person_id | Manually trigger provisioning |
| GET | /api/v1/mailserver/provision/:person_id/preview | Preview what address would be generated |
| POST | /api/v1/mailserver/provision/bulk | Provision all unprovisioned employees |

## UI Integration

### Admin: /admin/mail-server (enriched)

**New tab: "Regles de nommage"**
- Tree view mirroring org structure
- Each node shows: inherited or local rule + domain
- Click node → edit pattern + domain + collision strategy
- Preview: shows example address for a sample person

**New tab: "Listes de distribution"**
- Table: address, node, member count (resolved), status
- Click → member list (dynamically resolved)
- Create manual list button

**New tab: "Boites partagees"**
- Table: address, display name, member count, quota usage
- Click → member management (add/remove, change roles)
- Create shared mailbox button

### Compose dialog enrichment

**"Envoyer depuis" dropdown:**
- Primary address (bold, default)
- Auto-aliases from descendant domains (grouped by domain)
- Shared mailbox addresses (if role = sender or manager)
- Visual separator between personal and shared

### Mail sidebar enrichment

**New folders:**
- "Portail" — virtual folder containing portal messages (synthetic emails)
- "Shared / [Mailbox Name]" — for each shared mailbox the user is member of

### Portal sidebar

**New module "Messages":**
- Inbox with unread badge
- Compose (simple: to, subject, body, attachments)
- Thread view
- No advanced features (no labels, rules, etc.)

### User settings: /settings/email (new page)

- Current email address + aliases list
- Quota usage bar (used / total)
- Default send-from address selector
- Sieve rules (visual builder → translates to Sieve)
- Signature editor (per alias)

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `mailbox.provisioned` | `{person_id, address, domain, account_id}` | Notifications, Welcome email |
| `mailbox.alias.added` | `{account_id, alias, domain, is_auto}` | Mail UI cache invalidation |
| `mailbox.deprovisioned` | `{person_id, address}` | Notifications, Audit |
| `distlist.members.changed` | `{list_id, address, member_count}` | SMTP expansion cache |
| `portal.message.sent` | `{from_person, to_person, thread_id}` | Mail service (create synthetic email), Notifications |
| `portal.message.received` | `{from_person, to_person, thread_id}` | Portal notifications, Push |
| `org.node.domain.changed` | `{node_id, old_domain, new_domain}` | Auto-alias regeneration |

## E2E Assertions

- Employee affiliation triggers automatic mailbox creation
- Generated address follows naming rule of closest org node
- Address collision appends number (jean.dupont2@)
- Compose dialog shows all descendant domain aliases
- Distribution list resolves members dynamically from org assignments
- Adding person to org node makes them member of distribution list
- Shared mailbox appears in IMAP namespace for members
- Shared mailbox sender can compose from shared address
- Portal message from client appears in employee's Portail folder
- Employee reply to portal message appears in client's portal inbox
- Admin naming rules page shows org tree with patterns
- User settings page shows address, aliases, quota
- Removing employee affiliation deactivates mailbox (not deletes)
