-- Migration 092: Move floor_plans from public to calendar schema
-- The crate migration (20240321000001_create_floor_plans.up.sql) creates the
-- table in the public schema. The calendar service owns this resource, so we
-- move it (or create it) under the calendar schema.
-- Columns match 20240321000001_create_floor_plans.up.sql exactly:
--   id, name, floor, width, height, resources, svg_content,
--   created_at, updated_at

-- Move existing table if it lives in public
ALTER TABLE IF EXISTS public.floor_plans SET SCHEMA calendar;

-- If the table didn't exist in public (and therefore isn't now in calendar),
-- create it from scratch with the canonical column set
CREATE TABLE IF NOT EXISTS calendar.floor_plans (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255)        NOT NULL,
    floor       VARCHAR(50)         NOT NULL,
    width       DOUBLE PRECISION    NOT NULL,
    height      DOUBLE PRECISION    NOT NULL,
    resources   JSONB               NOT NULL DEFAULT '[]'::jsonb,
    svg_content TEXT,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
