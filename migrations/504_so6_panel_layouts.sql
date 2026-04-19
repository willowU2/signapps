-- SO6 — Refonte DetailPanel org-structure : layouts configurables par rôle.
--
-- Adds 1 new table + 1 audit trigger to support la personnalisation
-- admin du panneau droit `/admin/org-structure` :
--   * org_panel_layouts : config JSONB par (tenant, role, entity_type)
--
-- Chaque tenant peut définir jusqu'à 6 layouts (3 rôles × 2 entity_types).
-- Si aucune row existe pour une combinaison, le backend renvoie un layout
-- hardcoded par défaut (voir `signapps-db::repositories::org::panel_layout_repository`).
--
-- La fonction `org_audit_trigger()` est définie par la migration 500.
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- Panel layouts — config JSONB par (tenant, role, entity_type).
-- role       : 'admin' | 'manager' | 'viewer'
-- entity_type: 'node' | 'person'
-- config     : { main_tabs[], hidden_tabs[], hero_quick_actions[], hero_kpis[] }
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_panel_layouts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    role                 VARCHAR(16) NOT NULL
        CHECK (role IN ('admin','manager','viewer')),
    entity_type          VARCHAR(16) NOT NULL
        CHECK (entity_type IN ('node','person')),
    config               JSONB NOT NULL,
    updated_by_user_id   UUID,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, role, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_panel_layouts_tenant
    ON org_panel_layouts(tenant_id);

-- ─────────────────────────────────────────────────────────────────────
-- Audit trigger — attached à la nouvelle table tenant-scopée.
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS org_panel_layouts_audit ON org_panel_layouts;

CREATE TRIGGER org_panel_layouts_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_panel_layouts
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
