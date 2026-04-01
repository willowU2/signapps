-- Migration 070: Macros, Designs, Quick Notes, Learning, DevOps tables

-- ============================================================
-- docs schema extensions
-- ============================================================

-- Sheet macros (per document)
CREATE TABLE IF NOT EXISTS docs.macros (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL DEFAULT '',
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macros_document_id ON docs.macros(document_id);

-- Design files
CREATE TABLE IF NOT EXISTS docs.designs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    name          TEXT NOT NULL,
    format_width  INT NOT NULL DEFAULT 1920,
    format_height INT NOT NULL DEFAULT 1080,
    pages         JSONB NOT NULL DEFAULT '[]',
    metadata      JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_designs_user_id ON docs.designs(user_id);

-- Quick notes (Drive sidebar)
CREATE TABLE IF NOT EXISTS docs.quick_notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_notes_user_id ON docs.quick_notes(user_id);

-- ============================================================
-- workforce schema extensions
-- ============================================================

CREATE SCHEMA IF NOT EXISTS workforce;

-- Learning courses
CREATE TABLE IF NOT EXISTS workforce.courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    modules     JSONB NOT NULL DEFAULT '[]',
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Course progress per user
CREATE TABLE IF NOT EXISTS workforce.course_progress (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id          UUID NOT NULL REFERENCES workforce.courses(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL,
    module_completions JSONB NOT NULL DEFAULT '{}',
    progress           INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status             TEXT NOT NULL DEFAULT 'not_started'
                           CHECK (status IN ('not_started', 'in_progress', 'completed')),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_course_id ON workforce.course_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_user_id   ON workforce.course_progress(user_id);

-- ============================================================
-- ops schema
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ops;

-- Changelog entries
CREATE TABLE IF NOT EXISTS ops.changelog (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version     TEXT NOT NULL,
    change_type TEXT NOT NULL DEFAULT 'improvement'
                    CHECK (change_type IN ('feature', 'fix', 'improvement', 'breaking', 'security')),
    description TEXT NOT NULL,
    author      TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_changelog_created_at ON ops.changelog(created_at DESC);

-- CI/CD pipelines
CREATE TABLE IF NOT EXISTS ops.pipelines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name    TEXT NOT NULL,
    branch       TEXT NOT NULL DEFAULT 'main',
    status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_status     ON ops.pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON ops.pipelines(created_at DESC);

-- Deployments
CREATE TABLE IF NOT EXISTS ops.deployments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name   TEXT NOT NULL,
    version        TEXT NOT NULL,
    commit_message TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'deploying', 'success', 'failed', 'rolled_back')),
    deployed_by    UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_service_name ON ops.deployments(service_name);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at   ON ops.deployments(created_at DESC);
