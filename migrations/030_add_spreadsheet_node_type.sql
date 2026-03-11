-- Migration 030: Add 'spreadsheet' to drive.node_type ENUM
ALTER TYPE drive.node_type
ADD VALUE IF NOT EXISTS 'spreadsheet';