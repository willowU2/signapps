-- S1 W1 / Task 6 — Canonical `org_boards` + `org_board_members`.
--
-- One board per node thanks to UNIQUE (node_id). Members carry an
-- optional `is_decision_maker` flag — the API layer enforces "at
-- most one true per board" inside a transaction.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS org_boards (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id    UUID NOT NULL UNIQUE REFERENCES org_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_board_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id          UUID NOT NULL REFERENCES org_boards(id) ON DELETE CASCADE,
    person_id         UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    role              TEXT NOT NULL,
    is_decision_maker BOOLEAN NOT NULL DEFAULT false,
    sort_order        INT  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_org_board_members_board ON org_board_members(board_id);
