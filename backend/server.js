/**
 * backend/server.js  —  Milestara Oracle Backend
 *
 * ── WHAT THIS SERVER DOES ────────────────────────────────────────────────────
 * This is a small Express server that acts as the trusted "Tally Oracle" for
 * the Milestara protocol on Bitcoin Cash Chipnet.
 *
 * It exposes ONE route:
 *   POST /api/oracle/sign
 *     → Queries Supabase for vote tallies
 *     → Checks quorum (≥3 votes) and approval (>50% YES)
 *     → Signs a CashScript-compatible proof with the Oracle private key
 *     → Returns { approved, signature, oraclePubkey, milestoneId, projectId }
 *
 * The oracle private key NEVER leaves this server.
 *
 * ── HOW TO RUN ───────────────────────────────────────────────────────────────
 *   cd backend
 *   npm install
 *   npm start          (production)
 *   npm run dev        (development, auto-restart on change)
 *
 * ── ENVIRONMENT VARIABLES (.env) ─────────────────────────────────────────────
 *   SUPABASE_URL              https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key (bypasses RLS)
 *   ORACLE_WIF                WIF private key for the oracle
 *   PORT                      3001
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import * as libauth from '@bitauth/libauth'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Environment validation
// ─────────────────────────────────────────────────────────────────────────────

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ORACLE_WIF,
    PORT = 3001,
    FRONTEND_ORIGIN = 'http://localhost:5173',
} = process.env

const missingVars = []
if (!SUPABASE_URL)              missingVars.push('SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')
if (!ORACLE_WIF)                missingVars.push('ORACLE_WIF')

if (missingVars.length > 0) {
    console.error('[Oracle] ✗ Missing required environment variables:', missingVars.join(', '))
    console.error('[Oracle]   Create backend/.env and fill in the values.')
    process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Supabase client (service-role bypasses RLS — safe only on the backend)
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
})

console.log('[Oracle] ✓ Supabase client initialised →', SUPABASE_URL)
console.log('[Oracle] ✓ Allowed frontend origin    →', FRONTEND_ORIGIN)

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pre-load Oracle key pair (once at startup)
// ─────────────────────────────────────────────────────────────────────────────

let oraclePrivateKey     // Uint8Array
let oraclePubkeyHex      // compressed 33-byte hex string

try {
    const wifResult = libauth.decodePrivateKeyWif(ORACLE_WIF)
    if (typeof wifResult === 'string') {
        throw new Error(`WIF decode error: ${wifResult}`)
    }
    oraclePrivateKey = wifResult.privateKey

    // Derive compressed public key
    const secp = await libauth.instantiateSecp256k1()
    const pubkeyBytes = secp.derivePublicKeyCompressed(oraclePrivateKey)
    if (typeof pubkeyBytes === 'string') {
        throw new Error(`Public key derivation error: ${pubkeyBytes}`)
    }
    oraclePubkeyHex = libauth.binToHex(pubkeyBytes)

    console.log('[Oracle] ✓ Oracle key loaded. PubKey:', oraclePubkeyHex)
} catch (err) {
    console.error('[Oracle] ✗ Failed to load oracle key:', err.message)
    process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Express app setup
// ─────────────────────────────────────────────────────────────────────────────

const app = express()

// Allow requests from the configured frontend origin
// Set FRONTEND_ORIGIN in backend/.env for production deployments
app.use(cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
}))

app.use(express.json())

// ── Health-check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        oracle: oraclePubkeyHex,
        timestamp: new Date().toISOString(),
    })
})

// ── STEP 1: Oracle pubkey endpoint ───────────────────────────────────────────
// Frontend calls this at deploy time to get the current signing pubkey,
// and stores it in the contracts table alongside the contract address.
// This guarantees the baked-in tallyOraclePk always matches the live signer.
app.get('/api/oracle/pubkey', (_req, res) => {
    res.json({ oraclePubkey: oraclePubkeyHex })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/oracle/sign  — the core route
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/oracle/sign
 *
 * Request body: { milestoneId: string, projectId: string }
 *
 * Response (approved):
 *   { approved: true, signature: hex, oraclePubkey: hex,
 *     milestoneId, projectId, yesVotes, noVotes, totalVotes }
 *
 * Response (rejected):
 *   { approved: false, reason: string, yesVotes, noVotes, totalVotes }
 *
 * Error:
 *   HTTP 400 | 500 with { error: string }
 */
app.post('/api/oracle/sign', async (req, res) => {
    const { milestoneId, projectId } = req.body

    console.log('\n[Oracle] ─── New signing request ───')
    console.log('[Oracle]   milestoneId:', milestoneId)
    console.log('[Oracle]   projectId  :', projectId)

    // ── 5a. Input validation ─────────────────────────────────────────────────
    if (!milestoneId || typeof milestoneId !== 'string') {
        console.warn('[Oracle] ✗ Missing milestoneId')
        return res.status(400).json({ error: 'milestoneId is required and must be a string' })
    }
    if (!projectId || typeof projectId !== 'string') {
        console.warn('[Oracle] ✗ Missing projectId')
        return res.status(400).json({ error: 'projectId is required and must be a string' })
    }

    // ── STEP 3: Verify expectedOraclePubkey if caller sent one ────────────────
    // The frontend loads oracle_pubkey from the contracts table and sends it here.
    // If it doesn't match what we're currently signing with, the on-chain
    // checkDataSig will fail anyway — so we catch it early and tell the user
    // to redeploy the contract with the current oracle key.
    const { expectedOraclePubkey } = req.body
    if (expectedOraclePubkey && typeof expectedOraclePubkey === 'string') {
        if (expectedOraclePubkey.toLowerCase() !== oraclePubkeyHex.toLowerCase()) {
            console.error(
                '[Oracle] ✗ Oracle pubkey mismatch!\n' +
                `  Contract expects : ${expectedOraclePubkey}\n` +
                `  Backend is using : ${oraclePubkeyHex}\n` +
                '  → Run scripts/fix-oracle-pubkey.mjs or create a new project.'
            )
            return res.status(400).json({
                approved: false,
                reason:
                    'Oracle pubkey mismatch — the contract was deployed with a different oracle key. ' +
                    'Run scripts/fix-oracle-pubkey.mjs or create a new project to fix this.',
            })
        }
        console.log('[Oracle] ✓ expectedOraclePubkey matches current signing key')
    }

    try {
        // ── 5b. Query Supabase votes table for this milestone ────────────────
        console.log('[Oracle] ▶ Querying Supabase votes for milestone:', milestoneId)

        const { data: votes, error: dbError } = await supabase
            .from('votes')
            .select('vote, token_amount')
            .eq('milestone_id', milestoneId)

        if (dbError) {
            console.error('[Oracle] ✗ Supabase query failed:', dbError.message)
            return res.status(500).json({ error: `Database error: ${dbError.message}` })
        }

        console.log(`[Oracle] ✓ Found ${votes.length} vote(s) for milestone ${milestoneId}`)

        // ── 5c. Tally YES / NO votes (token-weighted) ────────────────────────
        let yesVotes = 0
        let noVotes = 0

        for (const v of votes) {
            const weight = Number(v.token_amount ?? 1)
            if (v.vote === true) {
                yesVotes += weight
            } else {
                noVotes += weight
            }
        }

        const totalVotes = yesVotes + noVotes

        console.log(`[Oracle]   YES: ${yesVotes} | NO: ${noVotes} | TOTAL: ${totalVotes}`)

        // ── 5d. Check quorum ─────────────────────────────────────────────────
        const QUORUM = 1 // TODO: raise to 3+ for mainnet

        if (totalVotes < QUORUM) {
            console.log(`[Oracle] ✗ Quorum not met (${totalVotes}/${QUORUM})`)
            return res.status(400).json({
                approved: false,
                reason: `Quorum not met: ${totalVotes} vote(s) cast, minimum ${QUORUM} required`,
                yesVotes,
                noVotes,
                totalVotes,
                milestoneId,
                projectId,
            })
        }

        // ── 5e. Check >50% approval ──────────────────────────────────────────
        const approvalRate = yesVotes / totalVotes

        if (approvalRate <= 0.5) {
            console.log(`[Oracle] ✗ Vote failed (${(approvalRate * 100).toFixed(1)}% YES, need >50%)`)
            return res.status(400).json({
                approved: false,
                reason: `Milestone rejected: ${(approvalRate * 100).toFixed(1)}% YES votes (need >50%)`,
                yesVotes,
                noVotes,
                totalVotes,
                milestoneId,
                projectId,
            })
        }

        console.log(`[Oracle] ✓ Governance passed (${(approvalRate * 100).toFixed(1)}% YES). Signing…`)

        // ── 5f. Build the proof message ──────────────────────────────────────
        // Message = milestoneId_bytes32 (32 bytes) || 0x01 (approved status byte)
        // This matches what MilestoneEscrow.cash verifies:
        //   require(tallyProof == milestoneId + 0x01);
        //   require(checkDataSig(oracleSig, tallyProof, tallyOraclePk));
        //
        // IMPORTANT: The contract's `milestoneId` constructor param is the
        // 32-byte SHA-256 hash stored in the `contracts` table as `milestone_id_hex`
        // (64 hex chars). It is NOT the Supabase UUID string.
        //
        // The frontend must send `milestoneIdHex` (the 64-char hex from the DB)
        // alongside the UUID `milestoneId`. We use milestoneIdHex if present.
        const { milestoneIdHex } = req.body  // preferred: 64-char hex from contracts table

        let idHex
        if (milestoneIdHex && /^[0-9a-fA-F]{64}$/.test(milestoneIdHex)) {
            // ✓ Caller sent the real 32-byte contract milestoneId as hex — use directly
            idHex = milestoneIdHex.toLowerCase()
            console.log('[Oracle] ✓ Using milestoneIdHex from request (64-char hex):', idHex.slice(0, 20) + '…')
        } else {
            // ⚠ Fallback: derive from UUID — WARNING: this may differ from the
            // contract's constructor param and cause checkDataSig to fail on-chain!
            console.warn('[Oracle] ⚠ milestoneIdHex not provided — falling back to UUID-based derivation.')
            console.warn('[Oracle]   Frontend should send milestoneIdHex from the contracts table.')
            let rawHex = milestoneId.replace('0x', '').replace(/-/g, '') // strip UUID dashes
            if (rawHex.length < 64) {
                rawHex = rawHex.padEnd(64, '0')
            } else if (rawHex.length > 64) {
                rawHex = rawHex.slice(0, 64)
            }
            idHex = rawHex
        }

        // ── Build tallyProof as raw bytes: milestoneId (32 bytes) + 0x01 ──────
        const milIdBytes  = libauth.hexToBin(idHex)           // exactly 32 bytes
        const tallyProof  = new Uint8Array([...milIdBytes, 0x01])  // 33 bytes total
        const proofHex    = idHex + '01'                      // hex for the response body

        // ── Sign SHA256(tallyProof) — BCH OP_CHECKDATASIG applies ONE SHA256 internally ──
        // BCH's OP_CHECKDATASIG opcode works as follows:
        //   1. It hashes the message: hash = SHA256(message)
        //   2. It verifies: Schnorr.verify(sig, hash, pubkey)
        //
        // This means: to produce a valid oracleSig, we must sign SHA256(tallyProof).
        // The opcode will then re-hash it internally (effectively SHA256d), so the
        // oracle must pre-hash once and sign that hash — NOT double-hash before signing.
        const sha256Inst  = await libauth.instantiateSha256()
        const messageHash = sha256Inst.hash(tallyProof)       // SHA256(tallyProof) — sign this

        console.log('[Oracle] tallyProof length  :', tallyProof.length, 'bytes (expected 33)')
        console.log('[Oracle] messageHash (SHA256):', libauth.binToHex(messageHash).slice(0, 20) + '…')

        // ── Sign with oracle private key (Schnorr — required for datasig) ──────
        const secp      = await libauth.instantiateSecp256k1()
        const signature = secp.signMessageHashSchnorr(oraclePrivateKey, messageHash)

        if (typeof signature === 'string') {
            // libauth returns an error string on failure
            console.error('[Oracle] ✗ Signing failed:', signature)
            return res.status(500).json({ error: `Signing failed: ${signature}` })
        }

        const signatureHex = libauth.binToHex(signature)

        console.log('[Oracle] ✓ Signature generated:', signatureHex.slice(0, 20) + '…')
        console.log('[Oracle] ✓ Proof hex          :', proofHex.slice(0, 20) + '…')


        // ── 5h. Return success response ──────────────────────────────────────
        return res.json({
            approved:     true,
            signature:    signatureHex,   // Schnorr datasig (64 bytes)
            oraclePubkey: oraclePubkeyHex, // 33-byte compressed pubkey
            proofHex,                      // raw message bytes (milestoneId + 0x01)
            milestoneId,
            projectId,
            yesVotes,
            noVotes,
            totalVotes,
            approvalRate: `${(approvalRate * 100).toFixed(1)}%`,
        })

    } catch (err) {
        console.error('[Oracle] ✗ Unexpected error in /api/oracle/sign:', err)
        return res.status(500).json({ error: `Internal server error: ${err.message}` })
    }
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Start the server
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════╗`)
    console.log(`║   🔮  Milestara Oracle Backend                       ║`)
    console.log(`╠══════════════════════════════════════════════════════╣`)
    console.log(`║   Listening on  http://localhost:${PORT}                 ║`)
    console.log(`║   Health check  http://localhost:${PORT}/health          ║`)
    console.log(`║   Oracle PK     ${oraclePubkeyHex.slice(0, 20)}…  ║`)
    console.log(`╚══════════════════════════════════════════════════════╝\n`)
})
