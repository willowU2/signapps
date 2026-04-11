-- 275_mail_org_aware.sql
-- Mail org-aware: naming rules, distribution lists, shared mailboxes, portal messages

-- 1. Naming rules (inherited in org tree)
CREATE TABLE IF NOT EXISTS mailserver.naming_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL,
    pattern TEXT NOT NULL DEFAULT '{first_name}.{last_name}',
    domain_id UUID REFERENCES mailserver.domains(id),
    collision_strategy TEXT DEFAULT 'append_number'
        CHECK (collision_strategy IN ('append_number', 'append_initial', 'manual')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(node_id)
);
CREATE INDEX IF NOT EXISTS idx_naming_rules_node ON mailserver.naming_rules(node_id);

-- 2. Distribution lists (auto from org nodes)
CREATE TABLE IF NOT EXISTS mailserver.distribution_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL,
    address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id),
    description TEXT,
    allow_external_senders BOOLEAN DEFAULT false,
    is_auto BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(address)
);
CREATE INDEX IF NOT EXISTS idx_distlist_node ON mailserver.distribution_lists(node_id);

-- 3. Shared mailboxes
CREATE TABLE IF NOT EXISTS mailserver.shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL,
    display_name TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id),
    description TEXT,
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_reply_subject TEXT,
    auto_reply_body TEXT,
    quota_bytes BIGINT DEFAULT 5368709120,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(address)
);

CREATE TABLE IF NOT EXISTS mailserver.shared_mailbox_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_mailbox_id UUID NOT NULL REFERENCES mailserver.shared_mailboxes(id) ON DELETE CASCADE,
    person_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'sender', 'manager')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shared_mailbox_id, person_id)
);

-- 4. Portal messages
CREATE TABLE IF NOT EXISTS mail.portal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID,
    from_person_id UUID NOT NULL,
    from_context_type TEXT NOT NULL,
    to_person_id UUID NOT NULL,
    to_context_type TEXT NOT NULL,
    company_id UUID,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_text TEXT,
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_portal_msg_to ON mail.portal_messages(to_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_from ON mail.portal_messages(from_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_thread ON mail.portal_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_portal_msg_company ON mail.portal_messages(company_id);

-- 5. Enrich mailserver.accounts with org link
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS person_id UUID;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS naming_rule_id UUID REFERENCES mailserver.naming_rules(id);

-- 6. Enrich mailserver.aliases with auto flag
ALTER TABLE mailserver.aliases ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
ALTER TABLE mailserver.aliases ADD COLUMN IF NOT EXISTS source_node_id UUID;
