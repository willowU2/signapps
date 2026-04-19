-- SO7 — Groupes transverses & Sites physiques.
--
-- Ajoute :
--   * org_groups            : groupes transverses (static | dynamic | hybrid | derived)
--   * org_group_members     : inclusions + exclusions pour static/hybrid
--   * org_sites             : hiérarchie building > floor > room > desk (parent_id)
--   * org_site_persons      : rattachement personnes (primary + N secondary)
--   * org_site_bookings     : réservations de salles / hot-desks
--
-- + 3 audit triggers branchés sur la fonction `org_audit_trigger()`
--   définie par la migration 500.
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- Groupes transverses — 4 kinds : static, dynamic, hybrid, derived.
--   * static   : membership explicite via org_group_members (include).
--   * dynamic  : rule_json DSL évalué à la volée.
--   * hybrid   : rule_json + inclusions/exclusions dans org_group_members.
--   * derived  : suit un sous-arbre entier via source_node_id.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_groups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    slug                 VARCHAR(64) NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    description          TEXT,
    kind                 VARCHAR(16) NOT NULL
        CHECK (kind IN ('static','dynamic','hybrid','derived')),
    rule_json            JSONB,
    source_node_id       UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
    attributes           JSONB NOT NULL DEFAULT '{}',
    archived             BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id   UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_groups_tenant
    ON org_groups(tenant_id) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS idx_groups_source_node
    ON org_groups(source_node_id) WHERE source_node_id IS NOT NULL;

-- Membership : inclusions + exclusions (pour static et hybrid).
CREATE TABLE IF NOT EXISTS org_group_members (
    group_id    UUID NOT NULL REFERENCES org_groups(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    kind        VARCHAR(16) NOT NULL
        CHECK (kind IN ('include','exclude')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_person
    ON org_group_members(person_id);

-- ─────────────────────────────────────────────────────────────────────
-- Sites : hiérarchie building > floor > room > desk via parent_id.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_sites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    parent_id   UUID REFERENCES org_sites(id) ON DELETE CASCADE,
    slug        VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    kind        VARCHAR(16) NOT NULL
        CHECK (kind IN ('building','floor','room','desk')),
    address     TEXT,
    gps         JSONB,
    timezone    VARCHAR(64) DEFAULT 'Europe/Paris',
    capacity    INT,
    equipment   JSONB NOT NULL DEFAULT '{}',
    bookable    BOOLEAN NOT NULL DEFAULT FALSE,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    attributes  JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sites_parent
    ON org_sites(parent_id);
CREATE INDEX IF NOT EXISTS idx_sites_kind
    ON org_sites(tenant_id, kind);

-- Rattachement personnes : primary + N secondary + desk optionnel.
CREATE TABLE IF NOT EXISTS org_site_persons (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id    UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    site_id      UUID NOT NULL REFERENCES org_sites(id) ON DELETE CASCADE,
    desk_id      UUID REFERENCES org_sites(id) ON DELETE SET NULL,
    role         VARCHAR(16) NOT NULL DEFAULT 'secondary'
        CHECK (role IN ('primary','secondary')),
    valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until  DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul site primaire par personne.
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_persons_primary
    ON org_site_persons(person_id) WHERE role = 'primary';
CREATE INDEX IF NOT EXISTS idx_site_persons_site
    ON org_site_persons(site_id);

-- ─────────────────────────────────────────────────────────────────────
-- Bookings : réservations de salles ou hot-desks, durée bornée.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_site_bookings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        UUID NOT NULL REFERENCES org_sites(id) ON DELETE CASCADE,
    person_id      UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    start_at       TIMESTAMPTZ NOT NULL,
    end_at         TIMESTAMPTZ NOT NULL,
    purpose        VARCHAR(255),
    status         VARCHAR(16) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed','tentative','cancelled')),
    meet_room_id   UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_site_time
    ON org_site_bookings(site_id, start_at, end_at) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_person
    ON org_site_bookings(person_id, start_at);

-- ─────────────────────────────────────────────────────────────────────
-- Audit triggers — branchés sur la fonction `org_audit_trigger()` définie
-- par la migration 500.
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS org_groups_audit        ON org_groups;
DROP TRIGGER IF EXISTS org_sites_audit         ON org_sites;
DROP TRIGGER IF EXISTS org_site_bookings_audit ON org_site_bookings;

CREATE TRIGGER org_groups_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_groups
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

CREATE TRIGGER org_sites_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_sites
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

CREATE TRIGGER org_site_bookings_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_site_bookings
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
