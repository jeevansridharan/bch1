/**
 * milestoneContract.js  —  Milestara Bitcoin Cash Chipnet Service (Production Refactor)
 *
 * This file handles Chipnet-based governance:
 *   1. Milestone Escrow (BCH locking)
 *   2. Token Distribution (Minting governance tokens)
 *   3. On-chain Tallying (Scanning UTXOs)
 * 
 * ─── PRODUCTION MODEL ────────────────────────────────────────────────────────
 * Governance power is derived ONLY from on-chain CashTokens.
 * Escrowed funds are locked in CashScript smart contracts.
 * Signatures from a Tally Oracle unlock the milestones.
 */

import { TestNetWallet } from 'mainnet-js'
import { mintGovTokens, GOV_TOKEN_CATEGORY_ID } from './govService'

// ── Constants ────────────────────────────────────────────────────────────────

// How many governance tokens to mint per 1 BCH (Session Unit: 1 BCH = 100,000 GOV)
const MINTING_RATIO = 100000

// Storage keys for UI cache only (Blockchain is source of truth)
const STORAGE_KEYS = {
    contractUtxo: 'milestara_chipnet_contract_info',
    tokenCategory: 'milestara_chipnet_token_id',
    tokenBalance: 'milestara_chipnet_token_balance',
    lockedAmount: 'milestara_chipnet_locked_amount',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
}

function loadFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultValue
    } catch {
        return defaultValue
    }
}

/**
 * fundMilestoneContract
 * 
 * Sends BCH to the escrow contract and triggers on-chain token minting.
 */
export async function fundMilestoneContract(wallet, amountBch, projectAddr) {
    if (!wallet) throw new Error('Connect wallet first')

    // 1. Send BCH to the project (In production, this is the Escrow Contract Address)
    // For now, we use projectAddr which acts as the 'Holding Address'
    const satoshis = BigInt(Math.round(parseFloat(amountBch) * 1e8))
    const result = await wallet.send([{ cashaddr: projectAddr, value: satoshis, unit: 'sat' }])

    // 2. Calculate tokens to mint
    const tokenAmount = Math.floor(amountBch * MINTING_RATIO)

    // 3. REAL ON-CHAIN MINTING
    // NOTE: In a production environment, VITE_MINTER_WIF would be in .env
    const MINTER_WIF = import.meta.env.VITE_MINTER_WIF

    let mintResult = { txId: 'simulation_only' }
    if (MINTER_WIF) {
        try {
            mintResult = await mintGovTokens(wallet.cashaddr, amountBch, MINTER_WIF)
        } catch (mintErr) {
            console.error('[milestoneContract] Minting failed, continuing without tokens:', mintErr)
        }
    } else {
        console.warn('[milestoneContract] VITE_MINTER_WIF missing. Token minting skipped (simulated only).')
    }

    // UI CACHE UPDATES
    const prevLocked = loadFromStorage(STORAGE_KEYS.lockedAmount, 0)
    saveToStorage(STORAGE_KEYS.lockedAmount, prevLocked + amountBch)

    const prevTokens = loadFromStorage(STORAGE_KEYS.tokenBalance, 0)
    saveToStorage(STORAGE_KEYS.tokenBalance, prevTokens + tokenAmount)

    return {
        simulatedTxId: result.txId,
        mintTxId: mintResult.txId,
        tokenAmount,
        tokenCategory: GOV_TOKEN_CATEGORY_ID
    }
}

/**
 * castVote
 *
 * Performs an on-chain transaction sending GOV tokens to the project-specific
 * Approve or Reject address.
 *
 * @param {object} wallet       — Connected mainnet-js wallet
 * @param {string} projectId    — Supabase project UUID (used to derive addresses)
 * @param {string} milestoneId  — Milestone identifier (for logging)
 * @param {string} voteType     — 'yes' | 'no'
 * @param {number} tokensToUse  — Number of GOV tokens to spend as votes
 */
export async function castVote(wallet, projectId, milestoneId, voteType, tokensToUse) {
    if (!wallet) throw new Error('Wallet not connected')
    if (!projectId) throw new Error('castVote: projectId is required for per-project voting')

    // 1. Get this project's deterministic voting addresses
    const { getProjectVotingAddresses, GOV_TOKEN_CATEGORY_ID } = await import('./govService')
    const { approveAddr, rejectAddr } = await getProjectVotingAddresses(projectId)
    const destination = voteType === 'yes' ? approveAddr : rejectAddr

    console.log(`[milestoneContract] Voting "${voteType}" on milestone ${milestoneId} (project: ${projectId})`)
    console.log(`  Destination: ${destination}`)
    console.log(`  Tokens to use: ${tokensToUse}`)

    try {
        // 2. Perform On-Chain Token Transfer (Voting)
        const { txId } = await wallet.send([
            {
                cashaddr: destination,
                value: 1000n,
                token: {
                    amount: BigInt(tokensToUse),
                    category: GOV_TOKEN_CATEGORY_ID,
                }
            }
        ])

        console.log(`[milestoneContract] ✓ Vote Broadcasted: ${txId}`)
        return { success: true, txId }
    } catch (err) {
        console.error('[milestoneContract] Voting failed:', err)
        throw new Error(`On-chain voting failed: ${err.message}`)
    }
}

/**
 * releaseMilestoneFunds
 *
 * Upgraded flow:
 *   1. POST /api/oracle/sign  → Oracle checks Supabase votes & signs proof
 *   2. Build CashScript release() transaction using oracle signature
 *   3. Broadcast to Chipnet
 *   4. Update milestone status in Supabase to "released"
 *
 * @param {object} wallet           — mainnet-js wallet (the project creator)
 * @param {number} amountBch        — Amount to claim (in BCH)
 * @param {string} contractAddress  — The P2SH address to spend from
 * @param {string} milestoneIdHex   — The 32-byte unique milestone ID (hex)
 * @param {number|string} deadline  — The contract deadline (block height int)
 * @param {string} milestoneId      — Supabase UUID of the milestone (for DB update)
 * @param {string} projectId        — Supabase UUID of the project
 */
export async function releaseMilestoneFunds(
    wallet,
    amountBch,
    contractAddress,
    milestoneIdHex,
    deadline,
    milestoneId,
    projectId,
) {
    if (!wallet) throw new Error('Connect wallet to claim funds')
    if (!contractAddress || !milestoneIdHex) {
        throw new Error('On-chain metadata missing. Cannot re-instantiate contract.')
    }
    if (!milestoneId || !projectId) {
        throw new Error('milestoneId and projectId are required for oracle signing.')
    }

    console.log(`[milestoneContract] ── Starting Oracle Release ────────────────`)
    console.log(`[milestoneContract]   Contract : ${contractAddress}`)
    console.log(`[milestoneContract]   Milestone: ${milestoneId}`)
    console.log(`[milestoneContract]   Project  : ${projectId}`)

    // ── STEP 1: Request oracle signature from the backend ─────────────────────
    console.log('[milestoneContract] ▶ Calling Oracle backend…')

    let oracleResponse
    try {
        const response = await fetch('http://localhost:3001/api/oracle/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestoneId, projectId }),
        })

        oracleResponse = await response.json()

        if (!response.ok) {
            throw new Error(oracleResponse.error ?? `Oracle server error: HTTP ${response.status}`)
        }
    } catch (fetchErr) {
        if (fetchErr.name === 'TypeError' && fetchErr.message.includes('fetch')) {
            throw new Error(
                'Cannot reach Oracle backend. ' +
                'Make sure it is running: cd backend && npm start'
            )
        }
        throw fetchErr
    }

    console.log('[milestoneContract] Oracle response:', oracleResponse)

    // ── STEP 2: Check oracle approval ─────────────────────────────────────────
    if (!oracleResponse.approved) {
        throw new Error(`Oracle rejected: ${oracleResponse.reason}`)
    }

    const { signature: signatureHex, oraclePubkey: oraclePubkeyHex, proofHex } = oracleResponse

    console.log('[milestoneContract] ✓ Oracle approved! Building CashScript release() tx…')

    // ── STEP 3: Build & broadcast CashScript release() transaction ────────────
    try {
        const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await import('cashscript')
        const { hexToBin } = await import('@bitauth/libauth')

        // Import the compiled MilestoneEscrow artifact
        const artifactModule = await import('../../production/contracts/MilestoneEscrow.json', {
            assert: { type: 'json' },
        }).catch(() => import('../../production/contracts/MilestoneEscrow.json'))
        const artifact = artifactModule.default ?? artifactModule

        // Setup Chipnet provider
        const provider = new ElectrumNetworkProvider('chipnet')

        // Re-derive constructor parameters (must match what was used on deploy)
        if (!wallet.publicKey) throw new Error('Wallet public key missing. Try reconnecting.')

        const creatorPk = typeof wallet.publicKey === 'string'
            ? hexToBin(wallet.publicKey)
            : wallet.publicKey

        const funderPk  = creatorPk  // Creator == Funder in current flow
        const oraclePk  = hexToBin(oraclePubkeyHex) // From oracle response (server-side)

        // Normalise milestoneId to 32 bytes (64 hex chars)
        let idHex = milestoneIdHex.replace('0x', '')
        if (idHex.length < 64) idHex = idHex.padEnd(64, '0')
        const milIdBytes = hexToBin(idHex)
        const dlInt      = BigInt(deadline)

        // Instantiate the contract
        const contract = new Contract(
            artifact,
            [creatorPk, funderPk, oraclePk, milIdBytes, dlInt],
            { provider },
        )

        // Warn (don't fail) if address doesn't match — useful for debugging
        if (contract.address !== contractAddress) {
            console.warn(
                `[milestoneContract] ⚠ Address mismatch!\n` +
                `  Derived : ${contract.address}\n` +
                `  Expected: ${contractAddress}`
            )
        }

        // Build the oracle datasig and proof bytes
        const oracleSigBytes = hexToBin(signatureHex)
        const proofBytes     = hexToBin(proofHex)

        // Creator signature template (signs the release transaction)
        const creatorSigTemplate = new SignatureTemplate(wallet.privateKeyWif)

        // Calculate release amount (deduct a 1000 sat miner fee)
        const releaseAmount = BigInt(Math.round((amountBch - 0.00001) * 1e8))

        console.log(`[milestoneContract] ▶ Broadcasting release() to Chipnet…`)
        console.log(`[milestoneContract]   Release amount: ${releaseAmount} sat`)
        console.log(`[milestoneContract]   Recipient     : ${wallet.cashaddr}`)

        const tx = await contract.functions
            .release(creatorSigTemplate, oracleSigBytes, proofBytes)
            .to(wallet.cashaddr, releaseAmount)
            .send()

        console.log(`[milestoneContract] ✓ Funds Released! TX ID: ${tx.txid}`)

        // ── STEP 4: Update Supabase milestone status to "released" ────────────
        try {
            const { updateMilestoneStatus } = await import('../lib/db/milestones')
            await updateMilestoneStatus(milestoneId, 'released')
            console.log('[milestoneContract] ✓ Milestone status updated to "released" in Supabase')
        } catch (dbErr) {
            // Non-fatal — funds are already released on-chain
            console.error('[milestoneContract] ⚠ DB status update failed (funds still released):', dbErr.message)
        }

        // Update local cache
        const locked = loadFromStorage(STORAGE_KEYS.lockedAmount, 0)
        saveToStorage(STORAGE_KEYS.lockedAmount, Math.max(0, locked - amountBch))

        return tx.txid

    } catch (err) {
        console.error('[milestoneContract] ✗ Release failed:', err)
        throw new Error(`Oracle Release failed: ${err.message}`)
    }
}

// ── Getters ───────────────────────────────────────────────────────────────────

export function getLockedAmount() {
    return loadFromStorage(STORAGE_KEYS.lockedAmount, 0)
}

export function clearContractState() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
}

export function chipnetExplorerUrl(txId) {
    return `https://chipnet.imaginary.cash/tx/${txId}`
}
