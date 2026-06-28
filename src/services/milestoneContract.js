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
    // If milIdHex is not yet available from props, load it from the DB NOW
    // so we can pass it to the oracle. Both sides must sign/verify the SAME bytes.
    if (!milIdHex) {
        try {
            const { loadContractMetadata } = await import('../lib/db/contracts')
            const meta = await loadContractMetadata(projectId)
            if (meta?.milestone_id_hex) {
                milIdHex = meta.milestone_id_hex
                console.log('[milestoneContract] milestone_id_hex from DB:', meta.milestone_id_hex)
                console.log('[milestoneContract] ✓ Pre-loaded milIdHex from DB for oracle call:', milIdHex.slice(0, 20) + '…')
            }
        } catch (preloadErr) {
            console.warn('[milestoneContract] Could not pre-load milIdHex before oracle call:', preloadErr.message)
        }
    }

    const oracleSignUrl = `${ORACLE_URL}/api/oracle/sign`
    console.log('[milestoneContract] ▶ Calling Oracle backend…', oracleSignUrl)

    let oracleResponse
    try {
        const response = await fetch(oracleSignUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                milestoneId,       // Supabase UUID (for vote tally lookup)
                projectId,
                milestoneIdHex: milIdHex ?? undefined,  // 64-char SHA-256 hex (for proof construction)
                // STEP 3: Send the pubkey stored in the contracts table so the backend
                // can catch a key mismatch early (before the on-chain checkDataSig fails).
                expectedOraclePubkey: contractAddress
                    ? await (async () => {
                        try {
                            const { loadContractMetadata } = await import('../lib/db/contracts')
                            const m = await loadContractMetadata(projectId)
                            return m?.oracle_pubkey ?? undefined
                        } catch { return undefined }
                    })()
                    : undefined,
            }),
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
    console.log('[milestoneContract]   Oracle signing pubkey:', oraclePubkeyHex)

    // ── PRE-FLIGHT: Verify oracle signing key matches what's in the contract ───
    // The contract bakes tallyOraclePk into its bytecode at deploy time.
    // checkDataSig() will ALWAYS fail if the key that signed the proof (from the
    // oracle backend) differs from the key stored in the contracts table.
    // Catch this here and fail fast with a clear explanation.
    try {
        const { loadContractMetadata } = await import('../lib/db/contracts')
        const preflightMeta = await loadContractMetadata(projectId)
        if (preflightMeta?.oracle_pubkey) {
            const storedOraclePk = preflightMeta.oracle_pubkey.toLowerCase()
            const signingOraclePk = oraclePubkeyHex.toLowerCase()
            console.log('[milestoneContract]   Stored contract oraclePk:', storedOraclePk)
            if (storedOraclePk !== signingOraclePk) {
                throw new Error(
                    `Oracle pubkey mismatch — checkDataSig() will fail on-chain!\n` +
                    `  Contract deployed with : ${storedOraclePk}\n` +
                    `  Backend is signing with: ${signingOraclePk}\n` +
                    `  Fix: redeploy the contract so it uses the current oracle pubkey, ` +
                    `  or update backend/.env ORACLE_WIF to match the key the contract was deployed with.`
                )
            }
            console.log('[milestoneContract] ✓ Oracle pubkey match confirmed — checkDataSig() should pass')
        }
    } catch (preflightErr) {
        // Re-throw the mismatch error — it's fatal
        if (preflightErr.message.includes('Oracle pubkey mismatch')) throw preflightErr
        // Other errors (DB unavailable etc.) are non-fatal — log and continue
        console.warn('[milestoneContract] ⚠ Could not preflight oracle pubkey check:', preflightErr.message)
    }

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
        const { hexToBin, binToHex } = await import('@bitauth/libauth')

        const provider = new ElectrumNetworkProvider('chipnet')

        if (!wallet.publicKey) throw new Error('Wallet public key missing. Try reconnecting.')

        // ── Use the EXACT same pubkeys that were used at deploy time ───────────
        // The contract address is deterministic: if any pubkey differs from the
        // original constructor args, a different P2SH address is derived and the
        // UTXO lookup fails. Load stored pubkeys from the DB metadata first;
        // fall back to live wallet / oracle values only when not available.
        let creatorPkHexStored = null
        let funderPkHexStored  = null
        let oraclePkHexStored  = null
        try {
            const { loadContractMetadata } = await import('../lib/db/contracts')
            const meta = await loadContractMetadata(projectId)
            if (meta) {
                creatorPkHexStored = meta.creator_pubkey
                funderPkHexStored  = meta.funder_pubkey
                oraclePkHexStored  = meta.oracle_pubkey
                console.log('[milestoneContract] ✓ Loaded stored pubkeys from DB for contract reconstruction')
            }
        } catch (metaLoadErr) {
            console.warn('[milestoneContract] Could not load stored pubkeys from DB, using live values:', metaLoadErr.message)
        }

        // Resolve wallet pubkey to hex string (handles Uint8Array from mainnet-js)
        const walletPkRaw = wallet.publicKey
        const walletPkHexLive = typeof walletPkRaw === 'string'
            ? walletPkRaw
            : binToHex(walletPkRaw)

        // Params in the exact order of the MilestoneEscrow constructor:
        //   (creatorPk, funderPk, tallyOraclePk, milestoneId, deadline)
        const creatorPk = hexToBin(creatorPkHexStored ?? walletPkHexLive)
        const funderPk  = hexToBin(funderPkHexStored  ?? walletPkHexLive)
        const oraclePk  = hexToBin(oraclePkHexStored  ?? oraclePubkeyHex)

        // Normalise milestoneId to 32 bytes (64 hex chars) — use milIdHex (may come from DB)
        let idHex = milIdHex.replace('0x', '')
        if (idHex.length < 64) idHex = idHex.padEnd(64, '0')
        const milIdBytes = hexToBin(idHex)
        const dlInt = BigInt(deadlineValue)

        // Constructor params order must match MilestoneEscrow.cash exactly:
        // (creatorPk, funderPk, tallyOraclePk, milestoneId, deadline)
        const contract = new Contract(
            artifact,
            [creatorPk, funderPk, oraclePk, milIdBytes, dlInt],
            { provider },
        )

        // ── Diagnostic: verify artifact and contract instance ─────────────────
        console.log('[milestoneContract] Artifact:', artifact?.contractName, artifact?.bytecode ? 'OK' : 'MISSING bytecode')
        console.log('[milestoneContract] Contract instance:', contract)
        console.log('[milestoneContract] Contract.unlock:', contract?.unlock)

        // cashscript v0.12.x: functions are on contract.unlock.<name>(), NOT contract.functions.<name>()
        if (!contract || !contract.unlock || typeof contract.unlock.release !== 'function') {
            throw new Error(
                `Contract reconstruction failed — unlock.release is not a function. ` +
                `Instance: ${JSON.stringify({ address: contract?.address, unlockKeys: Object.keys(contract?.unlock ?? {}) })}`
            )
        }

        if (contract.address !== contractAddr) {
            console.warn(
                `[milestoneContract] ⚠ Address mismatch!\n` +
                `  Derived : ${contract.address}\n` +
                `  Expected: ${contractAddr}`
            )
        }

        const oracleSigBytes = hexToBin(signatureHex)

        // ── Build tallyProof to match EXACTLY what the contract checks ─────────
        // MilestoneEscrow.cash line 26:
        //   require(tallyProof == milestoneId + 0x01);
        //
        // The contract's constructor param `milestoneId` is the 32-byte SHA-256
        // hash stored in `milIdHex` (loaded from the contracts table).
        //
        // The oracle's proofHex is built from the Supabase UUID, which is a
        // DIFFERENT value — it would fail the contract's equality check.
        //
        // We must build tallyProof here from the EXACT same milIdHex used to
        // construct the Contract instance above, then 0x01 appended:
        //   tallyProof = milestoneId_bytes (32) || 0x01 (1) = 33 bytes total
        //
        // The oracle signed SHA256(proofHex_from_uuid), but the contract verifies
        // checkDataSig(oracleSig, tallyProof, tallyOraclePk) which internally
        // does SHA256(tallyProof). For this to pass, the oracle MUST sign the
        // same bytes we pass here. So we rebuild both to use milIdHex consistently.
        const contractMilIdHex = idHex  // the normalised 64-char hex from line ~364
        const contractMilIdBytes = milIdBytes  // the 32-byte Uint8Array already computed above

        // tallyProof = milestoneId (32 bytes) + 0x01 (approved status byte)
        const tallyProof = new Uint8Array([...contractMilIdBytes, 0x01])
        const tallyProofHex = contractMilIdHex + '01'

        console.log('[milestoneContract] tallyProof built from DB value:', binToHex(tallyProof))
        console.log('[milestoneContract] tallyProof length:', tallyProof.length, 'bytes (expected 33)')

        // ── Verify the oracle signature is valid over our tallyProof ──────────
        // If the oracle signed a different message (UUID-based proof), the
        // datasig check will still fail on-chain. Log a warning so it's visible.
        const oracleProofHexFromServer = proofHex ?? ''
        if (oracleProofHexFromServer.toLowerCase() !== tallyProofHex.toLowerCase()) {
            console.warn(
                '[milestoneContract] ⚠ Oracle proofHex differs from contract milestoneId!\n' +
                `  Oracle proof  : ${oracleProofHexFromServer.slice(0, 20)}…\n` +
                `  Contract proof: ${tallyProofHex.slice(0, 20)}…\n` +
                '  The oracle must sign SHA256(milIdHex + 01). Check backend/server.js proof construction.'
            )
        }

        // Build the unlocker for the release() function
        // Arg order matches MilestoneEscrow.cash release() signature exactly:
        //   release(sig creatorSig, datasig oracleSig, bytes tallyProof)

        if (!wallet.privateKeyWif) {
            throw new Error(
                'Wallet has no WIF private key. Cannot build SignatureTemplate. ' +
                'Ensure the wallet was initialised with initializeWallet() from bchWallet.js.'
            )
        }
        const creatorSigTemplate = new SignatureTemplate(wallet.privateKeyWif)


        // ── Derive recipient address from creatorPk (must match contract) ────
        // MilestoneEscrow.cash enforces:
        //   tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(hash160(creatorPk))
        //
        // So we must send to the P2PKH address derived from the EXACT creatorPk
        // used in the contract constructor — NOT wallet.cashaddr (which may differ).
        const libauth = await import('@bitauth/libauth')
        const sha256Engine = await libauth.instantiateSha256()
        const ripemd160Engine = await libauth.instantiateRipemd160()
        const creatorPkHash = ripemd160Engine.hash(sha256Engine.hash(creatorPk))  // HASH160 = RIPEMD160(SHA256(pubkey))

        // Encode as P2PKH cashaddr on chipnet (type 0 = P2PKH)
        const creatorAddrResult = libauth.encodeCashAddress({
            prefix: 'bchtest',
            type: 0,
            payload: creatorPkHash,
        })
        // encodeCashAddress may return a string directly or an object with .address
        const creatorP2PKH = typeof creatorAddrResult === 'string'
            ? creatorAddrResult
            : creatorAddrResult.address

        console.log(`[milestoneContract]   Recipient (creatorPk P2PKH): ${creatorP2PKH}`)
        if (creatorP2PKH !== wallet.cashaddr) {
            console.warn(`[milestoneContract] ⚠ Creator P2PKH differs from wallet.cashaddr!`)
            console.warn(`[milestoneContract]   Creator P2PKH : ${creatorP2PKH}`)
            console.warn(`[milestoneContract]   Wallet addr   : ${wallet.cashaddr}`)
        }

        // ── cashscript v0.12.1 Transaction API ───────────────────────────────
        // 1. Get contract UTXOs  →  contract.getUtxos()
        // 2. Build unlocker      →  contract.unlock.release(...)
        // 3. Wire + broadcast    →  TransactionBuilder.addInputs(utxos, unlocker).addOutput(...).send()
        const { TransactionBuilder } = await import('cashscript')

        const utxos = await contract.getUtxos()
        if (!utxos || utxos.length === 0) {
            throw new Error(
                `No UTXOs found at contract address ${contract.address}. ` +
                `The contract may not be funded, or the address was reconstructed incorrectly.`
            )
        }

        // Sum ALL contract UTXOs to get the true on-chain balance
        const totalUtxoSats = utxos.reduce((sum, u) => sum + BigInt(u.satoshis), 0n)
        console.log(`[milestoneContract]   Contract UTXOs: ${utxos.length} (total: ${totalUtxoSats} sat)`)

        // Deduct a realistic miner fee (1200 sat covers P2PKH output + unlocking script overhead)
        // Using the real UTXO total avoids the "output > input" error that occurs when
        // amountBch doesn't match the actual on-chain balance.
        if (totalUtxoSats < 1200n) {
            throw new Error(
                `Contract balance (${totalUtxoSats} sat) is too low to cover the miner fee (1200 sat). ` +
                `Fund the contract with more BCH before releasing.`
            )
        }
        const releaseAmount = totalUtxoSats - 1200n

        console.log(`[milestoneContract] ▶ Broadcasting release() to Chipnet…`)
        console.log(`[milestoneContract]   Release amount (after 1200 sat fee): ${releaseAmount} sat`)

        const releaseUnlocker = contract.unlock.release(creatorSigTemplate, oracleSigBytes, tallyProof)

        const tx = await new TransactionBuilder({ provider })
            .addInputs(utxos, releaseUnlocker)
            .addOutput({ to: creatorP2PKH, amount: releaseAmount })
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
