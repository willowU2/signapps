-- migrations/227_ad_node_mail_domains.sql
-- Maps org nodes to mail domains (inheritance via closure table)

CREATE TABLE IF NOT EXISTS ad_node_mail_domains (
    node_id UUID PRIMARY KEY REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_node_mail_domain ON ad_node_mail_domains(domain_id);
