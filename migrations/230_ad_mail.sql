-- migrations/230_ad_mail.sql
-- User mail aliases and shared OU/Group mailboxes (IMAP folders)

CREATE TABLE ad_mail_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id UUID NOT NULL REFERENCES ad_user_accounts(id) ON DELETE CASCADE,
    mail_address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mail_address)
);

CREATE INDEX idx_mail_aliases_user ON ad_mail_aliases(user_account_id);

CREATE TABLE ad_shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ou_id UUID REFERENCES ad_ous(id) ON DELETE CASCADE,
    group_id UUID REFERENCES ad_security_groups(id) ON DELETE CASCADE,
    mail_address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id),
    display_name TEXT NOT NULL,
    config JSONB DEFAULT '{"shared_mailbox_enabled":true,"shared_mailbox_visible_to_children":true,"shared_mailbox_send_as":"members","shared_mailbox_auto_subscribe":true}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mail_address),
    CHECK (ou_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX idx_shared_mbox_ou ON ad_shared_mailboxes(ou_id);
CREATE INDEX idx_shared_mbox_group ON ad_shared_mailboxes(group_id);

CREATE TABLE ad_shared_mailbox_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES ad_shared_mailboxes(id) ON DELETE CASCADE,
    user_account_id UUID NOT NULL REFERENCES ad_user_accounts(id) ON DELETE CASCADE,
    imap_folder_path TEXT NOT NULL,
    can_send_as BOOLEAN DEFAULT false,
    is_subscribed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mailbox_id, user_account_id)
);

CREATE INDEX idx_mbox_sub_user ON ad_shared_mailbox_subscriptions(user_account_id);
CREATE INDEX idx_mbox_sub_mailbox ON ad_shared_mailbox_subscriptions(mailbox_id);
