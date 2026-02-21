/**
 * src/lib/db/projects.js
 *
 * All Supabase operations for the `projects` table.
 *
 * Schema (run in Supabase SQL Editor):
 *   CREATE TABLE projects (
 *     id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     creator_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *     title          TEXT NOT NULL,
 *     description    TEXT,
 *     funding_target NUMERIC(18, 8) NOT NULL,
 *     funded_amount  NUMERIC(18, 8) NOT NULL DEFAULT 0,
 *     status         TEXT NOT NULL DEFAULT 'active'
 *                    CHECK (status IN ('active', 'completed', 'cancelled')),
 *     created_at     TIMESTAMPTZ DEFAULT now()
 *   );
 *   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read"   ON projects FOR SELECT USING (true);
 *   CREATE POLICY "Creator write" ON projects FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Creator update" ON projects FOR UPDATE USING (true);
 */

import { supabase } from '../supabase'

function requireSupabase() {
    if (!supabase) throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * createProject({ creatorId, title, description, fundingTarget, milestones })
 *
 * Inserts a new project row. The milestones array is handled separately by
 * the createMilestone function — this only creates the project header.
 *
 * @param {object} params
 * @param {string} params.creatorId      UUID of the user (from users table)
 * @param {string} params.title          Project title
 * @param {string} params.description    Project description
 * @param {number} params.fundingTarget  Target BCH amount (e.g. 0.5)
 * @returns {Promise<Project>}
 */
export async function createProject({ creatorId, title, description, fundingTarget }) {
    if (!creatorId) throw new Error('creatorId is required')
    if (!title) throw new Error('title is required')
    if (!fundingTarget) throw new Error('fundingTarget is required')

    const { data, error } = await supabase
        .from('projects')
        .insert({
            creator_id: creatorId,
            title: title.trim(),
            description: description?.trim() ?? '',
            funding_target: fundingTarget,
            funded_amount: 0,
            status: 'active',
        })
        .select()
        .single()

    if (error) {
        console.error('[db/projects] createProject error:', error)
        throw new Error(error.message)
    }

    return data
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchProjects({ status, creatorId, limit, offset })
 *
 * Fetch projects with optional filters.
 * Joins milestones count and total funded amount for the list view.
 *
 * @param {object} [options]
 * @param {string} [options.status]     Filter by status: 'active' | 'completed' | 'cancelled'
 * @param {string} [options.creatorId]  Filter to only this creator's projects
 * @param {number} [options.limit=20]   Pagination limit
 * @param {number} [options.offset=0]   Pagination offset
 * @returns {Promise<Project[]>}
 */
export async function fetchProjects({ status, creatorId, limit = 20, offset = 0 } = {}) {
    let query = supabase
        .from('projects')
        .select(`
            *,
            creator:users(wallet_address),
            milestones(count)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (creatorId) query = query.eq('creator_id', creatorId)

    const { data, error } = await query

    if (error) {
        console.error('[db/projects] fetchProjects error:', error)
        throw new Error(error.message)
    }

    return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchProjectById(projectId)
 *
 * Fetch a single project with all its milestones and latest transactions.
 *
 * @param   {string} projectId  UUID
 * @returns {Promise<Project|null>}
 */
export async function fetchProjectById(projectId) {
    if (!projectId) throw new Error('projectId is required')

    const { data, error } = await supabase
        .from('projects')
        .select(`
            *,
            creator:users(wallet_address),
            milestones(*),
            transactions(*)
        `)
        .eq('id', projectId)
        .maybeSingle()

    if (error) {
        console.error('[db/projects] fetchProjectById error:', error)
        throw new Error(error.message)
    }

    return data
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * updateFundedAmount(projectId, additionalAmount)
 *
 * Atomically adds `additionalAmount` BCH to the project's funded_amount.
 * Uses Supabase's RPC (PostgreSQL function) to avoid race conditions —
 * two funders clicking at the same moment won't overwrite each other.
 *
 * ⚠️ You must create this Postgres function first (SQL Editor):
 *
 *   CREATE OR REPLACE FUNCTION increment_funded_amount(project_id UUID, amount NUMERIC)
 *   RETURNS void LANGUAGE sql AS $$
 *     UPDATE projects
 *     SET funded_amount = funded_amount + amount
 *     WHERE id = project_id;
 *   $$;
 *
 * @param   {string} projectId        UUID
 * @param   {number} additionalAmount BCH to add
 * @returns {Promise<void>}
 */
export async function updateFundedAmount(projectId, additionalAmount) {
    if (!projectId) throw new Error('projectId is required')
    if (!additionalAmount || additionalAmount <= 0) throw new Error('additionalAmount must be > 0')

    const { error } = await supabase
        .rpc('increment_funded_amount', {
            project_id: projectId,
            amount: additionalAmount,
        })

    if (error) {
        console.error('[db/projects] updateFundedAmount error:', error)
        throw new Error(error.message)
    }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * updateProjectStatus(projectId, status)
 *
 * Update the project's lifecycle status.
 *
 * @param {string} projectId
 * @param {'active'|'completed'|'cancelled'} status
 */
export async function updateProjectStatus(projectId, status) {
    if (!projectId) throw new Error('projectId is required')
    if (!['active', 'completed', 'cancelled'].includes(status)) {
        throw new Error('Invalid status. Must be active, completed, or cancelled.')
    }

    const { error } = await supabase
        .from('projects')
        .update({ status })
        .eq('id', projectId)

    if (error) {
        console.error('[db/projects] updateProjectStatus error:', error)
        throw new Error(error.message)
    }
}
