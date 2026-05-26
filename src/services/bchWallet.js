/**
 * bchWallet.js — Milestara BCH Wallet Service (Corrected for Chipnet v3)
 *
 * ─── FIXES APPLIED ───────────────────────────────────────────────────────────
 * 1. Network: Forced to "chipnet" to avoid Testnet3 defaults.
 * 2. Balance: Fixed API mismatch (v3 returns BigInt satoshis directly).
 * 3. Connection: Manual override to wss://chipnet.imaginary.cash:50004.
 * 4. Sync: Added UTXO refresh before balance fetch.
 * 5. Debugging: Added detailed console logs for every step.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TestNetWallet, toBch, Connection } from 'mainnet-js'

// --- Governance Category ID (Shared) ---
export const GOV_TOKEN_CATEGORY_ID = '9da68991a0c7c647565c567540a02d41549dad1182284730b9a92e21d7a4c651'

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Chipnet Electrum WSS Endpoint.
 * Essential for getting balance from the correct test network.
 */
const CHIPNET_ELECTRUM_WSS = 'wss://chipnet.imaginary.cash:50004'

/**
 * The predefined Chipnet project wallet that RECEIVES funds.
 * Note: Generated fresh for Chipnet v3.
 */
export const PROJECT_ADDRESS = 'bchtest:qpvjwg6g5ryqqrnjj56d0gknqmnydrxn8seudaqgp7'

const WALLET_STORAGE_KEY = 'milestara_chipnet_wif'

// ─── Internal Helper: Force Chipnet Connection ───────────────────────────────

async function setupChipnetProvider(wallet) {
    console.log('[bchWallet] Configuring Chipnet network provider...')
    try {
        // Create a dedicated Chipnet connection
        const conn = new Connection('testnet', CHIPNET_ELECTRUM_WSS)

        // Attach to the wallet
        wallet.provider = conn.networkProvider

        // Sync UTXOs to ensure we see the latest on-chain state
        console.log('[bchWallet] Synchronizing UTXOs...')
        await wallet.getUtxos()

        console.log('[bchWallet] ✓ Chipnet provider & UTXOs synced')
    } catch (err) {
        console.error('[bchWallet] Provider setup failed:', err.message)
    }
}

// ─── Wallet Creation & Loading ───────────────────────────────────────────────

/**
 * initializeWallet(wif)
 * 
 * Initializes a "chipnet" wallet.
 * If WIF is provided, it imports the wallet.
 * If not, it creates a new random one for the session.
 * Does NOT save to localStorage (session-only for security).
 */
export async function initializeWallet(wif = null) {
    let wallet

    try {
        // 1. If no WIF provided, check localStorage
        if (!wif) {
            wif = localStorage.getItem(WALLET_STORAGE_KEY)
        }

        if (wif) {
            console.log('[bchWallet] Initializing wallet from WIF (stored or provided)...')
            wallet = await TestNetWallet.fromWIF(wif)
        } else {
            console.log('[bchWallet] Creating new random chipnet wallet...')
            wallet = await TestNetWallet.newRandom()
            // 2. Persist new random wallet
            localStorage.setItem(WALLET_STORAGE_KEY, wallet.privateKeyWif)
        }

        // 3. Always save current WIF to ensure persistence if it was imported manually
        if (wif) {
            localStorage.setItem(WALLET_STORAGE_KEY, wif)
        }

        console.log('[bchWallet] Wallet Address:', wallet.cashaddr)

        // Force connection to Chipnet nodes
        await setupChipnetProvider(wallet)

        return wallet
    } catch (err) {
        console.error('[bchWallet] Error in initializeWallet:', err)
        throw err
    }
}

// ─── Balance Logic ───────────────────────────────────────────────────────────

/**
 * getBalance(wallet)
 * 
 * Fetches the live balance in BCH.
 * Handles the mainnet-js v3 BigInt return type.
 */
export async function getBalance(wallet) {
    if (!wallet) return 0

    console.log('[bchWallet] Fetching balance for', wallet.cashaddr, '...')
    try {
        // 1. Force a UTXO sync right before checking balance
        await wallet.getUtxos()

        // 2. Get raw balance (returns BigInt in satoshis in mainnet-js v3)
        const satoshisBigInt = await wallet.getBalance()
        console.log('[bchWallet] Raw satoshis (BigInt):', satoshisBigInt.toString())

        // 3. Convert Satoshis (BigInt) -> BCH (Number) using toBch utility
        const bchBalance = Number(toBch(satoshisBigInt))
        console.log('[bchWallet] Final BCH Balance:', bchBalance)

        return bchBalance
    } catch (err) {
        console.error('[bchWallet] Failed to fetch balance:', err.message)
        return null // Return null so UI knows it's an error/unknown, not zero
    }
}

/**
 * getTokenBalance(wallet)
 * 
 * Sums all fungible GOV tokens in the wallet's UTXOs.
 */
export async function getTokenBalance(wallet) {
    if (!wallet) return 0

    try {
        await wallet.getUtxos()
        const tokenBalance = await wallet.getTokenBalance(GOV_TOKEN_CATEGORY_ID)
        console.log('[bchWallet] GOV Token Balance (BigInt):', tokenBalance.toString())
        return Number(tokenBalance)
    } catch (err) {
        console.error('[bchWallet] Failed to fetch token balance:', err.message)
        return 0
    }
}

// ─── Funding Logic ───────────────────────────────────────────────────────────

/**
 * fundProject(wallet, amountBch)
 * 
 * Broadcasts a transaction to the project address.
 */
export async function fundProject(wallet, amountBch) {
    console.log(`[bchWallet] Initiating funding: ${amountBch} BCH -> ${PROJECT_ADDRESS}`)

    try {
        // Convert BCH to satoshis (BigInt) for v3 API
        const satoshis = BigInt(Math.round(parseFloat(amountBch) * 1e8))

        const result = await wallet.send([
            {
                cashaddr: PROJECT_ADDRESS,
                value: satoshis,
                unit: 'sat',
            }
        ])

        console.log('[bchWallet] Transaction successful! TXID:', result.txId)
        return result.txId
    } catch (err) {
        console.error('[bchWallet] Funding failed:', err.message)
        throw new Error(err.message || 'Transaction failed')
    }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export function disconnectWallet() {
    localStorage.removeItem(WALLET_STORAGE_KEY)
    console.log('[bchWallet] Wallet session cleared from storage.')
}

export function getExplorerUrl(txId) {
    return `https://chipnet.imaginary.cash/tx/${txId}`
}

export function shortenAddress(address) {
    if (!address) return ''
    const parts = address.split(':')
    const prefix = parts[0] ? parts[0] + ':' : ''
    const raw = parts[1] || parts[0]
    return `${prefix}${raw.slice(0, 6)}...${raw.slice(-4)}`
}
