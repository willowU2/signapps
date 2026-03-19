-- Migration: Add Entity Hub to Global Search Index
-- Adds triggers for calendar.projects and scheduling.time_items

-- =========================================================================
-- TRIGGER: calendar.projects
-- =========================================================================
CREATE OR REPLACE FUNCTION trigger_sync_project_to_gsi()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
        VALUES (
            NEW.id,
            'project',
            NEW.owner_id,
            COALESCE(NEW.name, 'Untitled Project'),
            NEW.description,
            '/projects/' || NEW.id::text,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            snippet = EXCLUDED.snippet,
            updated_at = EXCLUDED.updated_at;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_project_gsi ON calendar.projects;
CREATE TRIGGER trg_sync_project_gsi
AFTER INSERT OR UPDATE OR DELETE ON calendar.projects
FOR EACH ROW EXECUTE FUNCTION trigger_sync_project_to_gsi();

-- =========================================================================
-- TRIGGER: scheduling.time_items (Tasks)
-- =========================================================================
CREATE OR REPLACE FUNCTION trigger_sync_time_item_to_gsi()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Only index tasks and events
        IF NEW.item_type IN ('task', 'event') AND NEW.owner_id IS NOT NULL THEN
            INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
            VALUES (
                NEW.id,
                NEW.item_type,
                NEW.owner_id,
                COALESCE(NEW.title, 'Untitled'),
                NEW.description,
                '/' || NEW.item_type || 's/' || NEW.id::text,
                NEW.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                snippet = EXCLUDED.snippet,
                updated_at = EXCLUDED.updated_at;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM global_search_index WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_time_item_gsi ON scheduling.time_items;
CREATE TRIGGER trg_sync_time_item_gsi
AFTER INSERT OR UPDATE OR DELETE ON scheduling.time_items
FOR EACH ROW EXECUTE FUNCTION trigger_sync_time_item_to_gsi();

-- =========================================================================
-- INITIAL SEEDING FOR EXISTING DATA
-- =========================================================================
INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
SELECT id, 'project', owner_id, COALESCE(name, 'Untitled Project'), description, '/projects/' || id::text, updated_at
FROM calendar.projects
WHERE deleted_at IS NULL AND owner_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO global_search_index (id, entity_type, user_id, title, snippet, url, updated_at)
SELECT id, item_type, owner_id, COALESCE(title, 'Untitled'), description, '/' || item_type || 's/' || id::text, updated_at
FROM scheduling.time_items
WHERE deleted_at IS NULL AND item_type IN ('task', 'event') AND owner_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
