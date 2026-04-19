-- SO1 W1 / Task 1 — Foundations data org avancée.
--
-- Ajoute 4 tables + 5 triggers d'audit pour supporter :
--   * Positions & incumbents (séparation siège / occupant)
--   * Audit log générique (piste d'historique, time-travel)
--   * Délégations temporaires (manager + rbac scope)
--
-- Les 3 axes (structure | focus | group) existent déjà en colonne
-- `org_assignments.axis` (migration 403). SO1 ne change pas le schéma
-- des assignments — seulement peuple les axes focus/group via le seeder
-- et ajoute un endpoint filter côté service.
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- Positions : poste typé par node avec nombre de sièges (head_count).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_positions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    node_id     UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    head_count  INTEGER NOT NULL DEFAULT 1 CHECK (head_count >= 0),
    attributes  JSONB NOT NULL DEFAULT '{}'::jsonb,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_positions_node   ON org_positions(node_id);
CREATE INDEX IF NOT EXISTS idx_org_positions_tenant ON org_positions(tenant_id);

-- Incumbents : qui occupe quel siège, avec bornes temporelles.
CREATE TABLE IF NOT EXISTS org_position_incumbents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    position_id UUID NOT NULL REFERENCES org_positions(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    start_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date    DATE,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(position_id, person_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_org_pos_incumbents_position ON org_position_incumbents(position_id);
CREATE INDEX IF NOT EXISTS idx_org_pos_incumbents_person   ON org_position_incumbents(person_id);
CREATE INDEX IF NOT EXISTS idx_org_pos_incumbents_tenant   ON org_position_incumbents(tenant_id);

-- ─────────────────────────────────────────────────────────────────────
-- Audit log : une ligne par write sur les 5 tables org_* auditées.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_audit_log (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      UUID NOT NULL,
    actor_user_id  UUID,
    entity_type    TEXT NOT NULL,
    entity_id      UUID NOT NULL,
    action         TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
    diff_json      JSONB NOT NULL,
    at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_entity    ON org_audit_log(entity_type, entity_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_tenant_at ON org_audit_log(tenant_id, at DESC);

-- Trigger générique — auto-log chaque INSERT/UPDATE/DELETE.
-- Le `tenant_id` doit être présent sur NEW/OLD (toutes nos tables org_*
-- portent la colonne). L'`actor_user_id` est absent (les triggers SQL ne
-- voient pas le contexte applicatif). Les handlers qui ont besoin
-- d'identifier l'acteur peuvent écrire un row supplémentaire
-- `org_audit_log` directement (ex: /org/delegations POST).
CREATE OR REPLACE FUNCTION org_audit_trigger() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_entity_type TEXT := TG_TABLE_NAME;
    v_entity_id   UUID;
    v_tenant      UUID;
    v_diff        JSONB;
    v_action      TEXT := lower(TG_OP);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id;
        v_tenant    := OLD.tenant_id;
        v_diff      := to_jsonb(OLD);
    ELSIF TG_OP = 'UPDATE' THEN
        v_entity_id := NEW.id;
        v_tenant    := NEW.tenant_id;
        v_diff      := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    ELSE -- INSERT
        v_entity_id := NEW.id;
        v_tenant    := NEW.tenant_id;
        v_diff      := to_jsonb(NEW);
    END IF;

    INSERT INTO org_audit_log (tenant_id, entity_type, entity_id, action, diff_json)
    VALUES (v_tenant, v_entity_type, v_entity_id, v_action, v_diff);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS org_nodes_audit            ON org_nodes;
DROP TRIGGER IF EXISTS org_persons_audit          ON org_persons;
DROP TRIGGER IF EXISTS org_assignments_audit      ON org_assignments;
DROP TRIGGER IF EXISTS org_positions_audit        ON org_positions;
DROP TRIGGER IF EXISTS org_pos_incumbents_audit   ON org_position_incumbents;

CREATE TRIGGER org_nodes_audit          AFTER INSERT OR UPDATE OR DELETE ON org_nodes
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_persons_audit        AFTER INSERT OR UPDATE OR DELETE ON org_persons
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_assignments_audit    AFTER INSERT OR UPDATE OR DELETE ON org_assignments
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_positions_audit      AFTER INSERT OR UPDATE OR DELETE ON org_positions
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_pos_incumbents_audit AFTER INSERT OR UPDATE OR DELETE ON org_position_incumbents
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- ─────────────────────────────────────────────────────────────────────
-- Délégations temporaires.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_delegations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    delegator_person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    delegate_person_id  UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    node_id             UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
    scope               TEXT NOT NULL CHECK (scope IN ('manager','rbac','all')),
    start_at            TIMESTAMPTZ NOT NULL,
    end_at              TIMESTAMPTZ NOT NULL,
    reason              TEXT,
    active              BOOLEAN NOT NULL DEFAULT true,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_at < end_at),
    CHECK (delegator_person_id <> delegate_person_id)
);

CREATE INDEX IF NOT EXISTS idx_org_delegations_delegator    ON org_delegations(delegator_person_id, active) WHERE active;
CREATE INDEX IF NOT EXISTS idx_org_delegations_delegate     ON org_delegations(delegate_person_id, active) WHERE active;
CREATE INDEX IF NOT EXISTS idx_org_delegations_tenant_end   ON org_delegations(tenant_id, end_at) WHERE active;
