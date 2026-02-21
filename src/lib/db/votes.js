/**
 * src/lib/db/votes.js
 *
 * All Supabase operations for the `votes` table.
 *
 * Schema (run in Supabase SQL Editor):
 *   CREATE TABLE votes (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
 *     voter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *     vote         BOOLEAN NOT NULL,       -- true = YES,  false = NO
 *     voting_power INTEGER NOT NULL DEFAULT 1,
 *     created_at   TIMESTAMPTZ DEFAULT now(),
 *     UNIQUE(milestone_id, voter_id)       -- one vote per user per milestone
 *   );
 *   ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read"   ON votes FOR SELECT USING (true);
 *   CREATE POLICY "Voter insert"  ON votes FOR INSERT WITH CHECK (true);
 *   -- Note: no update/delete — votes are immutable once cast
 */

import { supabase } from '../supabase'
import { updateMilestoneStatus } from './milestones'

function requireSupabase() {
    if (!supabase) throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
}

// Threshold for governance approval (>50%)
const APPROVAL_THRESHOLD = 0.5

// ─────────────────────────────────────────────────────────────────────────────

/**
 * voteOnMilestone({ milestoneId, voterId, vote, votingPower })
 *
 * Casts a vote on a milestone. Each user can vote only once per milestone
 * (enforced by the UNIQUE constraint). After inserting, checks if the
 * milestone has now passed the approval threshold and auto-updates its status.
 *
 * @param {object}  params
 * @param {string}  params.milestoneId  UUID of the milestone
 * @param {string}  params.voterId      UUID of the voter (from users table)
 * @param {boolean} params.vote         true = YES, false = NO
 * @param {number}  [params.votingPower=1]  Token weight (GOV tokens used)
 * @returns {Promise<{ voteRecord, milestoneApproved, yesPercent }>}
 */
export async function voteOnMilestone({ milestoneId, voterId, vote, votingPower = 1 }) {
    if (!milestoneId) throw new Error('milestoneId is required')
    if (!voterId) throw new Error('voterId is required')
    if (typeof vote !== 'boolean') throw new Error('vote must be a boolean (true=YES, false=NO)')
    if (votingPower < 1) throw new Error('votingPower must be at least 1')

    // ── 1. Insert the vote ────────────────────────────────────────────────────
    const { data: voteRecord, error: insertError } = await supabase
        .from('votes')
        .insert({
            milestone_id: milestoneId,
            voter_id: voterId,
            vote,
            voting_power: votingPower,
        })
        .select()
        .single()

    if (insertError) {
        // Unique constraint violation = user already voted
        if (insertError.code === '23505') {
            throw new Error('You have already voted on this milestone.')
        }
        console.error('[db/votes] voteOnMilestone insert error:', insertError)
        throw new Error(insertError.message)
    }

    // ── 2. Recalculate vote tallies for this milestone ────────────────────────
    const { data: allVotes, error: fetchError } = await supabase
        .from('votes')
        .select('vote, voting_power')
        .eq('milestone_id', milestoneId)

    if (fetchError) {
        console.error('[db/votes] voteOnMilestone fetch votes error:', fetchError)
        throw new Error(fetchError.message)
    }

    const yesWeight = allVotes.filter(v => v.vote === true).reduce((s, v) => s + v.voting_power, 0)
    const noWeight = allVotes.filter(v => v.vote === false).reduce((s, v) => s + v.voting_power, 0)
    const total = yesWeight + noWeight
    const yesPercent = total > 0 ? Math.round((yesWeight / total) * 100) : 0
    const milestoneApproved = total > 0 && (yesWeight / total) > APPROVAL_THRESHOLD

    // ── 3. Auto-update milestone status if threshold reached ──────────────────
    if (milestoneApproved) {
        await updateMilestoneStatus(milestoneId, 'approved')
    } else if (total > 0) {
        // Voting has started but not yet passed
        await updateMilestoneStatus(milestoneId, 'voting')
    }

    return {
        voteRecord,
        milestoneApproved,
        yesPercent,
        yesWeight,
        noWeight,
        total,
    }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * getVotesByMilestone(milestoneId)
 *
 * Returns all votes for a milestone including voter wallet addresses.
 * Useful for displaying a vote history list.
 *
 * @param   {string} milestoneId
 * @returns {Promise<VoteWithVoter[]>}
 */
export async function getVotesByMilestone(milestoneId) {
    if (!milestoneId) throw new Error('milestoneId is required')

    const { data, error } = await supabase
        .from('votes')
        .select(`
            *,
            voter:users(wallet_address)
        `)
        .eq('milestone_id', milestoneId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[db/votes] getVotesByMilestone error:', error)
        throw new Error(error.message)
    }

    return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * hasUserVoted(milestoneId, voterId)
 *
 * Quick check — returns true if this user has already cast a vote on this milestone.
 * Use this to disable the Vote buttons in the UI.
 *
 * @param   {string} milestoneId
 * @param   {string} voterId
 * @returns {Promise<boolean>}
 */
export async function hasUserVoted(milestoneId, voterId) {
    if (!milestoneId || !voterId) return false

    const { count, error } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('milestone_id', milestoneId)
        .eq('voter_id', voterId)

    if (error) {
        console.error('[db/votes] hasUserVoted error:', error)
        return false
    }

    return (count ?? 0) > 0
}
