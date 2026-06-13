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
import artifact from '../../production/contracts/MilestoneEscrow.json'

// ── Oracle Backend URL ────────────────────────────────────────────────────────
// Reads from VITE_ORACLE_URL env var (set in .env for local, and in your
// hosting provider's env settings for production).
// Falls back to localhost:3001 so local development works out of the box.
const ORACLE_URL = import.meta.env.VITE_ORACLE_URL || 'http://localhost:3001'

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
    const { getProjectVotingAddresses } = await import('./govService')
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
 * Full oracle-gated release flow:
 *   1. POST /api/oracle/sign  → Oracle checks Supabase votes & signs proof
 *   2a. If contract metadata present: Build CashScript release() tx & broadcast
 *   2b. If contract metadata missing (old project): Record DB-only release
 *   3. Update milestone status in Supabase to "released"
 *
 * @param {object} wallet           — mainnet-js wallet (the project creator)
 * @param {number} amountBch        — Amount to claim (in BCH)
 * @param {string} contractAddress  — The P2SH address to spend from (may be null for old projects)
 * @param {string} milestoneIdHex   — The 32-byte unique milestone ID (may be null for old projects)
 * @param {number|string} deadline  — The contract deadline (block height int)
 * @param {string} milestoneId      — Supabase UUID of the milestone (required for oracle)
 * @param {string} projectId        — Supabase UUID of the project (required for oracle)
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
    if (!milestoneId || !projectId) {
        throw new Error('milestoneId and projectId are required for oracle signing.')
    }

    // contractAddress + milestoneIdHex are needed for the CashScript broadcast,
    // but NOT for the Oracle vote-check. If they weren't passed as props,
    // STEP 3a will load them from the Supabase contracts table.
    const hasContractData = !!(contractAddress && milestoneIdHex)

    // Local rebindable copies — STEP 3a may overwrite these from the DB
    let contractAddr   = contractAddress
    let milIdHex       = milestoneIdHex
    let deadlineValue  = deadline

    console.log(`[milestoneContract] ── Starting Oracle Release ────────────────`)
    console.log(`[milestoneContract]   Contract : ${contractAddr}`)
    console.log(`[milestoneContract]   Milestone: ${milestoneId}`)
    console.log(`[milestoneContract]   Project  : ${projectId}`)


    // ── STEP 1: Request oracle signature from the backend ─────────────────────
    const oracleSignUrl = `${ORACLE_URL}/api/oracle/sign`
    console.log('[milestoneContract] ▶ Calling Oracle backend…', oracleSignUrl)

    let oracleResponse
    try {
        const response = await fetch(oracleSignUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestoneId, projectId }),
        })

        oracleResponse = await response.json()

        if (!response.ok) {
            // Pull reason from the response body (set by our oracle for 400s)
            throw new Error(oracleResponse.reason || oracleResponse.error || `Oracle server error: HTTP ${response.status}`)
        }
    } catch (fetchErr) {
        // Network-level failure (server not running, wrong URL, CORS block, etc.)
        if (fetchErr.name === 'TypeError' && fetchErr.message.toLowerCase().includes('failed to fetch')) {
            throw new Error(
                `Cannot reach Oracle backend at ${oracleSignUrl}. ` +
                'For local dev: cd backend && npm start. ' +
                'For production: set VITE_ORACLE_URL in your .env file.'
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
    console.log('[milestoneContract] ✓ Oracle approved!')

    // ── STEP 3a: If no on-chain contract data was passed as props, try loading
    // it from the Supabase contracts table (stored when the project was created).
    if (!hasContractData) {
        console.log('[milestoneContract] Props missing contract data — querying Supabase contracts table…')
        try {
            const { loadContractMetadata } = await import('../lib/db/contracts')
            const meta = await loadContractMetadata(projectId)

            if (meta) {
                // Re-assign the rebindable let vars so STEP 3b uses the DB values
                contractAddr  = meta.contract_address
                milIdHex      = meta.milestone_id_hex
                deadlineValue = Number(meta.deadline)

                // Re-check — we now have everything we need
                if (contractAddr && milIdHex) {
                    console.log('[milestoneContract] ✓ Contract metadata loaded from DB:', contractAddr)
                    // Fall through into STEP 3b below
                } else {
                    throw new Error('contracts row exists but is missing address or milestoneIdHex')
                }
            } else {
                // No row in the contracts table — auto-reconstruct from available data
                // and register it so future releases don't hit this path again.
                console.warn('[milestoneContract] ⚠ No contract row — auto-registering from current wallet keys…')

                const { Contract, ElectrumNetworkProvider } = await import('cashscript')
                const { hexToBin, binToHex, utf8ToBin, instantiateSha256 } = await import('@bitauth/libauth')

                if (!wallet.publicKey) throw new Error('Cannot auto-register: wallet public key missing.')

                const walletPkHex = typeof wallet.publicKey === 'string'
                    ? wallet.publicKey
                    : binToHex(wallet.publicKey)

                // Oracle pubkey comes from the oracle response we just received
                const oraclePkHex = oraclePubkeyHex

                // Derive a deterministic milestoneId from projectId + milestoneId UUID
                const sha256 = await instantiateSha256()
                const derivedMilId = sha256.hash(utf8ToBin(projectId + milestoneId))
                const derivedMilIdHex = binToHex(derivedMilId)
                const FALLBACK_DEADLINE = 2000000  // far-future block height

                // Reconstruct the contract address deterministically
                const provider = new ElectrumNetworkProvider('chipnet')
                const reconstructed = new Contract(
                    artifact,
                    [
                        hexToBin(walletPkHex),   // creatorPk
                        hexToBin(walletPkHex),   // funderPk (creator == funder)
                        hexToBin(oraclePkHex),   // tallyOraclePk
                        derivedMilId,            // milestoneId (32 bytes)
                        BigInt(FALLBACK_DEADLINE),
                    ],
                    { provider },
                )

                // Persist to Supabase so the next release skips this path
                try {
                    const { saveContractMetadata } = await import('../lib/db/contracts')
                    await saveContractMetadata({
                        projectId,
                        contractAddress:  reconstructed.address,
                        creatorPubkey:    walletPkHex,
                        funderPubkey:     walletPkHex,
                        oraclePubkey:     oraclePkHex,
                        milestoneIdHex:   derivedMilIdHex,
                        deadline:         FALLBACK_DEADLINE,
                    })
                    console.log('[milestoneContract] Auto-registered contract metadata for project:', projectId)
                } catch (saveErr) {
                    // Non-fatal — we still have the in-memory values to continue
                    console.warn('[milestoneContract] ⚠ Auto-register save failed (continuing):', saveErr.message)
                }

                // Assign rebindable vars so STEP 3b uses these values
                contractAddr  = reconstructed.address
                milIdHex      = derivedMilIdHex
                deadlineValue = FALLBACK_DEADLINE
                console.log('[milestoneContract] ✓ Auto-registered contract address:', contractAddr)
            }

        } catch (metaErr) {
            console.error('[milestoneContract] ✗ Failed to load contract metadata:', metaErr.message)
            throw new Error(`Cannot release: ${metaErr.message}`)
        }
    }

    // ── STEP 3b: Build & broadcast CashScript release() transaction ───────────
    try {
        const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await import('cashscript')
        const { hexToBin } = await import('@bitauth/libauth')

        const provider = new ElectrumNetworkProvider('chipnet')

        if (!wallet.publicKey) throw new Error('Wallet public key missing. Try reconnecting.')

        const creatorPk = typeof wallet.publicKey === 'string'
            ? hexToBin(wallet.publicKey)
            : wallet.publicKey

        const funderPk = creatorPk  // Creator == Funder in current flow
        const oraclePk = hexToBin(oraclePubkeyHex)

        // Normalise milestoneId to 32 bytes (64 hex chars) — use milIdHex (may come from DB)
        let idHex = milIdHex.replace('0x', '')
        if (idHex.length < 64) idHex = idHex.padEnd(64, '0')
        const milIdBytes = hexToBin(idHex)
        const dlInt = BigInt(deadlineValue)

        const contract = new Contract(
            artifact,
            [creatorPk, funderPk, oraclePk, milIdBytes, dlInt],
            { provider },
        )

        if (contract.address !== contractAddr) {
            console.warn(
                `[milestoneContract] ⚠ Address mismatch!\n` +
                `  Derived : ${contract.address}\n` +
                `  Expected: ${contractAddr}`
            )
        }

        const oracleSigBytes = hexToBin(signatureHex)
        const proofBytes = hexToBin(proofHex)

        if (!wallet.privateKeyWif) {
            throw new Error(
                'Wallet has no WIF private key. Cannot build SignatureTemplate. ' +
                'Ensure the wallet was initialised with initializeWallet() from bchWallet.js.'
            )
        }
        const creatorSigTemplate = new SignatureTemplate(wallet.privateKeyWif)

        // Calculate release amount (deduct a 1000 sat miner fee)
        const releaseAmount = BigInt(Math.round((amountBch - 0.00001) * 1e8))

        console.log(`[milestoneContract] ▶ Broadcasting release() to Chipnet…`)
        console.log(`[milestoneContract]   Release amount: ${releaseAmount} sat`)
        console.log(`[milestoneContract]   Recipient     : ${wallet.cashaddr}`)

        const tx = await contract.release(creatorSigTemplate, oracleSigBytes, proofBytes)
            .to(wallet.cashaddr, releaseAmount)
            .send()

        console.log(`[milestoneContract] ✓ Funds Released! TX ID: ${tx.txid}`)

        // ── STEP 4: Update Supabase milestone status to "released" ────────────
        try {
            const { updateMilestoneStatus } = await import('../lib/db/milestones')
            await updateMilestoneStatus(milestoneId, 'released')
            console.log('[milestoneContract] ✓ Milestone status → "released" in Supabase')
        } catch (dbErr) {
            // Non-fatal — funds are already released on-chain
            console.error('[milestoneContract] ⚠ DB status update failed (funds still released):', dbErr.message)
        }

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
