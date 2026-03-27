-- Migration 072: Calendar out-of-office and schedule polls

-- ---------------------------------------------------------------------------
-- calendar.out_of_office — per-user OOO settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar.out_of_office (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    ooo_start  TIMESTAMPTZ,
    ooo_end    TIMESTAMPTZ,
    message    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_out_of_office_user_id ON calendar.out_of_office(user_id);

-- ---------------------------------------------------------------------------
-- calendar.schedule_polls — Doodle-style scheduling polls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar.schedule_polls (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'confirmed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_polls_organizer ON calendar.schedule_polls(organizer_id);
CREATE INDEX IF NOT EXISTS idx_schedule_polls_status    ON calendar.schedule_polls(status);

-- ---------------------------------------------------------------------------
-- calendar.poll_slots — proposed time slots for a poll
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar.poll_slots (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id    UUID NOT NULL REFERENCES calendar.schedule_polls(id) ON DELETE CASCADE,
    slot_date  DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poll_slots_poll_id ON calendar.poll_slots(poll_id);

-- ---------------------------------------------------------------------------
-- calendar.poll_votes — participant votes per slot
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar.poll_votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id      UUID NOT NULL REFERENCES calendar.poll_slots(id) ON DELETE CASCADE,
    voter_name   TEXT NOT NULL,
    voter_email  TEXT NOT NULL,
    vote         TEXT NOT NULL DEFAULT 'yes' CHECK (vote IN ('yes', 'maybe', 'no')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slot_id, voter_email)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_slot_id      ON calendar.poll_votes(slot_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_voter_email  ON calendar.poll_votes(voter_email);

-- confirmed_event_id: set when organizer confirms a slot
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'calendar' AND table_name = 'schedule_polls' AND column_name = 'confirmed_slot_id'
    ) THEN
        ALTER TABLE calendar.schedule_polls ADD COLUMN confirmed_slot_id UUID REFERENCES calendar.poll_slots(id) ON DELETE SET NULL;
        ALTER TABLE calendar.schedule_polls ADD COLUMN confirmed_event_id UUID;
    END IF;
END $$;
