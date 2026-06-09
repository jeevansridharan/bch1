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
        // Message = milestoneId (padded to 32 bytes) || 0x01 (approved status byte)
        // This matches what MilestoneEscrow.cash verifies:
        //   require(tallyProof == milestoneId + 0x01);
        //   require(checkDataSig(oracleSig, tallyProof, tallyOraclePk));
        let idHex = milestoneId.replace('0x', '').replace(/-/g, '') // strip UUID dashes if present
        if (idHex.length < 64) {
            // UUID hex (32 chars) → pad to 64 chars (32 bytes)
            idHex = idHex.padEnd(64, '0')
        } else if (idHex.length > 64) {
            idHex = idHex.slice(0, 64)
        }

        // proofMessage = milestoneId_bytes32 || 0x01
        const proofHex     = idHex + '01'
        const proofBytes   = libauth.hexToBin(proofHex)

        // CashScript's checkDataSig opcode hashes the message with SHA256 before
        // verifying the Schnorr signature. So we sign SHA256(proofBytes).
        const sha256      = await libauth.instantiateSha256()
        const messageHash = sha256.hash(proofBytes)

        // ── 5g. Sign with oracle private key (Schnorr — required for datasig) ──
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
