-- Migration 223: Synchronize infrastructure.domains → mailserver.domains
-- When a domain is created/updated with mail_enabled=true, sync to mailserver.domains.
-- This bridges the gap between the unified registry and the mail service's schema.

CREATE OR REPLACE FUNCTION infrastructure.sync_mail_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.mail_enabled = true THEN
        INSERT INTO mailserver.domains (id, name, tenant_id, is_active, dkim_private_key, dkim_selector, dmarc_policy)
        VALUES (
            NEW.id,
            NEW.dns_name,
            NEW.tenant_id,
            NEW.is_active,
            NEW.dkim_private_key,
            COALESCE(NEW.dkim_selector, 'signapps'),
            COALESCE(NEW.dmarc_policy, 'none')
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            dkim_private_key = EXCLUDED.dkim_private_key,
            dkim_selector = EXCLUDED.dkim_selector,
            dmarc_policy = EXCLUDED.dmarc_policy;
    ELSIF OLD IS NOT NULL AND OLD.mail_enabled = true AND NEW.mail_enabled = false THEN
        -- Mail was disabled: deactivate in mailserver
        UPDATE mailserver.domains SET is_active = false WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_mail_domain ON infrastructure.domains;
CREATE TRIGGER trg_sync_mail_domain
    AFTER INSERT OR UPDATE ON infrastructure.domains
    FOR EACH ROW
    EXECUTE FUNCTION infrastructure.sync_mail_domain();

-- Similarly sync proxy certificates
CREATE OR REPLACE FUNCTION infrastructure.sync_proxy_cert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync server and wildcard certs to proxy
    IF NEW.cert_type IN ('server', 'wildcard') AND NEW.status = 'active' THEN
        INSERT INTO proxy.certificates (id, domain, certificate, private_key, auto_renew, expires_at)
        SELECT NEW.id, NEW.subject, NEW.certificate, NULL, NEW.auto_renew, NEW.not_after
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'proxy' AND table_name = 'certificates')
        ON CONFLICT (id) DO UPDATE SET
            domain = EXCLUDED.domain,
            certificate = EXCLUDED.certificate,
            auto_renew = EXCLUDED.auto_renew,
            expires_at = EXCLUDED.expires_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_proxy_cert ON infrastructure.certificates;
CREATE TRIGGER trg_sync_proxy_cert
    AFTER INSERT OR UPDATE ON infrastructure.certificates
    FOR EACH ROW
    EXECUTE FUNCTION infrastructure.sync_proxy_cert();

-- Sync existing infrastructure domains to mailserver (one-time migration)
INSERT INTO mailserver.domains (id, name, tenant_id, is_active, dkim_private_key, dkim_selector, dmarc_policy)
SELECT id, dns_name, tenant_id, is_active,
       dkim_private_key,
       COALESCE(dkim_selector, 'signapps'),
       COALESCE(dmarc_policy, 'none')
FROM infrastructure.domains
WHERE mail_enabled = true
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    dkim_private_key = EXCLUDED.dkim_private_key;
