-- migrations/231_ad_sync_triggers.sql
-- Emit events into ad_sync_queue when org objects change

-- Helper: enqueue a sync event
CREATE OR REPLACE FUNCTION ad_sync_enqueue(
    p_domain_id UUID,
    p_event_type TEXT,
    p_payload JSONB,
    p_priority INT DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO ad_sync_queue (domain_id, event_type, payload, priority)
    VALUES (p_domain_id, p_event_type, p_payload, p_priority)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Resolve domain_id for an org node (via its tree's tenant → first active AD domain)
CREATE OR REPLACE FUNCTION ad_sync_resolve_domain(p_node_id UUID) RETURNS UUID AS $$
DECLARE
    v_domain_id UUID;
BEGIN
    SELECT d.id INTO v_domain_id
    FROM infrastructure.domains d
    JOIN core.org_trees t ON t.tenant_id = d.tenant_id
    JOIN core.org_nodes n ON n.tree_id = t.id
    WHERE n.id = p_node_id AND d.ad_enabled = true AND d.is_active = true
    LIMIT 1;
    RETURN v_domain_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: org_node changes → enqueue OU sync events
CREATE OR REPLACE FUNCTION ad_sync_on_org_node() RETURNS TRIGGER AS $$
DECLARE
    v_domain_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_domain_id := ad_sync_resolve_domain(OLD.id);
        IF v_domain_id IS NOT NULL THEN
            PERFORM ad_sync_enqueue(v_domain_id, 'ou_delete',
                jsonb_build_object('node_id', OLD.id, 'name', OLD.name, 'node_type', OLD.node_type), 5);
        END IF;
        RETURN OLD;
    END IF;

    v_domain_id := ad_sync_resolve_domain(NEW.id);
    IF v_domain_id IS NULL THEN RETURN NEW; END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'ou_create',
            jsonb_build_object('node_id', NEW.id, 'name', NEW.name, 'node_type', NEW.node_type, 'parent_id', NEW.parent_id), 3);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.name != NEW.name THEN
            PERFORM ad_sync_enqueue(v_domain_id, 'ou_rename',
                jsonb_build_object('node_id', NEW.id, 'old_name', OLD.name, 'new_name', NEW.name), 5);
        END IF;
        IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
            PERFORM ad_sync_enqueue(v_domain_id, 'ou_move',
                jsonb_build_object('node_id', NEW.id, 'old_parent', OLD.parent_id, 'new_parent', NEW.parent_id), 3);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_sync_org_node
    AFTER INSERT OR UPDATE OR DELETE ON core.org_nodes
    FOR EACH ROW
    EXECUTE FUNCTION ad_sync_on_org_node();

-- Trigger: assignment changes → enqueue user provision/disable events
CREATE OR REPLACE FUNCTION ad_sync_on_assignment() RETURNS TRIGGER AS $$
DECLARE
    v_domain_id UUID;
    v_node_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_node_id := OLD.node_id;
    ELSE
        v_node_id := NEW.node_id;
    END IF;

    v_domain_id := ad_sync_resolve_domain(v_node_id);
    IF v_domain_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'user_provision',
            jsonb_build_object('person_id', NEW.person_id, 'node_id', NEW.node_id, 'assignment_type', NEW.assignment_type), 1);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'user_disable',
            jsonb_build_object('person_id', OLD.person_id, 'node_id', OLD.node_id), 2);
    ELSIF TG_OP = 'UPDATE' AND OLD.node_id != NEW.node_id THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'user_move',
            jsonb_build_object('person_id', NEW.person_id, 'old_node', OLD.node_id, 'new_node', NEW.node_id), 3);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_sync_assignment
    AFTER INSERT OR UPDATE OR DELETE ON core.assignments
    FOR EACH ROW
    EXECUTE FUNCTION ad_sync_on_assignment();
