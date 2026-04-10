-- 266: Global search schema — history and saved searches
CREATE SCHEMA IF NOT EXISTS search;

CREATE TABLE IF NOT EXISTS search.history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    scope TEXT DEFAULT 'all', -- 'all', 'files', 'docs', 'mail', 'contacts', 'tasks', 'calendar'
    result_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search.history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search.saved (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    scope TEXT DEFAULT 'all',
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_saved_user ON search.saved(user_id, created_at DESC);
