-- sqlx: disable-transaction
-- Migration 037: Add 'presentation' to drive.node_type ENUM
ALTER TYPE drive.node_type
ADD VALUE IF NOT EXISTS 'presentation';
