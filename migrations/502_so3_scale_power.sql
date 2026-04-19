-- SO3 W1 / Task 1 — Scale & Power tools data layer.
--
-- Ajoute 4 tables + 3 triggers d'audit + 2 GIN FTS indexes pour supporter :
--   * Templates d'org (4 built-in seedés par signapps-seed au boot)
--   * Headcount planning (plans trimestriels par OU)
--   * Skills & compétences (catalog + person-skills + endorsements)
--   * Full-text search (persons + nodes) pour l'omnibox ⌘K
--
-- La fonction `org_audit_trigger()` est définie par migration 500.
-- Ici on se contente d'attacher 3 triggers supplémentaires aux 3 tables
-- qui portent un `tenant_id`. `org_skills` et `org_person_skills` aussi
-- (org_templates peut avoir un tenant_id NULL pour les built-in globaux
-- donc on n'y attache pas le trigger pour éviter des rows audit sans
-- tenant — les templates publics sont versionnés par migration/seed).
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- Templates d'org — specs JSON de hiérarchies prêtes à cloner.
-- Le champ `spec_json` porte {nodes: [...], positions: [...], raci?: [...]}.
-- Les built-in (startup-20, scale-up-saas-80, ...) sont seedés au boot.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_templates (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                  VARCHAR(64) UNIQUE NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    industry              VARCHAR(64),
    size_range            VARCHAR(32),
    spec_json             JSONB NOT NULL,
    is_public             BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_tenant_id  UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_industry ON org_templates(industry);

-- ─────────────────────────────────────────────────────────────────────
-- Headcount planning — plans trimestriels / annuels par OU.
-- Plusieurs plans à horizons différents sur un même node sont autorisés
-- (pas de clé UNIQUE composite) — chaque plan a sa target_date.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_headcount_plan (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    node_id            UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    target_head_count  INTEGER NOT NULL CHECK (target_head_count >= 0),
    target_date        DATE NOT NULL,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_headcount_tenant_node
    ON org_headcount_plan(tenant_id, node_id, target_date);

-- ─────────────────────────────────────────────────────────────────────
-- Skills — catalog de compétences (tenant_id NULL = global, partagé).
-- Catégories : tech | soft | language | domain.
-- UNIQUE(tenant_id, slug) permet 1 row par (NULL, slug) pour les skills
-- globaux ET 1 row par (tenant, slug) pour les customs per-tenant.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_skills (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    slug        VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(32) NOT NULL
        CHECK (category IN ('tech','soft','language','domain')),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON org_skills(category);

-- ─────────────────────────────────────────────────────────────────────
-- Person-skills — niveau 1-5 + endorsement optionnel.
-- PK composite (person, skill) pour permettre UPSERT simple.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_person_skills (
    person_id              UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    skill_id               UUID NOT NULL REFERENCES org_skills(id) ON DELETE CASCADE,
    level                  SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
    endorsed_by_person_id  UUID REFERENCES org_persons(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (person_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_person_skills_skill ON org_person_skills(skill_id);

-- ─────────────────────────────────────────────────────────────────────
-- Audit triggers — attached to the tables portant un `tenant_id`.
-- org_person_skills n'a pas de tenant_id (dérivé via person_id) donc on
-- n'y attache pas le trigger générique.
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS org_templates_audit      ON org_templates;
DROP TRIGGER IF EXISTS org_headcount_plan_audit ON org_headcount_plan;
DROP TRIGGER IF EXISTS org_skills_audit         ON org_skills;

-- org_templates peut avoir tenant_id NULL (built-in publics). On utilise
-- un trigger custom qui skip le log si tenant_id est NULL.
CREATE OR REPLACE FUNCTION org_templates_audit_trigger() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_tenant := OLD.created_by_tenant_id;
    ELSE
        v_tenant := NEW.created_by_tenant_id;
    END IF;
    -- Skip audit pour les built-in globaux (tenant_id NULL).
    IF v_tenant IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO org_audit_log (tenant_id, entity_type, entity_id, action, diff_json)
    VALUES (
        v_tenant,
        'org_templates',
        COALESCE(NEW.id, OLD.id),
        lower(TG_OP),
        CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
            ELSE to_jsonb(NEW)
        END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER org_templates_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_templates
    FOR EACH ROW EXECUTE FUNCTION org_templates_audit_trigger();

CREATE TRIGGER org_headcount_plan_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_headcount_plan
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- org_skills peut avoir tenant_id NULL (catalog global). Même pattern.
CREATE OR REPLACE FUNCTION org_skills_audit_trigger() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_tenant := OLD.tenant_id;
    ELSE
        v_tenant := NEW.tenant_id;
    END IF;
    IF v_tenant IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO org_audit_log (tenant_id, entity_type, entity_id, action, diff_json)
    VALUES (
        v_tenant,
        'org_skills',
        COALESCE(NEW.id, OLD.id),
        lower(TG_OP),
        CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
            ELSE to_jsonb(NEW)
        END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER org_skills_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_skills
    FOR EACH ROW EXECUTE FUNCTION org_skills_audit_trigger();

-- ─────────────────────────────────────────────────────────────────────
-- Full-text search indexes — GIN tsvector sur persons + nodes.
-- Utilisés par `GET /api/v1/org/search` (omnibox ⌘K).
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_persons_fts ON org_persons USING gin (
    to_tsvector(
        'simple',
        coalesce(first_name, '') || ' ' ||
        coalesce(last_name, '')  || ' ' ||
        coalesce(email, '')
    )
);

CREATE INDEX IF NOT EXISTS idx_nodes_fts ON org_nodes USING gin (
    to_tsvector(
        'simple',
        coalesce(name, '') || ' ' || coalesce(slug, '')
    )
);
