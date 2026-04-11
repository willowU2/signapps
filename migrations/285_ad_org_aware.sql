-- 285_ad_org_aware.sql
-- AD org-aware: GPO no_inherit + provisioning tracking

ALTER TABLE workforce_org_nodes ADD COLUMN IF NOT EXISTS gpo_no_inherit BOOLEAN DEFAULT false;

ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS provisioned_by UUID;
