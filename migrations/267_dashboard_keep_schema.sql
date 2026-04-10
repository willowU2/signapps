-- Dashboard widget layouts
CREATE TABLE IF NOT EXISTS identity.dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    widgets JSONB NOT NULL DEFAULT '[]', -- [{widget_type, x, y, w, h, config}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Keep notes
CREATE SCHEMA IF NOT EXISTS keep;

CREATE TABLE IF NOT EXISTS keep.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    color TEXT DEFAULT 'default', -- 12 color options
    pinned BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    is_checklist BOOLEAN DEFAULT false,
    checklist_items JSONB DEFAULT '[]', -- [{id, text, checked, order}]
    labels TEXT[] DEFAULT '{}',
    reminder_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_keep_notes_owner ON keep.notes(owner_id, deleted_at);

CREATE TABLE IF NOT EXISTS keep.labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(owner_id, name)
);
