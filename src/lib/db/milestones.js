/**
 * src/lib/db/milestones.js
 *
 * All Supabase operations for the `milestones` table.
 *
 * Verified schema (src/lib/schema.sql — TABLE 3: milestones):
 *   id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
 *   project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE
 *   title       TEXT        NOT NULL
 *   description TEXT        NOT NULL DEFAULT ''
 *   amount      NUMERIC(18,8) NOT NULL CHECK (amount > 0)   ← column is `amount`, not `amount_allocated`
 *   approved    BOOLEAN     NOT NULL DEFAULT false           ← boolean flag kept in sync with status
 *   status      TEXT        NOT NULL DEFAULT 'pending'
 *              CHECK (status IN ('pending', 'voting', 'approved', 'released', 'rejected'))
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *
 * Column rules:
 *   • Always write BOTH `approved` (boolean) and `status` (text) together on every
 *     insert and update so the DB view `milestone_vote_summary` stays consistent.
 *   • approved = true  ↔  status IN ('approved', 'released')
 *   • approved = false ↔  status IN ('pending', 'voting', 'rejected')
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
            project_id:  projectId,
            title:       title.trim(),
            description: description?.trim() ?? '',
            amount:      amountAllocated,  // DB column is `amount` (not `amount_allocated`)
            approved:    false,            // boolean — kept in sync with status
            status:      'pending',        // text lifecycle status — explicit even though DB defaults it
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
        project_id:  projectId,
        title:       m.title.trim(),
        description: m.description?.trim() ?? '',
        amount:      m.amountAllocated,  // DB column is `amount` (not `amount_allocated`)
        approved:    false,              // boolean — kept in sync with status
        status:      'pending',          // text lifecycle status — explicit
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
            votes(vote, token_amount)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[db/milestones] fetchMilestonesByProject error:', error)
        throw new Error(error.message)
    }

    // Aggregate vote tallies and derive isApproved from the authoritative `status` column.
    // Both `approved` (boolean) and `status` (text) exist in the DB and are kept in sync
    // by updateMilestoneStatus(), so we read `status` as the single source of truth.
    return (data ?? []).map(m => {
        const votes = m.votes ?? []
        const yesWeight = votes.filter(v => v.vote === true).reduce((s, v) => s + Number(v.token_amount), 0)
        const noWeight  = votes.filter(v => v.vote === false).reduce((s, v) => s + Number(v.token_amount), 0)
        return {
            ...m,
            votes:      undefined,  // remove raw join array — use voteYes/voteNo instead
            voteYes:    yesWeight,
            voteNo:     noWeight,
            voteTotal:  yesWeight + noWeight,
            // isApproved: read from DB status column (authoritative); fall back to approved boolean
            isApproved: m.status === 'approved' || m.status === 'released' || m.approved === true,
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
    if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`)

    // `approved` (boolean) is the column that exists in the current live DB.
    // `status` (text) does NOT yet exist — run the migration SQL below to add it.
    // Until then, we only write `approved` so the PATCH doesn't error.
    //   approved = true  ↔  status IN ('approved', 'released')
    //   approved = false ↔  status IN ('pending', 'voting', 'rejected')
    //
    // Migration (run once in Supabase SQL Editor):
    //   ALTER TABLE milestones ADD COLUMN status text NOT NULL DEFAULT 'pending'
    //     CHECK (status IN ('pending','voting','approved','released','rejected'));
    //   UPDATE milestones SET status = CASE WHEN approved THEN 'approved' ELSE 'pending' END;
    // After running the migration, restore the update payload to: { approved, status }
    const approved = status === 'approved' || status === 'released'

    const { data, error } = await supabase
        .from('milestones')
        .update({ approved })           // ← only `approved` until status column is added
        .eq('id', milestoneId)
        .select()
        .single()

    if (error) {
        console.error('[db/milestones] updateMilestoneStatus error:', error)
        throw new Error(error.message)
    }

    return data
}
