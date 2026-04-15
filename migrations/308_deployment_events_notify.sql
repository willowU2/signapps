-- Migration 308: Emit deployment events via pg_notify for the /events WebSocket.
--
-- The `signapps-deploy` service exposes `GET /api/v1/deploy/events` as a
-- WebSocket that forwards real-time deployment lifecycle events to operators.
-- This trigger turns every INSERT on `deployment_audit_log` into a
-- `NOTIFY deployment_events <json>` so the WS handler can subscribe with
-- sqlx::postgres::PgListener without any orchestrator-side changes.
--
-- Payload shape (JSON):
--   {
--     "id":            "<uuid of the audit row>",
--     "deployment_id": "<uuid of the deployment, or null>",
--     "action":        "<e.g. 'deploy_requested', 'deploy_succeeded'>",
--     "payload":       <jsonb from the audit row, may be null>,
--     "timestamp":     "<ISO8601 timestamptz>"
--   }

BEGIN;

CREATE OR REPLACE FUNCTION notify_deployment_event() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'deployment_events',
        json_build_object(
            'id', NEW.id,
            'deployment_id', NEW.deployment_id,
            'action', NEW.action,
            'payload', NEW.payload,
            'timestamp', NEW.timestamp
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deployment_audit_notify ON deployment_audit_log;
CREATE TRIGGER deployment_audit_notify
    AFTER INSERT ON deployment_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION notify_deployment_event();

COMMIT;
