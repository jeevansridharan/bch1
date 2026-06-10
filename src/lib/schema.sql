-- ═══════════════════════════════════════════════════════════════════════════════
-- Milestara — Production SQL Schema v2
-- Paste this entire file into Supabase SQL Editor → Run
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: users
-- Wallet address = identity (Web3 pattern, no email/password)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT        UNIQUE NOT NULL,
    role           TEXT        NOT NULL DEFAULT 'investor'
                               CHECK (role IN ('investor', 'creator', 'admin')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users: public read"          ON users;
DROP POLICY IF EXISTS "users: insert for all"       ON users;
DROP POLICY IF EXISTS "users: update own"           ON users;

CREATE POLICY "users: public read"
    ON users FOR SELECT
    USING (true);

CREATE POLICY "users: insert for all"
    ON users FOR INSERT
    WITH CHECK (true);

CREATE POLICY "users: update own"
    ON users FOR UPDATE
    USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: projects
-- Uses owner_wallet directly — no FK to users (allows anonymous projects)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL DEFAULT '',
    goal_amount      NUMERIC(18,8) NOT NULL CHECK (goal_amount > 0),
    raised_amount    NUMERIC(18,8) NOT NULL DEFAULT 0 CHECK (raised_amount >= 0),
    owner_wallet     TEXT        NOT NULL,
    contract_address TEXT        NOT NULL DEFAULT '',
    status           TEXT        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'funded', 'completed', 'cancelled')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add contract_address if upgrading an existing database (idempotent)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_address TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_projects_owner_wallet ON projects(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at   ON projects(created_at DESC);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects: public read"   ON projects;
DROP POLICY IF EXISTS "projects: insert for all" ON projects;
DROP POLICY IF EXISTS "projects: update own"    ON projects;

CREATE POLICY "projects: public read"
    ON projects FOR SELECT
    USING (true);

CREATE POLICY "projects: insert for all"
    ON projects FOR INSERT
    WITH CHECK (true);

CREATE POLICY "projects: update own"
    ON projects FOR UPDATE
    USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: milestones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL
                            REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    amount      NUMERIC(18,8) NOT NULL CHECK (amount > 0),
    approved    BOOLEAN     NOT NULL DEFAULT false,
    status      TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'voting', 'approved', 'released', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add status column if upgrading an existing database (idempotent)
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'voting', 'approved', 'released', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_approved   ON milestones(approved);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones: public read"    ON milestones;
DROP POLICY IF EXISTS "milestones: insert for all" ON milestones;
DROP POLICY IF EXISTS "milestones: update for all" ON milestones;

CREATE POLICY "milestones: public read"
    ON milestones FOR SELECT
    USING (true);

CREATE POLICY "milestones: insert for all"
    ON milestones FOR INSERT
    WITH CHECK (true);

CREATE POLICY "milestones: update for all"
    ON milestones FOR UPDATE
    USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: transactions
-- Records every on-chain BCH event (fund / release / refund)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID        NOT NULL
                               REFERENCES projects(id) ON DELETE CASCADE,
    wallet_address TEXT        NOT NULL,
    tx_hash        TEXT        NOT NULL,
    amount         NUMERIC(18,8) NOT NULL CHECK (amount > 0),
    type           TEXT        NOT NULL
                               CHECK (type IN ('funding', 'release', 'refund')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_project_id     ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_type           ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at     ON transactions(created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: public read"    ON transactions;
DROP POLICY IF EXISTS "transactions: insert for all" ON transactions;

CREATE POLICY "transactions: public read"
    ON transactions FOR SELECT
    USING (true);

CREATE POLICY "transactions: insert for all"
    ON transactions FOR INSERT
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 5: contracts
-- Stores CashScript constructor params so funds can be released later.
-- One row per project (upserted on every deploy).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID        NOT NULL UNIQUE
                                 REFERENCES projects(id) ON DELETE CASCADE,
    contract_address TEXT        NOT NULL,
    creator_pubkey   TEXT        NOT NULL,   -- hex 33-byte compressed pubkey
    funder_pubkey    TEXT        NOT NULL,   -- hex 33-byte compressed pubkey
    oracle_pubkey    TEXT        NOT NULL,   -- hex 33-byte compressed pubkey
    milestone_id_hex TEXT        NOT NULL,   -- hex 32-byte milestone ID
    deadline         BIGINT      NOT NULL,   -- block height
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id      ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_address ON contracts(contract_address);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts: public read"    ON contracts;
DROP POLICY IF EXISTS "contracts: insert for all" ON contracts;
DROP POLICY IF EXISTS "contracts: update for all" ON contracts;

CREATE POLICY "contracts: public read"
    ON contracts FOR SELECT
    USING (true);

CREATE POLICY "contracts: insert for all"
    ON contracts FOR INSERT
    WITH CHECK (true);

CREATE POLICY "contracts: update for all"
    ON contracts FOR UPDATE
    USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 6: votes
-- Token-weighted voting — one wallet per milestone (enforced by UNIQUE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id   UUID        NOT NULL
                               REFERENCES milestones(id) ON DELETE CASCADE,
    wallet_address TEXT        NOT NULL,
    vote           BOOLEAN     NOT NULL,     -- true = YES, false = NO
    token_amount   NUMERIC     NOT NULL DEFAULT 1 CHECK (token_amount >= 1),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One wallet = one vote per milestone
    CONSTRAINT votes_unique_wallet_milestone UNIQUE (milestone_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_milestone_id   ON votes(milestone_id);
CREATE INDEX IF NOT EXISTS idx_votes_wallet_address ON votes(wallet_address);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "votes: public read"    ON votes;
DROP POLICY IF EXISTS "votes: insert for all" ON votes;

CREATE POLICY "votes: public read"
    ON votes FOR SELECT
    USING (true);

CREATE POLICY "votes: insert for all"
    ON votes FOR INSERT
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: increment_raised_amount
-- Atomic add to raised_amount — prevents race conditions on concurrent funding
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_raised_amount(p_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE projects
    SET    raised_amount = raised_amount + p_amount
    WHERE  id = p_id;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: approve_milestone
-- Sets approved = true and optionally marks project completed
-- if all milestones are approved
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_milestone(m_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_project_id   UUID;
    v_total        INT;
    v_approved     INT;
BEGIN
    -- Mark this milestone approved
    UPDATE milestones SET approved = true WHERE id = m_id
    RETURNING project_id INTO v_project_id;

    -- Count totals for the project
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE approved = true)
    INTO   v_total, v_approved
    FROM   milestones
    WHERE  project_id = v_project_id;

    -- If all milestones approved → mark project completed
    IF v_total > 0 AND v_total = v_approved THEN
        UPDATE projects SET status = 'completed' WHERE id = v_project_id;
    END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: project_summary
-- Aggregated view used for the Projects list page
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW project_summary AS
SELECT
    p.id,
    p.title,
    p.description,
    p.goal_amount,
    p.raised_amount,
    p.owner_wallet,
    p.status,
    p.created_at,
    ROUND((p.raised_amount / NULLIF(p.goal_amount, 0)) * 100, 2)  AS funded_percent,
    COUNT(DISTINCT m.id)                                            AS milestone_count,
    COUNT(DISTINCT m.id) FILTER (WHERE m.approved = true)          AS approved_milestones,
    COUNT(DISTINCT t.id)                                            AS total_transactions,
    COALESCE(SUM(DISTINCT t.amount) FILTER (WHERE t.type = 'funding'), 0) AS total_funded_onchain,
    COUNT(DISTINCT v.wallet_address)                                AS unique_voters
FROM       projects     p
LEFT JOIN  milestones   m ON m.project_id = p.id
LEFT JOIN  transactions t ON t.project_id = p.id
LEFT JOIN  votes        v ON v.milestone_id = m.id
GROUP BY   p.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: milestone_vote_summary
-- Per-milestone YES/NO tally with approval status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW milestone_vote_summary AS
SELECT
    m.id                                                                      AS milestone_id,
    m.project_id,
    m.title,
    m.amount,
    m.approved,
    COUNT(v.id)                                                               AS total_votes,
    COALESCE(SUM(v.token_amount) FILTER (WHERE v.vote = true),  0)            AS yes_tokens,
    COALESCE(SUM(v.token_amount) FILTER (WHERE v.vote = false), 0)            AS no_tokens,
    COALESCE(SUM(v.token_amount), 0)                                          AS total_tokens,
    ROUND(
        COALESCE(SUM(v.token_amount) FILTER (WHERE v.vote = true), 0)
        / NULLIF(SUM(v.token_amount), 0) * 100
    , 2)                                                                       AS yes_percent
FROM      milestones m
LEFT JOIN votes      v ON v.milestone_id = m.id
GROUP BY  m.id;


-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DONE — Tables, indexes, RLS, functions, and views are ready.
-- ═══════════════════════════════════════════════════════════════════════════════
