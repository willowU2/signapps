-- 233_sharing_data_migration.sql
-- Phase 2 of unified sharing system: copy legacy ACL data into sharing.grants.
--
-- Sources:
--   drive.acl               → sharing.grants (resource_type: 'file' | 'folder')
--   calendar.calendar_members → sharing.grants (resource_type: 'calendar')
--   document_permissions    → sharing.grants (resource_type: 'document')
--
-- Idempotent — safe to run multiple times (ON CONFLICT DO NOTHING).
-- Legacy tables are NOT modified (read-only). Drops will happen in a later migration.
--
-- Role mappings applied:
--   drive.acl_role:   viewer→viewer, downloader→viewer, editor→editor, contributor→editor, manager→manager
--   calendar role:    viewer→viewer, editor→editor, owner→manager
--   permission_level: view→viewer, edit→editor, admin→manager
--
-- Rows are skipped when:
--   • tenant_id cannot be resolved (INNER JOINs naturally exclude those rows)
--   • drive.acl grantee constraint is violated (everyone with a grantee_id, or non-everyone without one)


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. drive.acl → sharing.grants
--    tenant_id : drive.nodes.owner_id → identity.users.tenant_id
--    resource_type : map node_type ('folder'→'folder', 'file'/'document'→'file')
--    role : collapse 5-level ACL to 3-level sharing role
--    inherit : preserve original value from drive.acl
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sharing.grants (
    tenant_id,
    resource_type,
    resource_id,
    grantee_type,
    grantee_id,
    role,
    can_reshare,
    inherit,
    granted_by,
    expires_at,
    created_at,
    updated_at
)
SELECT
    u.tenant_id,
    CASE n.node_type::text
        WHEN 'folder'   THEN 'folder'
        ELSE 'file'                          -- 'file' and 'document' both map to 'file'
    END::text                                AS resource_type,
    acl.node_id                              AS resource_id,
    acl.grantee_type::text                   AS grantee_type,
    acl.grantee_id,
    CASE acl.role::text
        WHEN 'viewer'       THEN 'viewer'
        WHEN 'downloader'   THEN 'viewer'    -- download capability is included in viewer
        WHEN 'editor'       THEN 'editor'
        WHEN 'contributor'  THEN 'editor'    -- upload capability is included in editor
        WHEN 'manager'      THEN 'manager'
        ELSE                     'viewer'    -- safe fallback for unknown future roles
    END::text                                AS role,
    FALSE                                    AS can_reshare,
    COALESCE(acl.inherit, TRUE)              AS inherit,
    acl.granted_by,
    acl.expires_at,
    acl.created_at,
    acl.updated_at
FROM drive.acl acl
INNER JOIN drive.nodes n   ON n.id  = acl.node_id
INNER JOIN identity.users u ON u.id = n.owner_id
WHERE u.tenant_id IS NOT NULL
  AND (
      -- Enforce chk_everyone_no_id: 'everyone' must have no grantee_id
      (acl.grantee_type::text = 'everyone' AND acl.grantee_id IS NULL)
      OR
      -- All other grantee types must have a grantee_id
      (acl.grantee_type::text != 'everyone' AND acl.grantee_id IS NOT NULL)
  )
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. calendar.calendar_members → sharing.grants
--    tenant_id : calendar.calendars.tenant_id (or owner fallback via COALESCE)
--    resource_type : hardcoded 'calendar'
--    grantee_type  : hardcoded 'user' (calendar_members only tracks individual users)
--    role : owner→manager, editor→editor, viewer→viewer
--    granted_by : calendar.owner_id
--    inherit : hardcoded TRUE (calendar_members has no inheritance concept)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sharing.grants (
    tenant_id,
    resource_type,
    resource_id,
    grantee_type,
    grantee_id,
    role,
    can_reshare,
    inherit,
    granted_by,
    expires_at,
    created_at,
    updated_at
)
SELECT
    -- Prefer the tenant_id stored on the calendar; fall back to the owner's tenant
    COALESCE(c.tenant_id, u_owner.tenant_id)  AS tenant_id,
    'calendar'::text                          AS resource_type,
    cm.calendar_id                            AS resource_id,
    'user'::text                              AS grantee_type,
    cm.user_id                                AS grantee_id,
    CASE cm.role
        WHEN 'owner'  THEN 'manager'
        WHEN 'editor' THEN 'editor'
        ELSE               'viewer'           -- 'viewer' and any unknown role → viewer
    END::text                                 AS role,
    FALSE                                     AS can_reshare,
    TRUE                                      AS inherit,
    c.owner_id                                AS granted_by,
    NULL::TIMESTAMPTZ                         AS expires_at,
    cm.created_at,
    cm.updated_at
FROM calendar.calendar_members cm
INNER JOIN calendar.calendars c ON c.id = cm.calendar_id
-- Left-join the owner so we can fall back for the COALESCE above
LEFT  JOIN identity.users u_owner ON u_owner.id = c.owner_id
WHERE COALESCE(c.tenant_id, u_owner.tenant_id) IS NOT NULL
  AND cm.user_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. document_permissions → sharing.grants
--    tenant_id : documents.created_by → identity.users.tenant_id
--    resource_type : hardcoded 'document'
--    grantee_type  : 'user' when user_id IS NOT NULL, else 'group'
--    grantee_id    : COALESCE(user_id, group_id)
--    role : view→viewer, edit→editor, admin→manager
--    granted_by : documents.created_by
--    inherit : hardcoded TRUE (document_permissions has no inheritance concept)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sharing.grants (
    tenant_id,
    resource_type,
    resource_id,
    grantee_type,
    grantee_id,
    role,
    can_reshare,
    inherit,
    granted_by,
    expires_at,
    created_at,
    updated_at
)
SELECT
    u.tenant_id,
    'document'::text                                       AS resource_type,
    perms.doc_id                                           AS resource_id,
    CASE
        WHEN perms.user_id IS NOT NULL THEN 'user'
        ELSE                                'group'
    END::text                                              AS grantee_type,
    COALESCE(perms.user_id, perms.group_id)               AS grantee_id,
    CASE perms.permission_level
        WHEN 'view'  THEN 'viewer'
        WHEN 'edit'  THEN 'editor'
        WHEN 'admin' THEN 'manager'
        ELSE              'viewer'                         -- safe fallback
    END::text                                              AS role,
    FALSE                                                  AS can_reshare,
    TRUE                                                   AS inherit,
    d.created_by                                           AS granted_by,
    NULL::TIMESTAMPTZ                                      AS expires_at,
    perms.created_at,
    perms.created_at                                       AS updated_at  -- source has no updated_at
FROM document_permissions perms
INNER JOIN documents      d ON d.id  = perms.doc_id
INNER JOIN identity.users u ON u.id  = d.created_by
WHERE u.tenant_id IS NOT NULL
  AND COALESCE(perms.user_id, perms.group_id) IS NOT NULL  -- skip rows with no resolvable grantee
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Legacy tables are intentionally left intact.
-- Drops (drive.acl, calendar.calendar_members, document_permissions) will be
-- performed in a later migration once all consumers have been migrated to
-- the sharing.grants API and the data has been verified in production.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually after migration to confirm row counts):
--
--   SELECT resource_type, COUNT(*) FROM sharing.grants GROUP BY resource_type ORDER BY 1;
--
--   -- drive.acl migrated:
--   SELECT COUNT(*) FROM drive.acl acl
--     INNER JOIN drive.nodes n ON n.id = acl.node_id
--     INNER JOIN identity.users u ON u.id = n.owner_id
--   WHERE u.tenant_id IS NOT NULL
--     AND ((acl.grantee_type::text = 'everyone' AND acl.grantee_id IS NULL)
--          OR (acl.grantee_type::text != 'everyone' AND acl.grantee_id IS NOT NULL));
--
--   -- calendar.calendar_members migrated:
--   SELECT COUNT(*) FROM calendar.calendar_members cm
--     INNER JOIN calendar.calendars c ON c.id = cm.calendar_id
--     LEFT JOIN identity.users u ON u.id = c.owner_id
--   WHERE COALESCE(c.tenant_id, u.tenant_id) IS NOT NULL AND cm.user_id IS NOT NULL;
--
--   -- document_permissions migrated:
--   SELECT COUNT(*) FROM document_permissions perms
--     INNER JOIN documents d ON d.id = perms.doc_id
--     INNER JOIN identity.users u ON u.id = d.created_by
--   WHERE u.tenant_id IS NOT NULL
--     AND COALESCE(perms.user_id, perms.group_id) IS NOT NULL;
-- ─────────────────────────────────────────────────────────────────────────────
