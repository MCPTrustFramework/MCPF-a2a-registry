CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- A2A delegation policies
CREATE TABLE IF NOT EXISTS a2a_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    allowed_actions JSONB NOT NULL,
    constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    issued_by TEXT NOT NULL,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    UNIQUE(from_agent, to_agent)
);

-- A2A audit log
CREATE TABLE IF NOT EXISTS a2a_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    policy_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_a2a_policies_from ON a2a_policies (from_agent);
CREATE INDEX IF NOT EXISTS idx_a2a_policies_to ON a2a_policies (to_agent);
CREATE INDEX IF NOT EXISTS idx_a2a_policies_status ON a2a_policies (status);
CREATE INDEX IF NOT EXISTS idx_a2a_audit_timestamp ON a2a_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_a2a_audit_from ON a2a_audit_log (from_agent);
CREATE INDEX IF NOT EXISTS idx_a2a_audit_to ON a2a_audit_log (to_agent);
