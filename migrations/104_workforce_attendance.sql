-- Migration 104: workforce_attendance table
-- HR2: Clock-in / Clock-out attendance tracking

CREATE TABLE IF NOT EXISTS workforce_attendance (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL,
    employee_id UUID        NOT NULL,
    clock_in    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out   TIMESTAMPTZ,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT workforce_attendance_employee_fk
        FOREIGN KEY (employee_id) REFERENCES workforce_employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS workforce_attendance_tenant_emp_idx
    ON workforce_attendance (tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS workforce_attendance_open_idx
    ON workforce_attendance (tenant_id, employee_id)
    WHERE clock_out IS NULL;

COMMENT ON TABLE workforce_attendance IS
    'HR2: Records employee clock-in/clock-out events for time tracking.';
