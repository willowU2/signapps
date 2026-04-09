-- Migration 262: Standalone Resources schema for room/equipment/vehicle booking
-- Adds a dedicated resources schema with EXCLUDE constraint for conflict-free reservations.

-- btree_gist is required for EXCLUDE constraints combining UUID equality with range overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS resources;

-- ============================================================================
-- Resource Items (rooms, equipment, vehicles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL,          -- 'room', 'equipment', 'vehicle'
    description TEXT,
    location TEXT,
    capacity INT,
    amenities TEXT[] DEFAULT '{}',
    image_url TEXT,
    available BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_items_type ON resources.items(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_items_available ON resources.items(available);

-- ============================================================================
-- Reservations with EXCLUDE constraint for conflict detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources.items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id),
    title TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'confirmed',      -- pending, confirmed, cancelled, completed
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent overlapping reservations on the same resource (only for non-cancelled)
    EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status NOT IN ('cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_resource ON resources.reservations(resource_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON resources.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON resources.reservations(status);
