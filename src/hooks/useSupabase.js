/**
 * src/hooks/useSupabase.js
 *
 * Central React hook for all Supabase-backed state.
 *
 * This hook manages:
 *   - Current user (upserted on wallet connect)
 *   - All projects list
 *   - Active project details + milestones
 *   - Loading and error states
 *
 * Usage in a component:
 *   const { user, projects, activeProject, createFullProject, fundProject } = useSupabase(walletAddress)
 */

import { useState, useEffect, useCallback } from 'react'
import {
    upsertUser,
    createProject,
    createMilestoneBatch,
    fetchProjects,
    fetchProjectById,
    fetchMilestonesByProject,
    updateFundedAmount,
    voteOnMilestone,
    insertTransaction,
    hasUserVoted,
} from '../lib/db'

// ─────────────────────────────────────────────────────────────────────────────

export function useSupabase(walletAddress = null) {
    const [user, setUser] = useState(null)
    const [projects, setProjects] = useState([])
    const [activeProject, setActiveProject] = useState(null)
    const [milestones, setMilestones] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // ── Auto-upsert user when wallet connects ─────────────────────────────────
    useEffect(() => {
        if (!walletAddress) {
            setUser(null)
            return
        }
        ; (async () => {
            try {
                const dbUser = await upsertUser(walletAddress)
                setUser(dbUser)
            } catch (e) {
                console.error('[useSupabase] upsertUser failed:', e)
                // Non-fatal: app still works without DB user
            }
        })()
    }, [walletAddress])

    // ── Load all projects ─────────────────────────────────────────────────────
    const loadProjects = useCallback(async (filters = {}) => {
        setLoading(true)
        setError(null)
        try {
            const data = await fetchProjects(filters)
            setProjects(data)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Load single project + its milestones ──────────────────────────────────
    const loadProject = useCallback(async (projectId) => {
        setLoading(true)
        setError(null)
        try {
            const [project, milestonesData] = await Promise.all([
                fetchProjectById(projectId),
                fetchMilestonesByProject(projectId),
            ])
            setActiveProject(project)
            setMilestones(milestonesData)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Create project + milestones in one call ───────────────────────────────
    /**
     * createFullProject({ title, description, fundingTarget, milestones })
     *
     * Creates the project row + all milestone rows in sequence.
     * Returns the created project with its milestones attached.
     *
     * @param {object} formData  — shape from ProjectForm
     * @returns {Promise<{ project, milestones }>}
     */
    const createFullProject = useCallback(async (formData) => {
        if (!user) throw new Error('Connect your wallet before creating a project.')
        setLoading(true)
        setError(null)
        try {
            // 1. Create project
            const project = await createProject({
                creatorId: user.id,
                title: formData.title,
                description: formData.description,
                fundingTarget: formData.fundingTarget,
            })

            // 2. Batch-insert milestones
            let createdMilestones = []
            if (formData.milestones?.length) {
                createdMilestones = await createMilestoneBatch(
                    project.id,
                    formData.milestones.map(m => ({
                        title: m.title,
                        description: m.description,
                        amountAllocated: m.amountAllocated ?? (project.funding_target / formData.milestones.length),
                    }))
                )
            }

            const fullProject = { ...project, milestones: createdMilestones }
            setActiveProject(fullProject)
            setMilestones(createdMilestones)
            return fullProject
        } catch (e) {
            setError(e.message)
            throw e
        } finally {
            setLoading(false)
        }
    }, [user])

    // ── Fund project (record on-chain tx + update DB) ─────────────────────────
    /**
     * recordFunding({ projectId, txHash, amount })
     *
     * After a successful Chipnet transaction, call this to:
     *   1. Record the tx in the transactions table
     *   2. Atomically increment the project's funded_amount
     *
     * @returns {Promise<void>}
     */
    const recordFunding = useCallback(async ({ projectId, txHash, amount }) => {
        setError(null)
        try {
            await Promise.all([
                insertTransaction({ projectId, txHash, amount, type: 'funding' }),
                updateFundedAmount(projectId, amount),
            ])
            // Refresh active project state if it's the one being funded
            if (activeProject?.id === projectId) {
                setActiveProject(prev => ({
                    ...prev,
                    funded_amount: (parseFloat(prev.funded_amount) + amount).toFixed(8),
                }))
            }
        } catch (e) {
            setError(e.message)
            throw e
        }
    }, [activeProject])

    // ── Vote on milestone ─────────────────────────────────────────────────────
    /**
     * castVoteDB({ milestoneId, vote, votingPower })
     *
     * Casts a vote using the logged-in user's ID.
     * Throws if the user hasn't connected their wallet.
     *
     * @param {string}  milestoneId
     * @param {boolean} vote          true = YES, false = NO
     * @param {number}  [votingPower] GOV token weight
     * @returns {Promise<VoteResult>}
     */
    const castVoteDB = useCallback(async ({ milestoneId, vote, votingPower = 1 }) => {
        if (!user) throw new Error('Connect your wallet to vote.')
        setError(null)
        try {
            const result = await voteOnMilestone({
                milestoneId,
                voterId: user.id,
                vote,
                votingPower,
            })
            // Update local milestone state to reflect new vote counts
            setMilestones(prev => prev.map(m => {
                if (m.id !== milestoneId) return m
                return {
                    ...m,
                    voteYes: result.yesWeight,
                    voteNo: result.noWeight,
                    voteTotal: result.total,
                    isApproved: result.milestoneApproved,
                    status: result.milestoneApproved ? 'approved' : 'voting',
                }
            }))
            return result
        } catch (e) {
            setError(e.message)
            throw e
        }
    }, [user])

    // ── Check if current user voted on a milestone ────────────────────────────
    const checkHasVoted = useCallback(async (milestoneId) => {
        if (!user) return false
        return hasUserVoted(milestoneId, user.id)
    }, [user])

    // ─────────────────────────────────────────────────────────────────────────
    return {
        // State
        user,
        projects,
        activeProject,
        milestones,
        loading,
        error,

        // Actions
        loadProjects,
        loadProject,
        createFullProject,
        recordFunding,
        castVoteDB,
        checkHasVoted,

        // Clear error manually
        clearError: () => setError(null),
    }
}
