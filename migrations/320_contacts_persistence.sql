-- Contacts persistence — replaces the in-memory skeleton store.
-- Creates contacts, contact_groups, and contact_group_members tables.

CREATE TABLE IF NOT EXISTS contacts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL,
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    email        TEXT,
    phone        TEXT,
    organization TEXT,
    job_title    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_owner    ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email    ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_updated  ON contacts(updated_at DESC);

CREATE TABLE IF NOT EXISTS contact_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_groups_owner ON contact_groups(owner_id);

CREATE TABLE IF NOT EXISTS contact_group_members (
    group_id   UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id)       ON DELETE CASCADE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_cgm_group   ON contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_cgm_contact ON contact_group_members(contact_id);
