-- Migration 222: Backward-compatible views for infrastructure.domains
-- Existing code using ad_domains and mailserver.domains continues to work.

-- Drop the old ad_domains table and replace with a view
-- ONLY if infrastructure.domains has been populated
-- For safety, we create the views alongside the existing tables

CREATE OR REPLACE VIEW public.v_ad_domains AS
SELECT
    id, tenant_id, tree_id, dns_name, netbios_name, domain_sid,
    realm, forest_root, domain_function_level, config,
    1 AS schema_version, created_at, updated_at
FROM infrastructure.domains
WHERE ad_enabled = true AND is_active = true;

CREATE OR REPLACE VIEW public.v_mail_domains AS
SELECT
    id, tenant_id, dns_name AS name,
    dkim_private_key, dkim_selector, dkim_selector AS dkim_algorithm,
    spf_record, dmarc_policy,
    NULL::varchar AS catch_all_address,
    0 AS max_accounts,
    true AS is_verified,
    is_active, created_at, updated_at
FROM infrastructure.domains
WHERE mail_enabled = true AND is_active = true;
