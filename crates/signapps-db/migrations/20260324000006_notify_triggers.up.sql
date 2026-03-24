CREATE OR REPLACE FUNCTION signature.notify_envelope() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('signature_events', json_build_object(
        'action', TG_OP,
        'table', 'envelopes',
        'id', NEW.id,
        'envelope_id', NEW.id,
        'status', NEW.status
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signature.notify_step() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('signature_events', json_build_object(
        'action', TG_OP,
        'table', 'steps',
        'id', NEW.id,
        'envelope_id', NEW.envelope_id,
        'status', NEW.status
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_envelope_notify
    AFTER INSERT OR UPDATE ON signature.envelopes
    FOR EACH ROW EXECUTE FUNCTION signature.notify_envelope();

CREATE TRIGGER trg_step_notify
    AFTER INSERT OR UPDATE ON signature.steps
    FOR EACH ROW EXECUTE FUNCTION signature.notify_step();

CREATE OR REPLACE FUNCTION platform.notify_entity_change() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('entity_changes', json_build_object(
        'table', TG_TABLE_NAME,
        'action', TG_OP,
        'id', NEW.id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_ref_notify
    AFTER INSERT OR UPDATE ON platform.entity_references
    FOR EACH ROW EXECUTE FUNCTION platform.notify_entity_change();

CREATE TRIGGER trg_activity_notify
    AFTER INSERT ON platform.activities
    FOR EACH ROW EXECUTE FUNCTION platform.notify_entity_change();
