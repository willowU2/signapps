-- SignApps Platform - Calendar Attendees: Support External (email-only) Invites
-- Version: 040
-- Date: 2026-03-22
-- Implements: V2-08 Calendar Event Invitations & RSVP
--
-- The original schema (011) required user_id NOT NULL, preventing email-only
-- external invites. This migration relaxes that constraint and adds:
--   - nullable user_id for external attendees
--   - CHECK: at least one of user_id or email must be non-null
--   - unique index on (event_id, email) for external attendees
--   - CHECK on rsvp_status values

-- Step 1: Drop the NOT NULL constraint on user_id
ALTER TABLE calendar.event_attendees
    ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Ensure at least one identifier is present
ALTER TABLE calendar.event_attendees
    ADD CONSTRAINT chk_attendee_identifier
    CHECK (user_id IS NOT NULL OR email IS NOT NULL);

-- Step 3: Unique index for external (email-only) attendees per event
-- Partial index: only applies when user_id IS NULL to avoid conflicts with the
-- existing UNIQUE(event_id, user_id) constraint for internal users.
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendees_event_email
    ON calendar.event_attendees (event_id, email)
    WHERE user_id IS NULL;

-- Step 4: Constrain rsvp_status to known values
ALTER TABLE calendar.event_attendees
    ADD CONSTRAINT chk_attendee_rsvp_status
    CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative'));

COMMENT ON TABLE calendar.event_attendees IS
    'Tracks per-event attendees with RSVP status. '
    'Internal users are identified by user_id; external attendees by email.';
