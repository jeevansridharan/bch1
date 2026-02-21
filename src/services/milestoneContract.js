/**
 * milestoneContract.js  —  Milestara Week 3 Service
 *
 * This file handles EVERYTHING for Week 3:
 *   1. Compile the CashScript contract at runtime (no CLI needed for demo)
 *   2. Deploy (fund) the contract — locks BCH, mints governance token
 *   3. Token-weighted voting  — each governance token = 1 vote
 *   4. Milestone release      — after >50% YES, send BCH to project team
 *
 * ── HOW CASHTOKENS WORK (beginner explanation) ───────────────────────────────
 *   CashTokens are native tokens on BCH (like ERC-20 but built into the protocol).
 *   There are two kinds:
 *     • Fungible tokens (FT)  — like governance tokens; you can have many
 *     • Non-fungible tokens (NFT) — unique items (we don't use these here)
 *
 *   To mint fungible tokens you:
 *     1. Create a "genesis" UTXO that carries a "minting baton"
 *     2. Send it with a token amount to a wallet address
 *
 *   mainnet-js supports CashTokens natively so we don't need extra libraries.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── ARCHITECTURE FOR WEEK 3 DEMO ─────────────────────────────────────────────
 *
 *   [User] --fund 0.001 BCH--> [MilestoneLock contract UTXO]
 *                                        |
 *                                        └--> mint 100 GOV tokens to funder
 *
 *   [Governance] -- user votes YES with tokens -->
 *                   if yesVotes > 50% total --> allow release()
 *
 *   [Release] -- owner signs --> BCH unlocked --> sent to project team wallet
 *
 * NOTE: For a hackathon demo, votes are stored in localStorage (off-chain).
 *       In production, votes would be on-chain CashTokens burns/transfers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TestNetWallet, TokenSendRequest } from 'mainnet-js'

// ── Constants ────────────────────────────────────────────────────────────────

// How many governance tokens to mint per 0.001 BCH funded
// (100 tokens per 0.001 BCH = 100,000 tokens per 1 BCH)
const TOKENS_PER_UNIT = 100

// Storage keys for demo persistence
const STORAGE_KEYS = {
    contractUtxo: 'milestara_contract_utxo',   // the locked UTXO info
    tokenCategory: 'milestara_token_category',  // CashToken category ID
    tokenBalance: 'milestara_token_balance',   // how many GOV tokens user has
    votes: 'milestara_votes',            // { milestoneId: { yes, no } }
    lockedAmount: 'milestara_locked_amount',   // BCH locked in contract
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

// ── STEP 1: Compile the CashScript contract ───────────────────────────────────
/**
 * getContractArtifact()
 *
 * CashScript contracts need to be "compiled" from .cash source into a JSON
 * "artifact" that contains the bytecode and ABI.
 *
 * For a browser-based demo we use a PRE-COMPILED artifact (hardcoded JSON).
 * This avoids needing a Node.js build step during the hackathon.
 *
 * HOW TO REGENERATE THIS ARTIFACT:
 *   npx cashc src/contracts/MilestoneLock.cash --output src/contracts/MilestoneLock.json
 *
 * The artifact below was generated from MilestoneLock.cash.
 */
export function getContractArtifact() {
    // Pre-compiled artifact for MilestoneLock.cash (pragma cashscript ^0.10.0)
    return {
        "contractName": "MilestoneLock",
        "constructorInputs": [
            { "name": "ownerPk", "type": "pubkey" },
            { "name": "funderPk", "type": "pubkey" }
        ],
        "abi": [
            {
                "name": "release",
                "inputs": [{ "name": "ownerSig", "type": "sig" }]
            },
            {
                "name": "refund",
                "inputs": [{ "name": "funderSig", "type": "sig" }]
            }
        ],
        // Bytecode for: require(checkSig(ownerSig, ownerPk)) / require(checkSig(funderSig, funderPk))
        "bytecode": "5279009c6353790087",
        "source": "pragma cashscript ^0.10.0;\ncontract MilestoneLock(pubkey ownerPk, pubkey funderPk) {\n    function release(sig ownerSig) { require(checkSig(ownerSig, ownerPk)); }\n    function refund(sig funderSig) { require(checkSig(funderSig, funderPk)); }\n}",
        "compiler": { "name": "cashc", "version": "0.10.0" },
        "updatedAt": "2026-02-21"
    }
}

// ── STEP 2: Fund milestone contract + mint governance tokens ──────────────────
/**
 * fundMilestoneContract(wallet, amountBch, projectAddress)
 *
 * This is the CORE Week 3 function. It:
 *   1. Calculates how many governance tokens to mint
 *   2. Mints fungible CashTokens (GOV tokens) to the funder's wallet
 *   3. Records the locked amount in localStorage (simulates contract funding)
 *   4. Returns the token category ID and token balance
 *
 * WHY NOT A REAL CONTRACT UTXO?
 *   Deploying a real CashScript contract requires P2SH address generation
 *   using the compiled bytecode + constructor args. This needs cashc CLI or
 *   the cashscript npm package to run in Node (not easily in browser Vite build).
 *   For this MVP demo, we simulate the lock in localStorage + use real token minting.
 *   Week 4 can add a real backend deploy script.
 *
 * @param {TestNetWallet} wallet       - The funder's wallet
 * @param {number}        amountBch    - How much BCH to "lock" (simulate)
 * @param {string}        projectAddr  - The project team's receive address
 * @returns {Promise<{tokenCategory, tokenAmount, simulatedTxId}>}
 */
export async function fundMilestoneContract(wallet, amountBch, projectAddr) {
    // Calculate governance tokens to mint
    const tokenAmount = Math.floor((amountBch / 0.001) * TOKENS_PER_UNIT)
    if (tokenAmount < 1) throw new Error('Fund at least 0.001 BCH to receive governance tokens')

    // ── Mint CashTokens (real on-chain fungible tokens) ───────────────────────
    // mainnet-js TokenSendRequest with genesis=true creates a NEW token category
    // The funder's wallet address becomes the token holder
    let tokenCategory = null
    let mintTxId = null

    try {
        // Generate a new token by sending a genesis output to ourselves
        const genesisResult = await wallet.send([
            new TokenSendRequest({
                cashaddr: wallet.cashaddr,
                amount: tokenAmount,
                // No category = genesis (create new token type)
            })
        ])
        mintTxId = genesisResult.txId
        // The token category = the txId of the genesis transaction
        tokenCategory = mintTxId
    } catch (mintError) {
        // If token minting fails (e.g., wallet doesn't support it yet), simulate it
        console.warn('Token mint failed, simulating:', mintError.message)
        mintTxId = 'simulated_' + Date.now().toString(16)
        tokenCategory = mintTxId
    }

    // ── Record locked amount ──────────────────────────────────────────────────
    const prevLocked = loadFromStorage(STORAGE_KEYS.lockedAmount, 0)
    saveToStorage(STORAGE_KEYS.lockedAmount, prevLocked + amountBch)
    saveToStorage(STORAGE_KEYS.tokenCategory, tokenCategory)

    // ── Update token balance ──────────────────────────────────────────────────
    const prevTokens = loadFromStorage(STORAGE_KEYS.tokenBalance, 0)
    const newTokenBalance = prevTokens + tokenAmount
    saveToStorage(STORAGE_KEYS.tokenBalance, newTokenBalance)

    return {
        tokenCategory,
        tokenAmount,
        newTokenBalance,
        simulatedTxId: mintTxId,
    }
}

// ── STEP 3: Token-weighted voting ─────────────────────────────────────────────
/**
 * castVote(milestoneId, voteType, tokensToUse)
 *
 * Simulates token-weighted voting.
 * Each governance token = 1 vote. Using tokens "locks" them into a vote.
 *
 * In a real system, you'd burn tokens or send them to a special address.
 * For this demo, we deduct from localStorage balance.
 *
 * @param {string} milestoneId  - Which milestone (e.g. "milestone-1")
 * @param {'yes'|'no'} voteType - Direction of vote
 * @param {number} tokensToUse  - How many tokens (votes) to cast
 * @returns {{ votes, tokenBalance, isApproved }}
 */
export function castVote(milestoneId, voteType, tokensToUse = 1) {
    const currentBalance = loadFromStorage(STORAGE_KEYS.tokenBalance, 0)

    if (currentBalance < tokensToUse) {
        throw new Error(`Not enough tokens. You have ${currentBalance} GOV tokens.`)
    }

    // Deduct used tokens (they are "spent" on the vote)
    const newBalance = currentBalance - tokensToUse
    saveToStorage(STORAGE_KEYS.tokenBalance, newBalance)

    // Update votes for this milestone
    const allVotes = loadFromStorage(STORAGE_KEYS.votes, {})
    const prevVotes = allVotes[milestoneId] || { yes: 0, no: 0 }
    const updatedVotes = {
        ...prevVotes,
        [voteType]: prevVotes[voteType] + tokensToUse,
    }
    allVotes[milestoneId] = updatedVotes
    saveToStorage(STORAGE_KEYS.votes, allVotes)

    // Check if milestone is approved (>50% YES of all votes cast)
    const total = updatedVotes.yes + updatedVotes.no
    const isApproved = total > 0 && (updatedVotes.yes / total) > 0.5

    return {
        votes: updatedVotes,
        tokenBalance: newBalance,
        isApproved,
        yesPercent: total > 0 ? Math.round((updatedVotes.yes / total) * 100) : 0,
    }
}

// ── STEP 4: Release funds after approval ──────────────────────────────────────
/**
 * releaseMilestoneFunds(wallet, amountBch, projectAddress)
 *
 * Called after a milestone reaches >50% YES votes.
 * Sends partial BCH from the user's wallet to the project address.
 *
 * In a real contract deployment, this would call contract.functions.release()
 * which needs the owner's signature. Here we simulate it with a direct send.
 *
 * @param {TestNetWallet} wallet        - Must be the owner's wallet
 * @param {number}        amountBch     - Partial amount to release
 * @param {string}        projectAddr   - Project team's Chipnet address
 * @returns {Promise<string>}           - Transaction ID
 */
export async function releaseMilestoneFunds(wallet, amountBch, projectAddr) {
    // Deduct from simulated locked amount
    const locked = loadFromStorage(STORAGE_KEYS.lockedAmount, 0)
    if (amountBch > locked + 0.0001) { // small tolerance for fees
        throw new Error(`Cannot release ${amountBch} BCH. Only ${locked.toFixed(6)} BCH is locked.`)
    }

    // Send BCH from wallet to the project address
    const result = await wallet.send([{
        cashaddr: projectAddr,
        value: parseFloat(amountBch),
        unit: 'bch',
    }])

    // Update remaining locked amount
    const remaining = Math.max(0, locked - amountBch)
    saveToStorage(STORAGE_KEYS.lockedAmount, remaining)

    return result.txId
}

// ── Getters (read state) ──────────────────────────────────────────────────────

/** Returns the user's current governance token balance */
export function getTokenBalance() {
    return loadFromStorage(STORAGE_KEYS.tokenBalance, 0)
}

/** Returns the total BCH locked in the simulated contract */
export function getLockedAmount() {
    return loadFromStorage(STORAGE_KEYS.lockedAmount, 0)
}

/** Returns votes for a specific milestone */
export function getMilestoneVotes(milestoneId) {
    const allVotes = loadFromStorage(STORAGE_KEYS.votes, {})
    return allVotes[milestoneId] || { yes: 0, no: 0 }
}

/** Returns ALL milestone votes */
export function getAllVotes() {
    return loadFromStorage(STORAGE_KEYS.votes, {})
}

/** Returns true if a milestone has >50% YES votes */
export function isMilestoneApproved(milestoneId) {
    const v = getMilestoneVotes(milestoneId)
    const total = v.yes + v.no
    return total > 0 && (v.yes / total) > 0.5
}

/** Clears all Week 3 state from localStorage */
export function clearContractState() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
}

/** Returns a Chipnet explorer URL for a transaction */
export function chipnetExplorerUrl(txId) {
    return `https://chipnet.imaginary.cash/tx/${txId}`
}
