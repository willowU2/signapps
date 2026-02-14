-- App Store: sources for external app catalogs

CREATE TABLE IF NOT EXISTS containers.app_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_fetched TIMESTAMPTZ,
    app_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default sources
INSERT INTO containers.app_sources (name, url) VALUES
    ('CasaOS Store', 'https://azukaar.github.io/cosmos-casaos-store'),
    ('ManhTuong Store', 'https://cosmos.manhtuong.net'),
    ('Community Apps', 'https://lilkidsuave.github.io/cosmos-servapps-unofficial'),
    ('Ragdata Apps', 'https://ragdata.github.io/cosmos-servapps')
ON CONFLICT (url) DO NOTHING;
