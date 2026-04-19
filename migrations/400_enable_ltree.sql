-- S1 W1 / Task 1 — Enable PostgreSQL LTREE extension.
--
-- Required for materialized-path queries on the canonical
-- org hierarchy (org_nodes.path), which the next migration
-- (401_org_nodes.sql) declares as `LTREE NOT NULL`.
--
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS ltree;
