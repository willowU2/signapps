-- Trash: unified soft-delete tracking
CREATE TABLE IF NOT EXISTS identity.trash (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'file', 'document', 'spreadsheet', 'email', 'event', 'task', 'contact', 'form', 'note', 'channel'
    entity_id UUID NOT NULL,
    entity_name TEXT NOT NULL,
    module TEXT NOT NULL, -- 'storage', 'docs', 'sheets', 'mail', 'calendar', 'tasks', 'contacts', 'forms', 'keep', 'chat'
    deleted_by UUID NOT NULL REFERENCES identity.users(id),
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    metadata JSONB DEFAULT '{}',
    UNIQUE(entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_by ON identity.trash(deleted_by);
CREATE INDEX IF NOT EXISTS idx_trash_expires ON identity.trash(expires_at);

-- Bookmarks: cross-module favorites
CREATE TABLE IF NOT EXISTS identity.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_name TEXT NOT NULL,
    module TEXT NOT NULL,
    collection_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON identity.bookmarks(user_id);

CREATE TABLE IF NOT EXISTS identity.bookmark_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
