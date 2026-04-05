-- Migration 217: LightRAG auto-feed triggers
-- Sends NOTIFY on data changes for automatic knowledge graph updates.

-- Generic notify function that sends table name + operation + row ID
CREATE OR REPLACE FUNCTION kg_notify_change() RETURNS trigger AS $$
DECLARE
    row_id TEXT;
BEGIN
    -- Extract the ID from the row (works with UUID or serial PKs)
    IF TG_OP = 'DELETE' THEN
        row_id := OLD.id::TEXT;
    ELSE
        row_id := NEW.id::TEXT;
    END IF;

    -- Send notification with table name, operation, and row ID
    PERFORM pg_notify('kg_data_change', json_build_object(
        'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        'op', TG_OP,
        'id', row_id
    )::TEXT);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to all important tables
-- Tier 1: Identity & Org
CREATE OR REPLACE TRIGGER trg_kg_identity_users AFTER INSERT OR UPDATE ON identity.users FOR EACH ROW EXECUTE FUNCTION kg_notify_change();
CREATE OR REPLACE TRIGGER trg_kg_persons AFTER INSERT OR UPDATE ON core.persons FOR EACH ROW EXECUTE FUNCTION kg_notify_change();
CREATE OR REPLACE TRIGGER trg_kg_org_nodes AFTER INSERT OR UPDATE OR DELETE ON workforce_org_nodes FOR EACH ROW EXECUTE FUNCTION kg_notify_change();
CREATE OR REPLACE TRIGGER trg_kg_org_groups AFTER INSERT OR UPDATE OR DELETE ON workforce_org_groups FOR EACH ROW EXECUTE FUNCTION kg_notify_change();
CREATE OR REPLACE TRIGGER trg_kg_assignments AFTER INSERT OR UPDATE OR DELETE ON core.assignments FOR EACH ROW EXECUTE FUNCTION kg_notify_change();

-- Tier 2: Content
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_calendar_events AFTER INSERT OR UPDATE ON calendar.events FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_documents AFTER INSERT OR UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_chat_channels AFTER INSERT OR UPDATE ON chat.channels FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_mail_accounts AFTER INSERT OR UPDATE ON mail.accounts FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_files AFTER INSERT OR UPDATE ON storage.files FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Tier 3: Specialized
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_meetings AFTER INSERT OR UPDATE ON meet.rooms FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_forms AFTER INSERT OR UPDATE ON forms.forms FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_social_posts AFTER INSERT OR UPDATE ON social.posts FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_crm_leads AFTER INSERT OR UPDATE ON crm.leads FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_courses AFTER INSERT OR UPDATE ON workforce.courses FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Tier 4: Infrastructure
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_it_hardware AFTER INSERT OR UPDATE ON it.hardware FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_it_tickets AFTER INSERT OR UPDATE ON it.tickets FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE OR REPLACE TRIGGER trg_kg_invoices AFTER INSERT OR UPDATE ON billing.invoices FOR EACH ROW EXECUTE FUNCTION kg_notify_change(); EXCEPTION WHEN undefined_table THEN NULL; END $$;
