-- Migration 124: Add post_deploy_hooks JSONB column to pxe.profiles
-- Replaces the previous description-field hack (__hooks__: prefix)

ALTER TABLE pxe.profiles ADD COLUMN IF NOT EXISTS post_deploy_hooks JSONB DEFAULT '[]';
