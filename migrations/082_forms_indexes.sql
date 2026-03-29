-- Migration: Add missing indexes on forms tables
-- Improves query performance for owner-based and form_id-based lookups

CREATE INDEX IF NOT EXISTS idx_forms_owner_id ON forms.forms(owner_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON forms.form_responses(form_id);
