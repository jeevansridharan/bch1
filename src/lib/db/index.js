/**
 * src/lib/db/index.js
 *
 * Barrel export — import everything from one place.
 *
 * Usage in components:
 *   import { createProject, voteOnMilestone, insertTransaction } from '../lib/db'
 *
 * Never import directly from individual db files in components.
 * Always go through this index for clean dependency tracking.
 */

export { upsertUser, getUserByWallet } from './users'
export {
    createProject, fetchProjects, fetchProjectById,
    updateFundedAmount, updateProjectStatus
} from './projects'
export {
    createMilestone, createMilestoneBatch,
    fetchMilestonesByProject, updateMilestoneStatus
} from './milestones'
export { voteOnMilestone, getVotesByMilestone, hasUserVoted } from './votes'
export {
    insertTransaction, fetchTransactionsByProject,
    getProjectFundingTotal
} from './transactions'
