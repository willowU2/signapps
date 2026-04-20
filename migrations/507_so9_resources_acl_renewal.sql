-- SO9 — Multi-assignation + ACL universelle + Renouvellements.
--
-- Ajoute :
--   * org_resource_assignments : N:N personne/node/group/site → resource
--                                avec rôle (owner, primary_user, …).
--   * org_acl                  : ACL universelle ReBAC (subject × action ×
--                                resource_type × resource_id) + effect
--                                allow/deny + validité temporelle.
--   * org_resource_renewals    : cycle de renouvellement (garanties,
--                                licences, inspections, validités badges).
--   * Ajout colonne `photo_url` sur `org_resources` (hero photo).
--   * Ajout colonne `primary_identifier_type` sur `org_resources`
--     (`serial` / `plate` / `vin` / `license_key` / `badge_number` /
--     `key_number` / `none`).
--   * Migration data : les `org_resources.assigned_to_*` existants sont
--     ré-ingérés dans `org_resource_assignments` (role='owner').
--   * Audit triggers branchés sur `org_audit_trigger()` (défini par 500).
--
-- Dépendances : 500 (audit trigger), 401 (org_nodes), 402 (org_persons),
--               504/505 (groups + sites), 506 (org_resources).
--
-- Idempotent : safe to re-run en dev (IF NOT EXISTS + ON CONFLICT
--              DO NOTHING + DROP TRIGGER IF EXISTS).

-- ─────────────────────────────────────────────────────────────────────
-- 1. Extensions colonnes sur org_resources
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE org_resources
    ADD COLUMN IF NOT EXISTS photo_url VARCHAR(512),
    ADD COLUMN IF NOT EXISTS primary_identifier_type VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (primary_identifier_type IN (
            'serial','plate','vin','license_key','badge_number','key_number','none'
        ));

CREATE INDEX IF NOT EXISTS idx_resources_primary_id_type
    ON org_resources(tenant_id, primary_identifier_type);

-- ─────────────────────────────────────────────────────────────────────
-- 2. org_resource_assignments : N:N acteurs ↔ ressource avec rôle.
--
--   Règles :
--     * 1 owner max actif par ressource (index unique partiel).
--     * 1 primary_user max actif par ressource si is_primary = TRUE.
--     * subject_type ∈ ('person','node','group','site').
--     * role ∈ ('owner','primary_user','secondary_user','caretaker',
--                'maintainer').
--     * History : update = close row (end_at = now) + insert nouvelle.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_resource_assignments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    resource_id       UUID NOT NULL REFERENCES org_resources(id) ON DELETE CASCADE,
    subject_type      VARCHAR(16) NOT NULL
        CHECK (subject_type IN ('person','node','group','site')),
    subject_id        UUID NOT NULL,
    role              VARCHAR(24) NOT NULL
        CHECK (role IN ('owner','primary_user','secondary_user','caretaker','maintainer')),
    is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
    start_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_at            TIMESTAMPTZ,
    reason            TEXT,
    created_by_user_id UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_ra_resource_active
    ON org_resource_assignments(resource_id)
    WHERE end_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ra_subject_active
    ON org_resource_assignments(subject_type, subject_id)
    WHERE end_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ra_tenant
    ON org_resource_assignments(tenant_id);

-- 1 owner actif par ressource.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_one_owner
    ON org_resource_assignments(resource_id)
    WHERE end_at IS NULL AND role = 'owner';

-- 1 primary_user actif par ressource quand is_primary = TRUE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_one_primary_user
    ON org_resource_assignments(resource_id)
    WHERE end_at IS NULL AND role = 'primary_user' AND is_primary;

-- Audit trigger.
DROP TRIGGER IF EXISTS org_resource_assignments_audit ON org_resource_assignments;
CREATE TRIGGER org_resource_assignments_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_resource_assignments
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- ─────────────────────────────────────────────────────────────────────
-- 3. org_acl : ACL universelle ReBAC-style.
--
--   subject_type ∈ ('person','group','role','everyone','auth_user')
--   action       ∈ create / read / update / delete / list / assign /
--                   unassign / transition / renew / '*' (wildcard géré côté
--                   resolver)
--   resource_type = 'resource' (SO9) — 'site','group','person','node',
--                   'document', ... (futurs SO). '*' = wildcard géré côté
--                   resolver, pas contraint en DB.
--   resource_id  = UUID (exact) OU NULL (wildcard = toute la tenant pour
--                  ce resource_type).
--   effect        = 'allow' | 'deny'
--   valid_from/until = bornes temporelles optionnelles.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_acl (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    subject_type      VARCHAR(16) NOT NULL
        CHECK (subject_type IN ('person','group','role','everyone','auth_user')),
    subject_id        UUID,
    subject_ref       VARCHAR(64),
    action            VARCHAR(32) NOT NULL,
    resource_type     VARCHAR(32) NOT NULL,
    resource_id       UUID,
    effect            VARCHAR(8) NOT NULL
        CHECK (effect IN ('allow','deny')),
    reason            TEXT,
    valid_from        TIMESTAMPTZ,
    valid_until       TIMESTAMPTZ,
    created_by_user_id UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (subject_type IN ('role','everyone','auth_user') AND subject_id IS NULL)
        OR (subject_type IN ('person','group') AND subject_id IS NOT NULL)
    ),
    CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_acl_lookup
    ON org_acl(tenant_id, resource_type, action, subject_type);
CREATE INDEX IF NOT EXISTS idx_acl_subject
    ON org_acl(subject_type, subject_id)
    WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acl_role
    ON org_acl(subject_ref)
    WHERE subject_type = 'role';
CREATE INDEX IF NOT EXISTS idx_acl_resource
    ON org_acl(tenant_id, resource_type, resource_id)
    WHERE resource_id IS NOT NULL;

-- Audit trigger.
DROP TRIGGER IF EXISTS org_acl_audit ON org_acl;
CREATE TRIGGER org_acl_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_acl
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- ─────────────────────────────────────────────────────────────────────
-- 4. org_resource_renewals : cycle de renouvellement.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_resource_renewals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    resource_id         UUID NOT NULL REFERENCES org_resources(id) ON DELETE CASCADE,
    kind                VARCHAR(32) NOT NULL
        CHECK (kind IN (
            'warranty_end','license_expiry','badge_validity','insurance_expiry',
            'technical_inspection','maintenance_due','battery_replacement',
            'key_rotation','custom'
        )),
    due_date            DATE NOT NULL,
    grace_period_days   INT NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0),
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','snoozed','renewed','escalated','cancelled')),
    last_reminded_at    TIMESTAMPTZ,
    snoozed_until       DATE,
    renewed_at          TIMESTAMPTZ,
    renewed_by_user_id  UUID,
    renewal_notes       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renewals_due
    ON org_resource_renewals(due_date, status)
    WHERE status IN ('pending','snoozed','escalated');
CREATE INDEX IF NOT EXISTS idx_renewals_resource
    ON org_resource_renewals(resource_id);
CREATE INDEX IF NOT EXISTS idx_renewals_tenant
    ON org_resource_renewals(tenant_id);

DROP TRIGGER IF EXISTS org_resource_renewals_audit ON org_resource_renewals;
CREATE TRIGGER org_resource_renewals_audit
    AFTER INSERT OR UPDATE OR DELETE ON org_resource_renewals
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- ─────────────────────────────────────────────────────────────────────
-- 5. Migration data SO8 → multi-assign.
--
--   Pour chaque ressource non archivée avec un `assigned_to_person_id`
--   ou `assigned_to_node_id`, on crée un row owner dans
--   org_resource_assignments. Idempotent via NOT EXISTS — le ré-run ne
--   duplique pas les owners déjà présents.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO org_resource_assignments
    (tenant_id, resource_id, subject_type, subject_id, role, is_primary, start_at, reason)
SELECT
    r.tenant_id,
    r.id,
    CASE
        WHEN r.assigned_to_person_id IS NOT NULL THEN 'person'
        WHEN r.assigned_to_node_id   IS NOT NULL THEN 'node'
    END,
    COALESCE(r.assigned_to_person_id, r.assigned_to_node_id),
    'owner',
    TRUE,
    r.created_at,
    'migrated from SO8 assigned_to_* columns'
FROM org_resources r
WHERE (r.assigned_to_person_id IS NOT NULL OR r.assigned_to_node_id IS NOT NULL)
  AND NOT r.archived
  AND NOT EXISTS (
      SELECT 1 FROM org_resource_assignments a
       WHERE a.resource_id = r.id
         AND a.role = 'owner'
         AND a.end_at IS NULL
  );
