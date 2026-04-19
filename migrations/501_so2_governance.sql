-- SO2 W1 / Task 1 — Governance data layer.
--
-- Ajoute 3 tables + 3 triggers d'audit pour supporter :
--   * RACI matrix (responsible / accountable / consulted / informed)
--   * Board decisions (proposition → approved/rejected/deferred)
--   * Board votes (one per person per decision)
--
-- La fonction `org_audit_trigger()` est définie par migration 500
-- (SO1 foundations). Ici on se contente d'attacher 3 triggers
-- supplémentaires aux nouvelles tables.
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- RACI — matrix Projet × Personne × Rôle (R/A/C/I).
-- Contrainte supplémentaire : au plus UN accountable par projet.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_raci (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    project_id  UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    role        VARCHAR(16) NOT NULL
        CHECK (role IN ('responsible','accountable','consulted','informed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, person_id, role)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raci_one_accountable
    ON org_raci(project_id)
    WHERE role = 'accountable';
CREATE INDEX IF NOT EXISTS idx_raci_project ON org_raci(project_id);
CREATE INDEX IF NOT EXISTS idx_raci_person  ON org_raci(person_id);
CREATE INDEX IF NOT EXISTS idx_raci_tenant  ON org_raci(tenant_id);

-- ─────────────────────────────────────────────────────────────────────
-- Board decisions — une décision (proposée, approuvée, rejetée, reportée)
-- est rattachée à un board. Le board identifie le tenant via son node.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_board_decisions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    board_id              UUID NOT NULL REFERENCES org_boards(id) ON DELETE CASCADE,
    title                 VARCHAR(255) NOT NULL,
    description           TEXT,
    status                VARCHAR(16) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed','approved','rejected','deferred')),
    decided_at            TIMESTAMPTZ,
    decided_by_person_id  UUID REFERENCES org_persons(id) ON DELETE SET NULL,
    attributes            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_board  ON org_board_decisions(board_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON org_board_decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON org_board_decisions(tenant_id);

-- ─────────────────────────────────────────────────────────────────────
-- Board votes — un vote par personne par décision.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_board_votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    decision_id  UUID NOT NULL REFERENCES org_board_decisions(id) ON DELETE CASCADE,
    person_id    UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    vote         VARCHAR(8) NOT NULL
        CHECK (vote IN ('for','against','abstain')),
    rationale    TEXT,
    voted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (decision_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_decision ON org_board_votes(decision_id);
CREATE INDEX IF NOT EXISTS idx_votes_person   ON org_board_votes(person_id);
CREATE INDEX IF NOT EXISTS idx_votes_tenant   ON org_board_votes(tenant_id);

-- ─────────────────────────────────────────────────────────────────────
-- Audit triggers — attach to the 3 new tables. Function `org_audit_trigger()`
-- is defined by migration 500.
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS org_raci_audit              ON org_raci;
DROP TRIGGER IF EXISTS org_board_decisions_audit   ON org_board_decisions;
DROP TRIGGER IF EXISTS org_board_votes_audit       ON org_board_votes;

CREATE TRIGGER org_raci_audit            AFTER INSERT OR UPDATE OR DELETE ON org_raci
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_board_decisions_audit AFTER INSERT OR UPDATE OR DELETE ON org_board_decisions
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_board_votes_audit     AFTER INSERT OR UPDATE OR DELETE ON org_board_votes
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
