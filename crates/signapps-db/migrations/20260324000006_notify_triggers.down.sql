DROP TRIGGER IF EXISTS trg_envelope_notify ON signature.envelopes;
DROP TRIGGER IF EXISTS trg_step_notify ON signature.steps;
DROP TRIGGER IF EXISTS trg_entity_ref_notify ON platform.entity_references;
DROP TRIGGER IF EXISTS trg_activity_notify ON platform.activities;
DROP FUNCTION IF EXISTS signature.notify_envelope();
DROP FUNCTION IF EXISTS signature.notify_step();
DROP FUNCTION IF EXISTS platform.notify_entity_change();
