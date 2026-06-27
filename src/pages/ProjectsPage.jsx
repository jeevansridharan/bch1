/**
 * src/pages/ProjectsPage.jsx
 *
 * ── WHAT THIS FILE DOES ──────────────────────────────────────────────────────
 * 1. On page load (useEffect), fetches all rows from the Supabase `projects`
 *    table, ordered by newest first.
 * 2. Stores fetched data in React state (useState).
 * 3. Handles three UI states: loading → error → data (or empty).
 * 4. Renders a responsive grid of ProjectCard components.
 * 5. Provides a "Create Project" panel that switches to the form.
 *
 * ── FILE LOCATION ────────────────────────────────────────────────────────────
 * src/pages/ProjectsPage.jsx
 * Rendered by App.jsx at the /projects route.
 *
 * ── REQUIRED IMPORTS ─────────────────────────────────────────────────────────
 * supabase        → from '../lib/supabase'    (Supabase client singleton)
 * ProjectCard     → from '../components/ProjectCard'
 * ProjectForm     → from '../components/ProjectForm'
 * Dashboard       → from '../components/Dashboard'
 * React hooks     → useState, useEffect, useCallback from 'react'
 *
 * ── RLS NOTE ─────────────────────────────────────────────────────────────────
 * The `projects` table has a PUBLIC READ policy:
 *   CREATE POLICY "projects: public read" ON projects FOR SELECT USING (true);
 * This means anyone — even without a wallet — can read project data.
 * If you see an empty list when data exists, check:
 *   1. Supabase dashboard → Table Editor → projects → is data there?
 *   2. Supabase dashboard → Auth → Policies → "projects" → is public read on?
 *   3. Your .env VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are correct.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
    FolderKanban, Plus, RefreshCw,
    AlertCircle, Inbox,
} from 'lucide-react'

import { supabase, supabaseConfigured } from '../lib/supabase'
import { createProject, deleteProject, updateRaisedAmount } from '../lib/db/projects'
import { insertTransaction } from '../lib/db/transactions'
import { createMilestoneBatch } from '../lib/db/milestones'
import { saveContractMetadata } from '../lib/db/contracts'
import { voteOnMilestone, hasUserVoted } from '../lib/db/votes'
import ProjectCard from '../components/ProjectCard'
import ProjectForm from '../components/ProjectForm'
import Dashboard from '../components/Dashboard'
import { deployMilestoneEscrow } from '../../production/scripts/deployContract'
import { generateVotingAddresses } from '../../production/scripts/generateVotingAddresses'
import { initializeWallet } from '../services/bchWallet'
import * as libauth from '@bitauth/libauth'

// ── TODO: Replace with the currently connected wallet address ─────────────────
// If you have a wallet context/hook, import it here and pass the address down.
// For now we use a placeholder so the owner_wallet field is never empty.
const PLACEHOLDER_WALLET = 'bchtest:qp0000000000000000000000000000000000000000'

<<<<<<< HEAD
/** 
 * Platform Oracle Public Key (Tally Engine) 
 * NOTE: This constant is now a FALLBACK only.
 * The real oracle pubkey is fetched live from the backend at deploy time
 * via deployMilestoneEscrow() → GET /api/oracle/pubkey.
 * Keeping this here only so legacy code that references it doesn't break.
 */
const PLATFORM_ORACLE_PK_HEX = '0297901125f188dd92c9c041d2da8b5972523a7d666434a0975c6241c96057d82e'; // updated to match current backend
=======
// ── Oracle Backend URL ────────────────────────────────────────────────────────
// Must match the URL used by milestoneContract.js so both sides talk to the
// same oracle instance.
const ORACLE_URL = import.meta.env.VITE_ORACLE_URL || 'http://localhost:3001'

/**
 * fetchOraclePubkey
 *
 * Fetches the REAL oracle public key from the running oracle backend.
 * The backend derives it from ORACLE_WIF at startup, so this is always
 * the key that will be used for signing — unlike a hardcoded constant
 * which drifts out of sync whenever the WIF is rotated.
 *
 * @returns {Promise<string>} compressed 33-byte pubkey hex
 * @throws  if the oracle backend is unreachable or returns an error
 */
async function fetchOraclePubkey() {
    const url = `${ORACLE_URL}/health`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Oracle /health returned HTTP ${res.status}`)
    const { oracle } = await res.json()
    if (!oracle || !/^[0-9a-fA-F]{66}$/.test(oracle)) {
        throw new Error(`Oracle /health returned invalid pubkey: ${oracle}`)
    }
    console.log('[ProjectsPage] ✓ Oracle pubkey fetched from backend:', oracle)
    return oracle
}
>>>>>>> 4c1abc2ea7250f3283d4c32d1aaf4ba3d6b4cd3c

// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {

    // ── State ─────────────────────────────────────────────────────────────────

    /** All projects fetched from Supabase */
    const [projects, setProjects] = useState([])

    /** true while the Supabase request is in-flight */
    const [loading, setLoading] = useState(true)

    /** Non-null string if the fetch failed */
    const [error, setError] = useState(null)

    /** Controls "Create new project" form vs list view */
    const [showForm, setShowForm] = useState(false)

    /** Active project (once created/selected by user) */
    const [activeProject, setActiveProject] = useState(null)

    // ── Fetch projects from Supabase ──────────────────────────────────────────

    /**
     * fetchProjects()
     *
     * Sends a SELECT query to Supabase:
     *   SELECT * FROM projects ORDER BY created_at DESC
     *
     * Uses useCallback so it can be passed to the refresh button
     * without causing re-render loops.
     */
    const fetchProjects = useCallback(async () => {
        setLoading(true)   // show spinner
        setError(null)     // clear any previous error

        if (!supabaseConfigured || !supabase) {
            setError('Supabase not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
            setLoading(false)
            return
        }

        const { data, error: sbError } = await supabase
            .from('projects')          // target table
            .select('*')               // all columns
            .order('created_at', { ascending: false })  // newest first
            .limit(50)                 // safety limit

        if (sbError) {
            // Supabase returned an error (RLS block, network issue, etc.)
            console.error('[ProjectsPage] Supabase error:', sbError)
            setError(sbError.message)
            setProjects([])
        } else {
            setProjects(data ?? [])    // `data` is null if table is empty
        }

        setLoading(false)  // hide spinner
    }, [])

    /**
     * useEffect — runs once when the component mounts (page loads).
     * Equivalent to componentDidMount in class components.
     * The empty dependency array [] means "run only on first render".
     */
    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    // ── Handlers ──────────────────────────────────────────────────────────────

    /**
     * handleProjectCreate
     *
     * Called by ProjectForm when the user submits the form.
     *
     * BUG FIX: was NOT async, never actually called Supabase.
     * Now: awaits createProject(), throws on error (form shows it),
     * sets local state only AFTER a confirmed DB insert.
     *
     * @param {object} projectData — from ProjectForm (goal_amount, owner_wallet, etc.)
     */
    const handleProjectCreate = async (projectData) => {
        console.log('[ProjectsPage] handleProjectCreate: received formData =', projectData)
        console.log('[ProjectsPage] handleProjectCreate: calling Supabase insert…')

        // ── 1. Initialize Wallet for Keys ────────────────────────────────────
        let wallet = null;
        try {
            wallet = await initializeWallet();
        } catch (e) {
            console.warn('[ProjectsPage] Wallet init failed, using placeholders for keys');
        }

        // ── 2. Prepare Public Keys for Contract ──────────────────────────────
        // CashScript requires 33-byte COMPRESSED pubkeys (0x02 or 0x03 prefix).
        // mainnet-js / bchWallet may return:
        //   • 33-byte hex (already compressed)  → use directly
        //   • 65-byte hex (uncompressed, 0x04…) → compress: keep X, derive prefix from Y parity
        const dummyPkHex = '02' + '0'.repeat(64)  // valid 33-byte placeholder

        function compressPubkeyHex(hex) {
            if (!hex) return dummyPkHex
            // mainnet-js wallet.publicKey returns a Uint8Array, not a string.
            // Convert binary to hex string first if needed.
            let hexStr = hex
            if (hex instanceof Uint8Array || (typeof hex === 'object' && hex !== null && hex.constructor?.name === 'Buffer')) {
                hexStr = Array.from(hex).map(b => b.toString(16).padStart(2, '0')).join('')
            }
            if (typeof hexStr !== 'string') return dummyPkHex
            const clean = hexStr.replace(/^0x/, '')
            if (clean.length === 66) return clean          // already 33 bytes
            if (clean.length !== 130 || clean.slice(0, 2) !== '04') return dummyPkHex
            const xHex = clean.slice(2, 66)
            const yLastByte = parseInt(clean.slice(-2), 16)
            const prefix = yLastByte % 2 === 0 ? '02' : '03'
            return prefix + xHex
        }

        const walletPkHex = compressPubkeyHex(wallet?.publicKey)
        const creatorPk   = libauth.hexToBin(walletPkHex)
        const funderPk    = creatorPk  // Creator is default funder

        // ── Fetch the LIVE oracle pubkey from the running backend ─────────────
        // CRITICAL: the contract bakes tallyOraclePk into its bytecode. The
        // oracle backend signs proofs with the key from ORACLE_WIF. If these
        // two keys differ, checkDataSig() will ALWAYS fail — even if everything
        // else is correct. We fetch from /health so they are ALWAYS in sync.
        let oraclePubkeyHex
        try {
            oraclePubkeyHex = await fetchOraclePubkey()
        } catch (oracleErr) {
            console.error('[ProjectsPage] ✗ Cannot reach oracle backend:', oracleErr.message)
            throw new Error(
                `Cannot deploy contract: Oracle backend unreachable at ${ORACLE_URL}. ` +
                'Start it with: cd backend && npm start'
            )
        }
        const oraclePk = libauth.hexToBin(oraclePubkeyHex)


        // ── 3. Generate Uniq Milestone ID ─────────────────────────────────────
        const sha256 = await libauth.instantiateSha256();
        const milestoneId = sha256.hash(libauth.utf8ToBin(projectData.title + Date.now()));
        const deadline = 2000000; // Far in the future block height

        console.log('[ProjectsPage] Deploying MilestoneEscrow on-chain...');

        // ── 4. Deploy Contract ────────────────────────────────────────────────
        let contractAddress = '';
        let milestoneIdHexFinal = '';
        let deploymentParams = null;  // saved after we have the project UUID
        try {
            const deployment = await deployMilestoneEscrow({
                creatorPk,
                funderPk,
                oraclePk,           // fallback if backend unreachable
                milestoneId,
                deadlineHeight: deadline
            });
            contractAddress = deployment.address;
            milestoneIdHexFinal = deployment.milestoneIdHex;

            // STEP 4: Verify the oracle pubkey that was baked in matches the live backend.
            // deployMilestoneEscrow fetches it from /api/oracle/pubkey, but we double-check here.
            const deployedOraclePk = deployment.oraclePubkeyHex
            if (deployedOraclePk) {
                try {
                    const pkResp = await fetch(
                        (import.meta.env.VITE_ORACLE_URL || 'http://localhost:3001') + '/api/oracle/pubkey'
                    )
                    if (pkResp.ok) {
                        const { oraclePubkey: livePk } = await pkResp.json()
                        if (livePk && livePk.toLowerCase() !== deployedOraclePk.toLowerCase()) {
                            console.warn(
                                '[ProjectsPage] ⚠ ORACLE PUBKEY MISMATCH after deploy!\n' +
                                `  Baked into contract : ${deployedOraclePk}\n` +
                                `  Backend reports now : ${livePk}\n` +
                                '  Release will fail. Run scripts/fix-oracle-pubkey.mjs or recreate project.'
                            )
                        } else {
                            console.log('[ProjectsPage] ✓ Oracle pubkey verified — contract matches live backend.')
                        }
                    }
                } catch (verifyErr) {
                    console.warn('[ProjectsPage] Could not verify oracle pubkey post-deploy:', verifyErr.message)
                }
            }

            // Stash params so we can persist them to the contracts table once
            // Supabase gives us the project UUID.
            deploymentParams = {
                contractAddress: deployment.address,
                milestoneIdHex:  deployment.milestoneIdHex,
                creatorPubkey:   walletPkHex,      // compressed 33-byte hex
                funderPubkey:    walletPkHex,      // compressed 33-byte hex
                oraclePubkey:    oraclePubkeyHex,  // live pubkey from oracle /health — MUST match ORACLE_WIF
                deadline,
            };
            console.log('[ProjectsPage] ✓ Contract Deployed:', contractAddress);
        } catch (deployErr) {
            console.error('[ProjectsPage] ✗ Deployment failed:', deployErr);
        }

        // ── 5. Pre-generate Voting Addresses ──────────────────────────────────
        // We don't have the projectId yet (it's assigned by Supabase), so we
        // embed voting addresses in the description. After insert, we can use
        // the real UUID returned from Supabase for future-address derivation.
        // NOTE: The canonical per-project addresses are always derivable from
        // the project UUID via generateVotingAddresses(projectId), so storing
        // them here is just a convenience cache for the initial render.
        console.log('[ProjectsPage] Voting addresses will be derived from project UUID after insert.');

        // ── 6. Build description with on-chain metadata (fallback storage) ────
        // This safely embeds the contract address and params even if the DB column is missing.
        const milestoneIdHex = milestoneIdHexFinal || libauth.binToHex(milestoneId);
        const metaTags = contractAddress
            ? `\n\n[On-Chain Address: ${contractAddress}]\n[Milestone ID: ${milestoneIdHex}]\n[Deadline: ${deadline}]`
            : '';
        const fullDescription = (projectData.description ?? '') + metaTags;

        // ── 7. Real Supabase INSERT ───────────────────────────────────────────
        const { data: newProject, error: insertError } = await createProject({
            title: projectData.title,
            description: fullDescription,
            goal_amount: projectData.goal_amount,
            owner_wallet: wallet?.cashaddr ?? projectData.owner_wallet ?? PLACEHOLDER_WALLET,
            status: 'active',
        })

        if (insertError) {
            console.error('[ProjectsPage] handleProjectCreate: INSERT FAILED:', insertError)
            throw new Error(insertError.message ?? 'Supabase insert failed')
        }

        console.log('[ProjectsPage] handleProjectCreate: ✓ project inserted:', newProject)

        // ── 8. Save contract metadata to Supabase contracts table ─────────────
        // Now that we have the real project UUID from Supabase, persist all the
        // CashScript constructor params so releaseMilestoneFunds() can load and
        // reconstruct the Contract instance without relying on prop-drilling.
        if (deploymentParams && newProject?.id) {
            try {
                await saveContractMetadata({
                    projectId:       newProject.id,
                    contractAddress: deploymentParams.contractAddress,
                    creatorPubkey:   deploymentParams.creatorPubkey,
                    funderPubkey:    deploymentParams.funderPubkey,
                    oraclePubkey:    deploymentParams.oraclePubkey,
                    milestoneIdHex:  deploymentParams.milestoneIdHex,
                    deadline:        deploymentParams.deadline,
                })
                console.log('[ProjectsPage] ✓ Contract metadata saved to Supabase contracts table')
            } catch (contractSaveErr) {
                // Non-fatal — contract is deployed on-chain; metadata can be re-saved manually
                console.error('[ProjectsPage] ⚠ Failed to save contract metadata:', contractSaveErr.message)
            }
        }

        // ── BUG FIX: Save milestones to Supabase ──────────────────────────────
        // Previously milestones were only kept in local state with fake IDs,
        // causing "No milestones defined" on the dashboard.
        let savedMilestones = []
        const rawMilestones = projectData.milestones ?? []
        if (rawMilestones.length > 0) {
            try {
                const milestoneBatch = rawMilestones.map(m => ({
                    title: m.title,
                    description: m.description ?? '',
                    amountAllocated: parseFloat(projectData.goal_amount) / rawMilestones.length,
                }))
                savedMilestones = await createMilestoneBatch(newProject.id, milestoneBatch)
                console.log('[ProjectsPage] ✓ milestones inserted:', savedMilestones)
            } catch (milestoneErr) {
                console.error('[ProjectsPage] milestone insert failed:', milestoneErr.message)
                // Don't block — project was created, milestones can be added later
            }
        }

        // ── Normalise milestones shape for UI ─────────────────────────────────
        const normalisedMilestones = savedMilestones.map(m => ({
            ...m,
            status: m.status ?? 'pending',
            votes: { yes: 0, no: 0 },
        }))

        const fullProject = {
            ...newProject,
            milestones: normalisedMilestones,
            raised_amount: 0,
        }

        setProjects(prev => [fullProject, ...prev])
        setActiveProject(fullProject)
        setShowForm(false)
    }

    const handleTransaction = async (amount, txHash, type = 'funding', walletAddress) => {
        if (!activeProject) return
        const finalWallet = walletAddress || PLACEHOLDER_WALLET
        console.log(`[ProjectsPage] handleTransaction: ${type} of ${amount} BCH (${txHash}) by ${finalWallet}`)

        // 1. Record in transactions table
        if (txHash) {
            try {
                await insertTransaction({
                    projectId: activeProject.id,
                    txHash,
                    amount,
                    type,
                    walletAddress: finalWallet,
                })
                console.log(`[ProjectsPage] ✓ ${type} recorded in database`)
            } catch (err) {
                console.error(`[ProjectsPage] Database error for ${type}:`, err.message)
            }
        }

        // 2. If it's a funding transaction, increment the project's raised_amount
        if (type === 'funding') {
            try {
                await updateRaisedAmount(activeProject.id, amount)
                console.log('[ProjectsPage] ✓ raised_amount incremented in projects table')
            } catch (err) {
                console.error('[ProjectsPage] Failed to update project total:', err.message)
            }

            // Update local state for immediate UI feedback
            setActiveProject(prev => ({
                ...prev,
                raised_amount: (parseFloat(prev.raised_amount) + amount).toFixed(8)
            }))
        }
    }

    const handleFund = (amount, txHash, walletAddress) => handleTransaction(amount, txHash, 'funding', walletAddress)

    const handleVote = async (milestoneId, voteType) => {
        // Resolve stable anonymous voter ID from localStorage
        const key = 'milestara_anon_voter_id'
        let voterId = localStorage.getItem(key)
        if (!voterId) {
            voterId = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
            localStorage.setItem(key, voterId)
        }

        // ── Pre-check: has this wallet already voted on this milestone? ──────
        const alreadyVoted = await hasUserVoted(milestoneId, voterId)
        if (alreadyVoted) {
            console.info('[ProjectsPage] User has already voted on milestone:', milestoneId)
            alert('You have already voted on this milestone.')
            return  // ← exit early, no 409 request, no double-count
        }

        // ── Insert vote into Supabase ────────────────────────────────────────
        try {
            await voteOnMilestone({
                milestoneId,
                voterId,
                vote: voteType === 'yes',
                votingPower: 1,
            })
            console.log(`[ProjectsPage] ✓ Vote '${voteType}' recorded in DB for milestone:`, milestoneId)
        } catch (voteErr) {
            console.warn('[ProjectsPage] DB vote failed:', voteErr.message)
            alert(voteErr.message || 'Vote failed. Please try again.')
            return  // ← don't update local state if the vote wasn't saved
        }

        // ── Update local state only after a successful DB write ──────────────
        setActiveProject(prev => ({
            ...prev,
            milestones: prev.milestones?.map(m => {
                if (m.id !== milestoneId) return m
                const newVotes = { ...m.votes, [voteType]: (m.votes?.[voteType] ?? 0) + 1 }
                const total = newVotes.yes + newVotes.no
                return {
                    ...m,
                    votes: newVotes,
                    status: total > 0 && newVotes.yes / total > 0.5 ? 'Approved' : 'Pending',
                }
            }),
        }))
    }

    const handleProjectDelete = async (projectId) => {
        const { error } = await deleteProject(projectId)
        if (error) {
            alert(`Failed to delete project: ${error.message}`)
            return
        }
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectId))
    }

    const handleReset = () => {
        setActiveProject(null)
        setShowForm(false)
        fetchProjects() // Refresh the list so totals are accurate when returning
    }

    // ── Route: show Dashboard if a project is active ──────────────────────────
    if (activeProject) {
        return (
            <Dashboard
                project={activeProject}
                onFund={handleFund}
                onVote={handleVote}
                onTransaction={handleTransaction}
                onReset={handleReset}
            />
        )
    }

    // ── Route: show create form ───────────────────────────────────────────────
    if (showForm) {
        return (
            <div>
                <button
                    onClick={() => setShowForm(false)}
                    style={{
                        marginBottom: '20px', padding: '8px 16px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#64748b', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    ← Back to Projects
                </button>
                <ProjectForm
                    onProjectCreate={handleProjectCreate}
                    walletAddress={PLACEHOLDER_WALLET}
                />
            </div>
        )
    }

    // ── Main view: project list ───────────────────────────────────────────────
    return (
        <div>

            {/* ── Page header ────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
            }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                        Projects
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} on Chipnet`}
                    </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {/* Refresh */}
                    <button
                        onClick={fetchProjects}
                        disabled={loading}
                        title="Refresh list"
                        style={{
                            padding: '9px 14px', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s', opacity: loading ? 0.5 : 1,
                        }}
                    >
                        <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>

                    {/* Create */}
                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            padding: '9px 18px', borderRadius: '10px', cursor: 'pointer',
                            background: 'linear-gradient(135deg,#10b981,#059669)',
                            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '7px',
                            boxShadow: '0 0 20px rgba(16,185,129,0.3)', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 28px rgba(16,185,129,0.5)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)'}
                    >
                        <Plus size={16} /> New Project
                    </button>
                </div>
            </div>

            {/* ── Loading state ───────────────────────────────────────────────── */}
            {loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            background: 'rgba(15,17,35,0.9)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '16px', padding: '24px', height: '260px',
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }}>
                            {/* Skeleton lines */}
                            {[100, 60, 80, 40].map((w, j) => (
                                <div key={j} style={{
                                    height: '12px', width: `${w}%`, borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.04)', marginBottom: '14px',
                                }} />
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Error state ─────────────────────────────────────────────────── */}
            {!loading && error && (
                <div style={{
                    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '14px', padding: '28px', display: 'flex', alignItems: 'flex-start', gap: '14px',
                }}>
                    <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <p style={{ color: '#f87171', fontWeight: 700, marginBottom: '6px' }}>Failed to load projects</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.83rem', marginBottom: '14px' }}>{error}</p>
                        <p style={{ color: '#64748b', fontSize: '0.78rem' }}>
                            ⚠ Common causes: schema.sql not run yet · RLS policy missing · wrong .env keys
                        </p>
                        <button
                            onClick={fetchProjects}
                            style={{
                                marginTop: '14px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                color: '#f87171', fontWeight: 700, fontSize: '0.8rem',
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* ── Empty state ─────────────────────────────────────────────────── */}
            {!loading && !error && projects.length === 0 && (
                <div style={{
                    background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px', padding: '60px 40px', textAlign: 'center',
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
                        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Inbox size={28} color="#10b981" />
                    </div>
                    <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>
                        No projects yet
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '24px' }}>
                        Be the first to create a milestone-based funding project on Chipnet.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            padding: '10px 24px', borderRadius: '10px', cursor: 'pointer',
                            background: 'linear-gradient(135deg,#10b981,#059669)',
                            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                        }}
                    >
                        <Plus size={16} /> Create First Project
                    </button>
                </div>
            )}

            {/* ── Projects grid ───────────────────────────────────────────────── */}
            {!loading && !error && projects.length > 0 && (
                <>
                    {/* Count + filter bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <div style={{
                            padding: '4px 12px', borderRadius: '999px',
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>
                                {projects.length} PROJECT{projects.length !== 1 ? 'S' : ''}
                            </span>
                        </div>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                        <span style={{ fontSize: '0.72rem', color: '#334155' }}>Sorted: Newest first</span>
                    </div>

                    {/* Responsive card grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '20px',
                    }}>
                        {projects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onView={(p) => setActiveProject(p)}
                                onDelete={handleProjectDelete}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Spinner keyframe */}
            <style>{`
                @keyframes spin   { to { transform: rotate(360deg); } }
                @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
            `}</style>

        </div>
    )
}
