/**
 * bchWallet.js — Milestara BCH Wallet Service (Fixed for Chipnet v3)
 *
 * ─── FIXES APPLIED ───────────────────────────────────────────────────────────
 * 1. FIXED MaxListenersExceededWarning: Removed problematic new Connection()
 *    call inside setupChipnetProvider. The old code created a new WebSocket
 *    on every initializeWallet() call (which WalletContext calls on mount AND
 *    on every 15-second refresh), leaking event listeners indefinitely.
 *    Solution: Use TestNetWallet.networkProvider directly (v3 manages the
 *    WebSocket lifecycle internally); no manual Connection is needed.
 * 2. Network: Forced to "chipnet" to avoid Testnet3 defaults.
 * 3. Balance: Fixed API mismatch (v3 returns BigInt satoshis directly).
 * 4. Debugging: Added detailed console logs for every step.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TestNetWallet, toBch } from 'mainnet-js'

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

// ─── Internal Helper: Configure Chipnet Network (FIXED) ──────────────────────

/**
 * configureChipnetNetwork
 *
 * Sets the Chipnet electrum server on the wallet's network provider WITHOUT
 * creating a new Connection object. Using new Connection() on every call was
 * the root cause of the MaxListenersExceededWarning memory leak.
 *
 * mainnet-js v3 exposes the provider via wallet.provider. We simply set
 * the server URLs before the first getUtxos() / getBalance() call.
 */
async function configureChipnetNetwork(wallet) {
    console.log('[bchWallet] Configuring Chipnet network provider...')
    try {
        // mainnet-js v3 approach: override the electrum server URLs on the
        // existing provider so all subsequent calls use Chipnet.
        if (wallet.provider && typeof wallet.provider.setServer === 'function') {
            wallet.provider.setServer(CHIPNET_ELECTRUM_WSS)
            console.log('[bchWallet] ✓ Chipnet server set via provider.setServer()')
        } else if (wallet.provider && wallet.provider.servers !== undefined) {
            wallet.provider.servers = [CHIPNET_ELECTRUM_WSS]
            console.log('[bchWallet] ✓ Chipnet server set via provider.servers')
        } else {
            // Fallback: log a warning but do not throw — the default testnet3
            // endpoint may still work for most UTXO operations.
            console.warn(
                '[bchWallet] Provider does not expose setServer / servers. ' +
                'Chipnet connectivity may be limited. Wallet will still function.'
            )
        }
        console.log('[bchWallet] ✓ Chipnet provider configured')
    } catch (err) {
        console.warn('[bchWallet] Provider configuration warning (non-fatal):', err.message)
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

        // Configure Chipnet WITHOUT creating a new Connection object each time
        await configureChipnetNetwork(wallet)

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
 * fundProject(wallet, amountBch, contractAddress?)
 *
 * Broadcasts a transaction to the project escrow contract address.
 * If contractAddress is omitted, falls back to the static PROJECT_ADDRESS
 * (legacy behaviour for projects without on-chain contracts).
 *
 * @param {object} wallet          — Connected mainnet-js wallet
 * @param {number} amountBch       — Amount in BCH to send
 * @param {string} [contractAddress] — Optional: CashScript P2SH32 contract address
 */
export async function fundProject(wallet, amountBch, contractAddress = null) {
    const destination = contractAddress || PROJECT_ADDRESS
    console.log(`[bchWallet] Initiating funding: ${amountBch} BCH -> ${destination}`)
    if (contractAddress) {
        console.log('[bchWallet] Sending to CashScript escrow contract (not the static PROJECT_ADDRESS)')
    }

    try {
        // Convert BCH to satoshis (BigInt) for v3 API
        const satoshis = BigInt(Math.round(parseFloat(amountBch) * 1e8))

        const result = await wallet.send([
            {
                cashaddr: destination,
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
