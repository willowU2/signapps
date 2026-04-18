-- 314_presentation_model.sql
-- Presentation model: master slides, layouts, slides with shapes

CREATE TABLE IF NOT EXISTS content.presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Presentation',
    master_id UUID,
    theme JSONB DEFAULT '{}',
    slide_width FLOAT DEFAULT 960,
    slide_height FLOAT DEFAULT 540,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentations_doc ON content.presentations(document_id);

CREATE TABLE IF NOT EXISTS content.slide_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES content.presentations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    layout_type TEXT NOT NULL CHECK (layout_type IN (
        'title_slide', 'title_content', 'two_columns', 'blank',
        'section_header', 'image_text', 'comparison'
    )),
    placeholders JSONB NOT NULL DEFAULT '[]',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slide_layouts_pres ON content.slide_layouts(presentation_id);

CREATE TABLE IF NOT EXISTS content.slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES content.presentations(id) ON DELETE CASCADE,
    layout_id UUID REFERENCES content.slide_layouts(id),
    sort_order INT NOT NULL DEFAULT 0,
    elements JSONB NOT NULL DEFAULT '[]',
    speaker_notes TEXT DEFAULT '',
    transition_type TEXT DEFAULT 'none',
    transition_duration INT DEFAULT 500,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slides_pres ON content.slides(presentation_id, sort_order);

-- Seed default layouts for each new presentation via a function
CREATE OR REPLACE FUNCTION content.seed_default_layouts(pres_id UUID) RETURNS VOID AS $$
BEGIN
    INSERT INTO content.slide_layouts (presentation_id, name, layout_type, placeholders, sort_order) VALUES
    (pres_id, 'Title Slide', 'title_slide',
     '[{"type":"title","x":80,"y":180,"width":800,"height":80,"label":"Click to add title"},{"type":"subtitle","x":120,"y":280,"width":720,"height":40,"label":"Click to add subtitle"}]', 0),
    (pres_id, 'Title + Content', 'title_content',
     '[{"type":"title","x":40,"y":20,"width":880,"height":60,"label":"Click to add title"},{"type":"body","x":40,"y":100,"width":880,"height":400,"label":"Click to add content"}]', 1),
    (pres_id, 'Two Columns', 'two_columns',
     '[{"type":"title","x":40,"y":20,"width":880,"height":60,"label":"Title"},{"type":"body","x":40,"y":100,"width":420,"height":400,"label":"Left column"},{"type":"body","x":500,"y":100,"width":420,"height":400,"label":"Right column"}]', 2),
    (pres_id, 'Section Header', 'section_header',
     '[{"type":"title","x":80,"y":200,"width":800,"height":80,"label":"Section title"},{"type":"subtitle","x":120,"y":300,"width":720,"height":40,"label":"Description"}]', 3),
    (pres_id, 'Blank', 'blank', '[]', 4),
    (pres_id, 'Image + Text', 'image_text',
     '[{"type":"image","x":40,"y":40,"width":440,"height":460,"label":"Insert image"},{"type":"body","x":500,"y":40,"width":420,"height":460,"label":"Text content"}]', 5),
    (pres_id, 'Comparison', 'comparison',
     '[{"type":"title","x":40,"y":20,"width":880,"height":50,"label":"Title"},{"type":"body","x":40,"y":90,"width":420,"height":200,"label":"Item 1"},{"type":"body","x":500,"y":90,"width":420,"height":200,"label":"Item 2"},{"type":"body","x":40,"y":310,"width":420,"height":200,"label":"Item 3"},{"type":"body","x":500,"y":310,"width":420,"height":200,"label":"Item 4"}]', 6);
END;
$$ LANGUAGE plpgsql;
