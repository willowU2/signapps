-- 287_calendar_meet_room.sql
-- Link calendar events to Meet rooms.

ALTER TABLE calendar.events
    ADD COLUMN IF NOT EXISTS has_meet_room BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS meet_room_code TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_events_meet_room_code
    ON calendar.events(meet_room_code)
    WHERE meet_room_code IS NOT NULL;
