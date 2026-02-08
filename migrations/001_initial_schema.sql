-- SignApps Platform - Initial Schema Migration
-- Version: 001
-- Date: 2026-02-08

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Schema: Identity (Authentication, Users, Groups, RBAC)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS identity;

-- Users table
CREATE TABLE identity.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,  -- NULL if auth_provider = 'ldap'
    role SMALLINT NOT NULL DEFAULT 1,  -- 1=user, 2=admin, 3=superadmin
    mfa_secret TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    -- Active Directory / LDAP
    auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',  -- 'local' | 'ldap'
    ldap_dn TEXT,  -- Distinguished Name AD
    ldap_groups TEXT[],  -- Synced AD groups
    -- Metadata
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON identity.users(username);
CREATE INDEX idx_users_email ON identity.users(email);
CREATE INDEX idx_users_auth_provider ON identity.users(auth_provider);

-- LDAP Configuration
CREATE TABLE identity.ldap_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT FALSE,
    server_url TEXT NOT NULL,
    bind_dn TEXT NOT NULL,
    bind_password_encrypted TEXT NOT NULL,
    base_dn TEXT NOT NULL,
    user_filter TEXT DEFAULT '(&(objectClass=user)(sAMAccountName={username}))',
    group_filter TEXT DEFAULT '(objectClass=group)',
    admin_groups TEXT[] DEFAULT '{}',
    user_groups TEXT[] DEFAULT '{}',
    use_tls BOOLEAN DEFAULT TRUE,
    skip_tls_verify BOOLEAN DEFAULT FALSE,
    sync_interval_minutes INT DEFAULT 60,
    fallback_local_auth BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE identity.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON identity.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON identity.sessions(expires_at);

-- API Keys
CREATE TABLE identity.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON identity.api_keys(user_id);

-- Groups (RBAC)
CREATE TABLE identity.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES identity.groups(id),
    ldap_dn TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_parent_id ON identity.groups(parent_id);

-- Group Members
CREATE TABLE identity.group_members (
    group_id UUID REFERENCES identity.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    role VARCHAR(32) DEFAULT 'member',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Roles
CREATE TABLE identity.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group-Role assignments
CREATE TABLE identity.group_roles (
    group_id UUID REFERENCES identity.groups(id) ON DELETE CASCADE,
    role_id UUID REFERENCES identity.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, role_id)
);

-- Webhooks
CREATE TABLE identity.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT[] NOT NULL,
    headers JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMPTZ,
    last_status INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Schema: Containers
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS containers;

-- Managed containers
CREATE TABLE containers.managed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docker_id VARCHAR(64) UNIQUE,
    name VARCHAR(255) NOT NULL,
    image TEXT NOT NULL,
    status VARCHAR(32),
    config JSONB,
    labels JSONB,
    auto_update BOOLEAN DEFAULT FALSE,
    owner_id UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_containers_owner_id ON containers.managed(owner_id);
CREATE INDEX idx_containers_status ON containers.managed(status);

-- User quotas
CREATE TABLE containers.user_quotas (
    user_id UUID PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
    max_containers INT DEFAULT 10,
    max_cpu_cores DECIMAL(4,2) DEFAULT 4.0,
    max_memory_mb INT DEFAULT 8192,
    max_storage_gb INT DEFAULT 100,
    current_containers INT DEFAULT 0,
    current_cpu_cores DECIMAL(4,2) DEFAULT 0,
    current_memory_mb INT DEFAULT 0,
    current_storage_gb INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Schema: Proxy
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS proxy;

-- Routes
CREATE TABLE proxy.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    host VARCHAR(255) NOT NULL,
    target TEXT NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'proxy',
    tls_enabled BOOLEAN DEFAULT TRUE,
    auth_required BOOLEAN DEFAULT FALSE,
    shield_config JSONB,
    headers JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routes_host ON proxy.routes(host);

-- ============================================================================
-- Schema: SecureLink (VPN)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS securelink;

-- Devices
CREATE TABLE securelink.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    nickname VARCHAR(255),
    public_key TEXT NOT NULL,
    ip_address INET NOT NULL,
    is_lighthouse BOOLEAN DEFAULT FALSE,
    is_relay BOOLEAN DEFAULT FALSE,
    blocked BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Schema: Storage (including RAID)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS storage;

-- RAID Arrays
CREATE TABLE storage.raid_arrays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    device_path TEXT NOT NULL,
    raid_level VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    total_size_bytes BIGINT,
    used_size_bytes BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disks
CREATE TABLE storage.disks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_path TEXT UNIQUE NOT NULL,
    serial_number VARCHAR(255),
    model VARCHAR(255),
    size_bytes BIGINT,
    status VARCHAR(32) NOT NULL,
    smart_data JSONB,
    array_id UUID REFERENCES storage.raid_arrays(id),
    slot_number INT,
    last_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disks_array_id ON storage.disks(array_id);
CREATE INDEX idx_disks_status ON storage.disks(status);

-- RAID Events
CREATE TABLE storage.raid_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    array_id UUID REFERENCES storage.raid_arrays(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raid_events_array_id ON storage.raid_events(array_id);
CREATE INDEX idx_raid_events_created_at ON storage.raid_events(created_at DESC);

-- ============================================================================
-- Schema: Documents (AI/RAG)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS documents;

-- Files
CREATE TABLE documents.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(500) NOT NULL,
    path TEXT NOT NULL,
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    checksum_sha256 TEXT,
    minio_bucket VARCHAR(255) NOT NULL,
    minio_key TEXT NOT NULL,
    indexed BOOLEAN DEFAULT FALSE,
    indexed_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_path ON documents.files(path);
CREATE INDEX idx_files_indexed ON documents.files(indexed);

-- Chunks (for RAG)
CREATE TABLE documents.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    qdrant_point_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_file_id ON documents.chunks(file_id);

-- ============================================================================
-- Schema: Scheduler
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS scheduler;

-- Jobs
CREATE TABLE scheduler.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMPTZ,
    last_status VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Runs
CREATE TABLE scheduler.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES scheduler.jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL,
    output TEXT,
    error TEXT
);

CREATE INDEX idx_job_runs_job_id ON scheduler.job_runs(job_id);
CREATE INDEX idx_job_runs_started_at ON scheduler.job_runs(started_at DESC);

-- ============================================================================
-- Insert default roles
-- ============================================================================
INSERT INTO identity.roles (name, description, permissions, is_system) VALUES
('admin', 'Full system access', '{"*": ["*"]}', TRUE),
('user', 'Standard user access', '{"containers": ["read"], "storage": ["read", "write"], "ai": ["read"]}', TRUE),
('viewer', 'Read-only access', '{"containers": ["read"], "storage": ["read"]}', TRUE);
