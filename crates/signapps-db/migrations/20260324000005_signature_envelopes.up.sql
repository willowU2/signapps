CREATE SCHEMA IF NOT EXISTS signature;

CREATE TABLE IF NOT EXISTS signature.envelopes (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    title TEXT NOT NULL,
    document_id UUID NOT NULL REFERENCES drive.nodes(id),
    created_by UUID NOT NULL REFERENCES identity.users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'declined', 'expired', 'voided')),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_envelopes_status ON signature.envelopes(status);
CREATE INDEX IF NOT EXISTS idx_envelopes_creator ON signature.envelopes(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_envelopes_document ON signature.envelopes(document_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_metadata ON signature.envelopes USING GIN(metadata);

CREATE TABLE IF NOT EXISTS signature.steps (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    envelope_id UUID NOT NULL REFERENCES signature.envelopes(id) ON DELETE CASCADE,
    step_order SMALLINT NOT NULL,
    signer_email BYTEA NOT NULL,
    signer_user_id UUID REFERENCES identity.users(id),
    signer_name BYTEA,
    action VARCHAR(20) NOT NULL DEFAULT 'sign'
        CHECK (action IN ('sign', 'approve', 'witness', 'acknowledge', 'delegate')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'notified', 'viewed', 'signed', 'declined', 'delegated', 'expired')),
    signed_at TIMESTAMPTZ,
    signature_hash CHAR(64),
    ip_address TEXT,
    user_agent TEXT,
    decline_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(envelope_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_steps_envelope ON signature.steps(envelope_id, step_order);
CREATE INDEX IF NOT EXISTS idx_steps_signer ON signature.steps(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON signature.steps(status);

CREATE TABLE IF NOT EXISTS signature.transitions (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    envelope_id UUID NOT NULL REFERENCES signature.envelopes(id),
    step_id UUID REFERENCES signature.steps(id),
    from_status VARCHAR(20) NOT NULL,
    to_status VARCHAR(20) NOT NULL,
    triggered_by UUID REFERENCES identity.users(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transitions_envelope ON signature.transitions(envelope_id, created_at);
