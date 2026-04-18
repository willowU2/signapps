-- 313_spreadsheet_enrichment.sql
-- Spreadsheet enrichment: cell formatting, conditional formatting, sheet metadata

-- Cell format overrides (sparse storage — only cells with non-default formatting)
CREATE TABLE IF NOT EXISTS content.cell_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    sheet_index INT NOT NULL DEFAULT 0,
    cell_ref TEXT NOT NULL,          -- "A1", "B5", "AA100"
    style_id UUID REFERENCES core.style_definitions(id),
    format_override JSONB DEFAULT '{}',  -- inline overrides on top of style
    conditional_rules JSONB DEFAULT '[]', -- [{condition, style_override}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, sheet_index, cell_ref)
);

CREATE INDEX IF NOT EXISTS idx_cell_formats_doc ON content.cell_formats(document_id, sheet_index);

-- Sheet-level metadata (frozen panes, column widths, filters)
CREATE TABLE IF NOT EXISTS content.sheet_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    sheet_index INT NOT NULL DEFAULT 0,
    sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
    frozen_rows INT DEFAULT 0,
    frozen_cols INT DEFAULT 0,
    col_widths JSONB DEFAULT '{}',     -- {"A": 120, "B": 80}
    row_heights JSONB DEFAULT '{}',    -- {"1": 30, "5": 50}
    sort_config JSONB DEFAULT '[]',    -- [{col, direction}]
    filter_config JSONB DEFAULT '[]',  -- [{col, expression}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, sheet_index)
);
