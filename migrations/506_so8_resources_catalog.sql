-- SO8 — Catalogue unifié de ressources tangibles.
--
-- Ajoute :
--   * org_resources           : ligne par ressource physique/logique gérée
--                               (IT, véhicules, clés, badges, AV, licences, …)
--   * org_resource_status_log : historique d'état (state machine transitions)
--
-- + audit trigger branché sur `org_audit_trigger()` (défini par la migration 500).
--
-- Dépendances : 500 (org_audit_trigger), 401 (org_nodes), 402 (org_persons),
--               505 (org_sites).
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- org_resources : modèle canonique (un row = une ressource tangible).
--
-- Règles :
--   * `kind` = taxonomie fermée (9 valeurs) — source de vérité des fiches
--     spécifiques (attributs dans `attributes` JSONB).
--   * `status` = état du cycle de vie (6 valeurs). Les transitions valides
--     sont encodées en Rust (`ResourceStatus::valid_transition`).
--   * `assigned_to_person_id` XOR `assigned_to_node_id` : soit à une
--     personne soit à un node, jamais les deux en même temps.
--   * `primary_site_id` : site physique de base (building / floor / room).
--   * `qr_token` : hex 16 chars, généré via HMAC-SHA256 de l'id (keystore).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_resources (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    kind                  VARCHAR(32) NOT NULL
        CHECK (kind IN (
            'it_device','vehicle','key_physical','badge','av_equipment',
            'furniture','mobile_phone','license_software','other'
        )),
    slug                  VARCHAR(64) NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    serial_or_ref         VARCHAR(128),
    attributes            JSONB NOT NULL DEFAULT '{}',
    status                VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'ordered','active','loaned','in_maintenance','returned','retired'
        )),
    assigned_to_person_id UUID REFERENCES org_persons(id) ON DELETE SET NULL,
    assigned_to_node_id   UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
    primary_site_id       UUID REFERENCES org_sites(id) ON DELETE SET NULL,
    purchase_date         DATE,
    purchase_cost_cents   BIGINT,
    currency              VARCHAR(3) DEFAULT 'EUR',
    amortization_months   INT,
    warranty_end_date     DATE,
    next_maintenance_date DATE,
    qr_token              VARCHAR(32),
    archived              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slug),
    CHECK (
        assigned_to_person_id IS NULL OR assigned_to_node_id IS NULL
    )
);

-- Unique QR token across the entire resources table (cross-tenant).
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_qr_token
    ON org_resources(qr_token) WHERE qr_token IS NOT NULL;

-- Tenant listing (filtered by archive state) — primary query path.
CREATE INDEX IF NOT EXISTS idx_resources_tenant
    ON org_resources(tenant_id) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS idx_resources_kind
    ON org_resources(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_resources_person
    ON org_resources(assigned_to_person_id)
    WHERE assigned_to_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_node
    ON org_resources(assigned_to_node_id)
    WHERE assigned_to_node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_site
    ON org_resources(primary_site_id)
    WHERE primary_site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_status
    ON org_resources(tenant_id, status);

-- ─────────────────────────────────────────────────────────────────────
-- org_resource_status_log : historique append-only des transitions d'état.
--
-- Chaque POST /status ajoute un row (`from_status` peut être NULL à la
-- création, `actor_user_id` carry l'utilisateur qui a fait la transition).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_resource_status_log (
    id              BIGSERIAL PRIMARY KEY,
    resource_id     UUID NOT NULL REFERENCES org_resources(id) ON DELETE CASCADE,
    from_status     VARCHAR(20),
    to_status       VARCHAR(20) NOT NULL,
    actor_user_id   UUID,
    reason          TEXT,
    at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_status_log_resource
    ON org_resource_status_log(resource_id, at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- Audit trigger — branché sur la fonction `org_audit_trigger()` définie
-- par la migration 500.
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS org_resources_audit ON org_resources;

CREATE TRIGGER org_resources_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_resources
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
