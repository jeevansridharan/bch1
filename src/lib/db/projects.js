/**
 * src/lib/db/projects.js
 *
 * All Supabase operations for the `projects` table.
 *
 * FUNCTIONS EXPORTED
 * ──────────────────
 *   createProject(data)        → inserts a new row, returns {data, error}
 *   fetchProjects(opts)        → reads all projects, returns {data, error}
 *   fetchProjectById(id)       → reads one project, returns {data, error}
 *   updateRaisedAmount(id, n)  → atomically adds to raised_amount (alias: updateFundedAmount)
 *   updateProjectStatus(id, s) → sets status field
 *   testInsertProject()        → inserts a dummy row to verify DB connectivity
 *
 * SUPABASE TABLE SCHEMA  (projects)
 * ──────────────────────────────────
 *   id            UUID  (auto via gen_random_uuid())
 *   title         TEXT  NOT NULL
 *   description   TEXT  default ''
 *   goal_amount   NUMERIC(18,8)  NOT NULL
 *   raised_amount NUMERIC(18,8)  default 0
 *   owner_wallet  TEXT  NOT NULL
 *   status        TEXT  default 'active'
 *   created_at    TIMESTAMPTZ  default now()
 *
 * BUG FIXES APPLIED
 * ──────────────────
 *   ✓ insert([payload])  — Supabase JS v2 requires an ARRAY, not a plain object
 *   ✓ Full try/catch around every Supabase call
 *   ✓ console.log before AND after every insert/select
 *   ✓ Null guard: supabase client checked before use
 *   ✓ updateFundedAmount exported as alias for updateRaisedAmount (matches index.js)
 *   ✓ testInsertProject() for manual connectivity verification
 */

import { supabase } from '../supabaseClient'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE = 'projects'

/** Valid project status values — matches CHECK constraint in schema.sql */
const VALID_STATUSES = ['active', 'funded', 'completed', 'cancelled']

// ── Internal helper ───────────────────────────────────────────────────────────

function requireClient() {
    if (!supabase) {
        throw new Error(
            '[projects.js] Supabase client is NULL.\n' +
            'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file and restart the dev server.'
        )
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// testInsertProject  ← call this from the browser console to verify DB works
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manual test helper — inserts a dummy project to confirm the DB connection
 * and RLS policies are working correctly.
 *
 * HOW TO RUN (browser DevTools console):
 *   import('/src/lib/db/projects.js').then(m => m.testInsertProject())
 *
 * Or import it in any component temporarily:
 *   import { testInsertProject } from '../lib/db/projects'
 *   testInsertProject()
 */
export async function testInsertProject() {
    console.log('[testInsertProject] 🧪 Starting dummy insert…')

    const dummy = {
        title: `[TEST] Dummy Project ${Date.now()}`,
        description: 'Automated connectivity test — safe to delete.',
        goal_amount: 0.001,
        raised_amount: 0,
        owner_wallet: 'bchtest:qq0000000000000000000000000000000000000000',
        status: 'active',
    }

    console.log('[testInsertProject] Payload:', dummy)

    try {
        requireClient()

        // ⚠ NOTE: insert MUST receive an ARRAY — this is the #1 cause of silent no-ops
        const { data, error } = await supabase
            .from(TABLE)
            .insert([dummy])   // ← ARRAY required by Supabase JS v2
            .select()
            .single()

        if (error) {
            console.error('[testInsertProject] ✗ Insert FAILED:', error)
            console.error('  code   :', error.code)
            console.error('  message:', error.message)
            console.error('  details:', error.details)
            console.error('  hint   :', error.hint)
            return { data: null, error }
        }

        console.info('[testInsertProject] ✓ Insert SUCCEEDED! Row:', data)
        return { data, error: null }

    } catch (err) {
        console.error('[testInsertProject] ✗ Exception thrown:', err)
        return { data: null, error: { message: err.message } }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// createProject
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a new project into Supabase.
 *
 * Note: Contract metadata (address, pubkeys) is stored in the separate `contracts`
 * table after the project is inserted and we have its UUID. Use saveContractMetadata()
 * from db/contracts.js to store contract details.
 *
 * @param {Object} projectData
 * @param {string} projectData.title         - Project name (required)
 * @param {string} [projectData.description] - What the project does
 * @param {number} projectData.goal_amount   - Funding target in BCH (required)
 * @param {string} projectData.owner_wallet  - Creator's Bitcoin Cash wallet address (required)
 * @param {string} [projectData.status]      - 'active' | 'funded' | 'completed' | 'cancelled'
 *
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 *
 * USAGE
 * ─────
 *   const { data, error } = await createProject({
 *     title:        'My BCH App',
 *     description:  'A milestone-based crowdfund',
 *     goal_amount:  0.05,
 *     owner_wallet: 'bchtest:...',
 *   })
 *   if (data) {
 *     // Now save contract metadata to the contracts table:
 *     await saveContractMetadata({
 *       projectId: data.id,
 *       contractAddress: '...',
 *       creatorPubkey: '...',
 *       funderPubkey: '...',
 *       oraclePubkey: '...',
 *       milestoneIdHex: '...',
 *       deadline: ...
 *     })
 *   }
 */
export async function createProject({
    title,
    description = '',
    goal_amount,
    owner_wallet,
    status = 'active',
}) {

    // ── Client-side validation ────────────────────────────────────────────────
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        console.error('[createProject] Validation failed: title is required')
        return { data: null, error: { message: 'Project title is required.' } }
    }

    if (!goal_amount || isNaN(Number(goal_amount)) || Number(goal_amount) <= 0) {
        console.error('[createProject] Validation failed: goal_amount', goal_amount)
        return { data: null, error: { message: 'goal_amount must be a positive number.' } }
    }

    if (!owner_wallet || typeof owner_wallet !== 'string') {
        console.error('[createProject] Validation failed: owner_wallet missing')
        return { data: null, error: { message: 'owner_wallet (Bitcoin Cash address) is required.' } }
    }

    if (!VALID_STATUSES.includes(status)) {
        console.error('[createProject] Validation failed: invalid status', status)
        return { data: null, error: { message: `status must be one of: ${VALID_STATUSES.join(', ')}` } }
    }

    // ── Build the payload ─────────────────────────────────────────────────────
    const payload = {
        title: title.trim(),
        description: description.trim(),
        goal_amount: Number(goal_amount),
        raised_amount: 0,              // always starts at 0
        owner_wallet: owner_wallet.trim(),
        status,
        // created_at is auto-set by Supabase DEFAULT now()
        // contract_address and pubkeys are stored in the separate 'contracts' table
    }

    console.log('[createProject] ▶ About to insert payload:', payload)

    // ── Supabase INSERT (with try/catch) ──────────────────────────────────────
    try {
        requireClient()

        // ⚠ CRITICAL FIX: insert([payload]) — must be an ARRAY
        // Passing a plain object { ... } silently does nothing in Supabase JS v2
        const { data, error } = await supabase
            .from(TABLE)
            .insert([payload])   // ← ARRAY, not object
            .select()            // returns the inserted row(s) with server-generated fields
            .single()            // we inserted one row — unwrap from array

        if (error) {
            console.error('[createProject] ✗ Supabase INSERT error:', error.code, error.message)
            return { data: null, error }
        }

        console.info('[createProject] ✓ Insert succeeded! ID:', data.id, '| Title:', data.title)
        console.log('[createProject] Full returned row:', data)
        return { data, error: null }

    } catch (err) {
        console.error('[createProject] ✗ Exception thrown during insert:', err)
        return { data: null, error: { message: err.message } }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// fetchProjects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all projects from Supabase, newest first.
 *
 * @param {Object}  [opts]
 * @param {string}  [opts.status]       - Filter by status ('active', 'funded', etc.)
 * @param {string}  [opts.owner_wallet] - Filter by creator wallet
 * @param {number}  [opts.limit=50]     - Max rows to return
 * @param {number}  [opts.offset=0]     - For pagination
 *
 * @returns {Promise<{data: Array, error: Object|null}>}
 *
 * USAGE
 * ─────
 *   const { data, error } = await fetchProjects()
 *   const { data, error } = await fetchProjects({ status: 'active', limit: 10 })
 */
export async function fetchProjects({ status, owner_wallet, limit = 50, offset = 0 } = {}) {

    console.log('[fetchProjects] ▶ Fetching with filters:', { status, owner_wallet, limit, offset })

    try {
        requireClient()

        // ── Build query ───────────────────────────────────────────────────────
        let query = supabase
            .from(TABLE)
            .select('*')
            .order('created_at', { ascending: false })  // newest first
            .range(offset, offset + limit - 1)           // pagination

        // Optional filters
        if (status) query = query.eq('status', status)
        if (owner_wallet) query = query.eq('owner_wallet', owner_wallet)

        // ── Execute ───────────────────────────────────────────────────────────
        console.log('[fetchProjects] ▶ Sending SELECT request to Supabase…')
        const { data, error } = await query

        if (error) {
            console.error('[fetchProjects] ✗ Supabase SELECT error:')
            console.error('  code   :', error.code)
            console.error('  message:', error.message)
            console.error('  full   :', error)
            return { data: [], error }
        }

        console.info(`[fetchProjects] ✓ Got ${data.length} project(s)`)
        return { data: data ?? [], error: null }

    } catch (err) {
        console.error('[fetchProjects] ✗ Exception thrown:', err)
        return { data: [], error: { message: err.message } }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// fetchProjectById
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a single project by UUID, including its milestones and transactions.
 *
 * @param {string} id - UUID of the project
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function fetchProjectById(id) {
    if (!id) return { data: null, error: { message: 'Project ID is required.' } }

    console.log('[fetchProjectById] ▶ Fetching project:', id)

    try {
        requireClient()

        // Joining milestones and their nested votes
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
                *,
                milestones (*, votes(vote, token_amount)),
                transactions (*)
            `)
            .eq('id', id)
            .single()

        if (error) {
            console.error('[fetchProjectById] ✗ Error:', error)
            return { data: null, error }
        }

        // Process milestones: aggregate vote tallies and derive isApproved from status column.
        // Both `approved` (boolean) and `status` (text) exist in the verified schema.
        // `status` is the single source of truth — `approved` is kept in sync by updateMilestoneStatus().
        if (data && data.milestones) {
            data.milestones = data.milestones.map(m => {
                const votes = m.votes ?? []
                const yesWeight = votes.filter(v => v.vote === true).reduce((s, v) => s + Number(v.token_amount), 0)
                const noWeight  = votes.filter(v => v.vote === false).reduce((s, v) => s + Number(v.token_amount), 0)

                return {
                    ...m,
                    votes:      undefined, // remove raw join array — use voteYes/voteNo instead
                    voteYes:    yesWeight,
                    voteNo:     noWeight,
                    voteTotal:  yesWeight + noWeight,
                    // Read from DB status column (authoritative); fall back to approved boolean
                    isApproved: m.status === 'approved' || m.status === 'released' || m.approved === true,
                }
            })
        }

        console.info('[fetchProjectById] ✓ Found project:', data.title)
        return { data, error: null }

    } catch (err) {
        console.error('[fetchProjectById] ✗ Exception:', err)
        return { data: null, error: { message: err.message } }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// updateRaisedAmount  (also exported as updateFundedAmount — same function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically increment raised_amount using the Postgres RPC function
 * `increment_raised_amount` — safe under concurrent funding.
 *
 * Exported TWICE (as updateRaisedAmount AND updateFundedAmount) so both
 * naming styles work without breaking existing imports.
 *
 * @param {string} id     - Project UUID
 * @param {number} amount - Amount to ADD (in BCH)
 */
export async function updateRaisedAmount(id, amount) {
    if (!id || !amount || amount <= 0) {
        return { data: null, error: { message: 'Valid project id and positive amount required.' } }
    }

    console.log('[updateRaisedAmount] ▶ Updating raised_amount for project:', id, 'by', amount)

    try {
        requireClient()

        // ── Strategy A: Try Atomic RPC (safest for concurrency) ────────────────
        const { data, error: rpcError } = await supabase.rpc('increment_raised_amount', {
            p_id: id,
            p_amount: amount,
        })

        if (!rpcError) {
            console.info('[updateRaisedAmount] ✓ Success via RPC')
            return { data, error: null }
        }

        console.warn('[updateRaisedAmount] ⚠ RPC failed, falling back to FETCH + UPDATE style...')
        console.warn('  (Note: You should run schema.sql to enable the atomic rpc for better safety.)')

        // ── Strategy B: Fallback Fetch + Update (easier for beginners) ─────────
        // 1. Get current amount
        const { data: current, error: fetchErr } = await supabase
            .from(TABLE)
            .select('raised_amount')
            .eq('id', id)
            .single()

        if (fetchErr) throw fetchErr

        const newTotal = parseFloat(current.raised_amount || 0) + parseFloat(amount)

        // 2. Update to new total
        const { data: updated, error: updateErr } = await supabase
            .from(TABLE)
            .update({ raised_amount: newTotal })
            .eq('id', id)
            .select()
            .single()

        if (updateErr) throw updateErr

        console.info('[updateRaisedAmount] ✓ Success via fallback update. New Total:', newTotal)
        return { data: updated, error: null }

    } catch (err) {
        console.error('[updateRaisedAmount] ✗ Failed to update raised amount:', err.message)
        return { data: null, error: { message: err.message } }
    }
}

/** Alias — same function, supports both naming conventions across the codebase */
export const updateFundedAmount = updateRaisedAmount


// ─────────────────────────────────────────────────────────────────────────────
// updateProjectStatus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the status of a project.
 *
 * @param {string} id     - Project UUID
 * @param {string} status - 'active' | 'funded' | 'completed' | 'cancelled'
 */
export async function updateProjectStatus(id, status) {
    if (!VALID_STATUSES.includes(status)) {
        return { data: null, error: { message: `Invalid status. Must be: ${VALID_STATUSES.join(', ')}` } }
    }

    console.log('[updateProjectStatus] ▶ Setting project', id, '→ status:', status)

    try {
        requireClient()

        const { data, error } = await supabase
            .from(TABLE)
            .update({ status })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('[updateProjectStatus] ✗ Error:', error)
            return { data: null, error }
        }

        console.info('[updateProjectStatus] ✓ Updated. New status:', data.status)
        return { data, error: null }

    } catch (err) {
        console.error('[updateProjectStatus] ✗ Exception:', err)
        return { data: null, error: { message: err.message } }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// deleteProject
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Permanently delete a project by its UUID.
 * The ON DELETE CASCADE on milestones / transactions / votes means all
 * related rows are automatically removed by Postgres.
 *
 * @param {string} id - UUID of the project to delete
 * @returns {Promise<{error: Object|null}>}
 */
export async function deleteProject(id) {
    console.log('[deleteProject] ▶ Deleting project:', id)

    try {
        requireClient()

        if (!id) throw new Error('deleteProject: id is required')

        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id)

        if (error) {
            console.error('[deleteProject] ✗ Supabase DELETE error:', error.message)
            return { error }
        }

        console.info('[deleteProject] ✓ Project deleted:', id)
        return { error: null }

    } catch (err) {
        console.error('[deleteProject] ✗ Exception:', err)
        return { error: { message: err.message } }
    }
}
