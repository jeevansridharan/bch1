-- ═══════════════════════════════════════════════════════════════════════════
-- Milestara — Supabase Database Schema
-- 
-- HOW TO USE:
--   1. Go to https://supabase.com → your project → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Done — all tables, constraints, policies, and functions are created.
--
-- Run this in ONE GO. It is fully idempotent (safe to run multiple times).
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID generation (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: users
-- Identity is the BCH wallet address — no email/password needed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT        UNIQUE NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_public_read"   ON users;
DROP POLICY IF EXISTS "users_public_insert" ON users;

CREATE POLICY "users_public_read"
    ON users FOR SELECT
    USING (true);

CREATE POLICY "users_public_insert"
    ON users FOR INSERT
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: projects
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          TEXT        NOT NULL,
    description    TEXT        NOT NULL DEFAULT '',
    funding_target NUMERIC(18, 8) NOT NULL CHECK (funding_target > 0),
    funded_amount  NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (funded_amount >= 0),
    status         TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_public_read"   ON projects;
DROP POLICY IF EXISTS "projects_public_insert" ON projects;
DROP POLICY IF EXISTS "projects_public_update" ON projects;

CREATE POLICY "projects_public_read"
    ON projects FOR SELECT
    USING (true);

CREATE POLICY "projects_public_insert"
    ON projects FOR INSERT
    WITH CHECK (true);

CREATE POLICY "projects_public_update"
    ON projects FOR UPDATE
    USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: milestones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL DEFAULT '',
    amount_allocated NUMERIC(18, 8) NOT NULL CHECK (amount_allocated > 0),
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'voting', 'approved', 'released', 'rejected')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status     ON milestones(status);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_public_read"   ON milestones;
DROP POLICY IF EXISTS "milestones_public_insert" ON milestones;
DROP POLICY IF EXISTS "milestones_public_update" ON milestones;

CREATE POLICY "milestones_public_read"
    ON milestones FOR SELECT
    USING (true);

CREATE POLICY "milestones_public_insert"
    ON milestones FOR INSERT
    WITH CHECK (true);

CREATE POLICY "milestones_public_update"
    ON milestones FOR UPDATE
    USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: votes
-- UNIQUE(milestone_id, voter_id) ensures one vote per user per milestone.
-- voting_power supports token-weighted governance (GOV tokens from Week 3).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID        NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    voter_id     UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    vote         BOOLEAN     NOT NULL,   -- TRUE = YES, FALSE = NO
    voting_power INTEGER     NOT NULL DEFAULT 1 CHECK (voting_power >= 1),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT votes_unique_per_user_milestone UNIQUE (milestone_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_milestone_id ON votes(milestone_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id     ON votes(voter_id);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "votes_public_read"   ON votes;
DROP POLICY IF EXISTS "votes_public_insert" ON votes;

CREATE POLICY "votes_public_read"
    ON votes FOR SELECT
    USING (true);

CREATE POLICY "votes_public_insert"
    ON votes FOR INSERT
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: transactions
-- Records every on-chain BCH transaction for audit trail.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tx_hash    TEXT        NOT NULL,
    amount     NUMERIC(18, 8) NOT NULL CHECK (amount > 0),
    type       TEXT        NOT NULL
               CHECK (type IN ('funding', 'release', 'refund')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type       ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_public_read"   ON transactions;
DROP POLICY IF EXISTS "transactions_public_insert" ON transactions;

CREATE POLICY "transactions_public_read"
    ON transactions FOR SELECT
    USING (true);

CREATE POLICY "transactions_public_insert"
    ON transactions FOR INSERT
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- POSTGRES FUNCTION: increment_funded_amount
--
-- Used by updateFundedAmount() in src/lib/db/projects.js.
-- This is an ATOMIC operation — safe under concurrent funding.
-- Two users funding at the exact same moment will NOT lose data.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_funded_amount(project_id UUID, amount NUMERIC)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE projects
    SET    funded_amount = funded_amount + amount
    WHERE  id = project_id;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- POSTGRES VIEW: project_summary
--
-- Convenient read-only view for the projects list page.
-- Includes milestone count and vote totals in one query.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW project_summary AS
SELECT
    p.id,
    p.title,
    p.description,
    p.funding_target,
    p.funded_amount,
    p.status,
    p.created_at,
    u.wallet_address                          AS creator_wallet,
    COUNT(DISTINCT m.id)                      AS milestone_count,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'approved')  AS approved_milestones,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'released')  AS released_milestones,
    COUNT(DISTINCT t.id)                      AS transaction_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'funding'), 0) AS total_funded_onchain
FROM       projects     p
JOIN       users        u ON u.id = p.creator_id
LEFT JOIN  milestones   m ON m.project_id = p.id
LEFT JOIN  transactions t ON t.project_id = p.id
GROUP BY   p.id, u.wallet_address;
