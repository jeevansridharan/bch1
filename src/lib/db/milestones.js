/**
 * src/lib/db/milestones.js
 *
 * All Supabase operations for the `milestones` table.
 *
 * Schema (run in Supabase SQL Editor):
 *   CREATE TABLE milestones (
 *     id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 *     title            TEXT NOT NULL,
 *     description      TEXT,
 *     amount_allocated NUMERIC(18, 8) NOT NULL,
 *     status           TEXT NOT NULL DEFAULT 'pending'
 *                      CHECK (status IN ('pending', 'voting', 'approved', 'released', 'rejected')),
 *     created_at       TIMESTAMPTZ DEFAULT now()
 *   );
 *   ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read"    ON milestones FOR SELECT USING (true);
 *   CREATE POLICY "Creator insert" ON milestones FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Creator update" ON milestones FOR UPDATE USING (true);
 */

import { supabase } from '../supabase'

function requireSupabase() {
    if (!supabase) throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * createMilestone({ projectId, title, description, amountAllocated })
 *
 * Creates a single milestone row associated with a project.
 * Call this once per milestone when user creates the project.
 *
 * @param {object} params
 * @param {string} params.projectId        UUID of the parent project
 * @param {string} params.title            Milestone title
 * @param {string} [params.description]    Milestone description (optional)
 * @param {number} params.amountAllocated  BCH allocated to this milestone
 * @returns {Promise<Milestone>}
 */
export async function createMilestone({ projectId, title, description, amountAllocated }) {
    if (!projectId) throw new Error('projectId is required')
    if (!title) throw new Error('title is required')
    if (!amountAllocated || amountAllocated <= 0) throw new Error('amountAllocated must be > 0')

    const { data, error } = await supabase
        .from('milestones')
        .insert({
            project_id: projectId,
            title: title.trim(),
            description: description?.trim() ?? '',
            amount_allocated: amountAllocated,
            status: 'pending',
        })
        .select()
        .single()

    if (error) {
        console.error('[db/milestones] createMilestone error:', error)
        throw new Error(error.message)
    }

    return data
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * createMilestoneBatch(projectId, milestonesArray)
 *
 * Inserts multiple milestones in a single DB round-trip.
 * More efficient than calling createMilestone() in a loop.
 *
 * @param {string}   projectId
 * @param {Array<{ title, description?, amountAllocated }>} milestonesArray
 * @returns {Promise<Milestone[]>}
 */
export async function createMilestoneBatch(projectId, milestonesArray) {
    if (!projectId) throw new Error('projectId is required')
    if (!milestonesArray?.length) throw new Error('milestonesArray must not be empty')

    const rows = milestonesArray.map(m => ({
        project_id: projectId,
        title: m.title.trim(),
        description: m.description?.trim() ?? '',
        amount_allocated: m.amountAllocated,
        status: 'pending',
    }))

    const { data, error } = await supabase
        .from('milestones')
        .insert(rows)
        .select()

    if (error) {
        console.error('[db/milestones] createMilestoneBatch error:', error)
        throw new Error(error.message)
    }

    return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchMilestonesByProject(projectId)
 *
 * Returns all milestones for a project, ordered by created_at.
 * Includes vote tallies via a joined sub-query.
 *
 * @param   {string} projectId
 * @returns {Promise<Milestone[]>}
 */
export async function fetchMilestonesByProject(projectId) {
    if (!projectId) throw new Error('projectId is required')

    const { data, error } = await supabase
        .from('milestones')
        .select(`
            *,
            votes(vote, voting_power)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[db/milestones] fetchMilestonesByProject error:', error)
        throw new Error(error.message)
    }

    // Compute yes/no tallies locally from the joined vote rows
    return (data ?? []).map(m => {
        const votes = m.votes ?? []
        const yesWeight = votes.filter(v => v.vote === true).reduce((s, v) => s + v.voting_power, 0)
        const noWeight = votes.filter(v => v.vote === false).reduce((s, v) => s + v.voting_power, 0)
        return {
            ...m,
            votes: undefined,     // remove raw array
            voteYes: yesWeight,
            voteNo: noWeight,
            voteTotal: yesWeight + noWeight,
            isApproved: yesWeight + noWeight > 0 && yesWeight / (yesWeight + noWeight) > 0.5,
        }
    })
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * updateMilestoneStatus(milestoneId, status)
 *
 * Updates the lifecycle status of a milestone.
 * Typically called after governance approval or fund release.
 *
 * @param {string} milestoneId
 * @param {'pending'|'voting'|'approved'|'released'|'rejected'} status
 * @returns {Promise<Milestone>}
 */
export async function updateMilestoneStatus(milestoneId, status) {
    if (!milestoneId) throw new Error('milestoneId is required')

    const validStatuses = ['pending', 'voting', 'approved', 'released', 'rejected']
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
    }

    const { data, error } = await supabase
        .from('milestones')
        .update({ status })
        .eq('id', milestoneId)
        .select()
        .single()

    if (error) {
        console.error('[db/milestones] updateMilestoneStatus error:', error)
        throw new Error(error.message)
    }

    return data
}
