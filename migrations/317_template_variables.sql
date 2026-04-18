-- 317_template_variables.sql
-- Template variables for dynamic document generation

CREATE TABLE IF NOT EXISTS core.template_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL,
    name TEXT NOT NULL,
    variable_type TEXT NOT NULL CHECK (variable_type IN ('text', 'image', 'date', 'list')),
    default_value TEXT,
    description TEXT,
    required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, name)
);

CREATE INDEX IF NOT EXISTS idx_template_variables_template ON core.template_variables(template_id);

CREATE TABLE IF NOT EXISTS core.template_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_datasets_template ON core.template_datasets(template_id);

-- Social media preset sizes
CREATE TABLE IF NOT EXISTS core.social_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    format_name TEXT NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    aspect_ratio TEXT,
    description TEXT,
    UNIQUE(platform, format_name)
);

INSERT INTO core.social_presets (platform, format_name, width, height, aspect_ratio, description) VALUES
    ('instagram', 'Post', 1080, 1080, '1:1', 'Instagram square post'),
    ('instagram', 'Story', 1080, 1920, '9:16', 'Instagram/Facebook story'),
    ('instagram', 'Reel Cover', 1080, 1920, '9:16', 'Instagram reel thumbnail'),
    ('facebook', 'Post', 1200, 630, '1.91:1', 'Facebook feed post'),
    ('facebook', 'Cover', 820, 312, '2.63:1', 'Facebook page cover'),
    ('facebook', 'Event', 1920, 1005, '1.91:1', 'Facebook event cover'),
    ('linkedin', 'Post', 1200, 627, '1.91:1', 'LinkedIn feed post'),
    ('linkedin', 'Banner', 1584, 396, '4:1', 'LinkedIn profile banner'),
    ('linkedin', 'Article', 1200, 644, '1.86:1', 'LinkedIn article cover'),
    ('twitter', 'Post', 1200, 675, '16:9', 'Twitter/X post image'),
    ('twitter', 'Header', 1500, 500, '3:1', 'Twitter/X profile header'),
    ('youtube', 'Thumbnail', 1280, 720, '16:9', 'YouTube video thumbnail'),
    ('youtube', 'Banner', 2560, 1440, '16:9', 'YouTube channel banner'),
    ('tiktok', 'Video Cover', 1080, 1920, '9:16', 'TikTok video thumbnail'),
    ('pinterest', 'Pin', 1000, 1500, '2:3', 'Pinterest standard pin'),
    ('whatsapp', 'Status', 1080, 1920, '9:16', 'WhatsApp status image')
ON CONFLICT (platform, format_name) DO NOTHING;
