/**
 * bchWallet.js — Milestara BCH Wallet Service
 *
 * Uses mainnet-js (which wraps @bitauth/libauth internally).
 * All transactions go to Chipnet (BCH testnet).
 *
 * Flow:
 *  1. createOrLoadWallet()  → makes / restores a Chipnet wallet
 *  2. getBalance(wallet)    → reads live BCH balance via Electrum
 *  3. fundProject(wallet, amount) → broadcasts a real Chipnet tx
 */

import { TestNetWallet } from 'mainnet-js'

// ─── Config ────────────────────────────────────────────────────────────────

/**
 * The predefined Chipnet project wallet that will RECEIVE funds.
 * Replace this with your own generated Chipnet address.
 * You can get one by calling createOrLoadWallet() once and logging wallet.cashaddr.
 *
 * Generate a fresh one at: https://chipnet.imaginary.cash/
 */
export const PROJECT_ADDRESS =
    'bchtest:qzs8qgaupu6m6gqnrm3n3zt0p8slhgn4sy2smwwvy2'

// localStorage key for persisting the user's private key across page refreshes
const WALLET_STORAGE_KEY = 'milestara_chipnet_wif'

// ─── Wallet creation ────────────────────────────────────────────────────────

/**
 * createOrLoadWallet()
 *
 * Checks localStorage for a saved WIF (Wallet Import Format) private key.
 * - If found  → restores the same wallet so the user keeps their address.
 * - If not    → generates a brand-new random Chipnet wallet and saves the WIF.
 *
 * This is safe for a testnet demo. In production you'd use a proper keystore.
 *
 * @returns {Promise<TestNetWallet>} A ready-to-use mainnet-js wallet object
 */
export async function createOrLoadWallet() {
    const savedWif = localStorage.getItem(WALLET_STORAGE_KEY)

    let wallet
    if (savedWif) {
        // Restore existing wallet from saved private key
        wallet = await TestNetWallet.fromWIF(savedWif)
    } else {
        // Generate a new random wallet
        wallet = await TestNetWallet.newRandom()
        // Persist the private key so the user keeps the same address
        localStorage.setItem(WALLET_STORAGE_KEY, wallet.privateKeyWif)
    }

    return wallet
}

// ─── Balance ────────────────────────────────────────────────────────────────

/**
 * getBalance(wallet)
 *
 * Queries the Chipnet Electrum network for the wallet's current BCH balance.
 *
 * @param {TestNetWallet} wallet
 * @returns {Promise<number>} Balance in BCH (e.g. 0.005)
 */
export async function getBalance(wallet) {
    const { bch } = await wallet.getBalance()
    return bch ?? 0
}

// ─── Send funds ─────────────────────────────────────────────────────────────

/**
 * fundProject(wallet, amountBch)
 *
 * Builds, signs, and broadcasts a Chipnet transaction that sends
 * `amountBch` BCH from the user's wallet to PROJECT_ADDRESS.
 *
 * mainnet-js handles:
 *   - UTXO fetching
 *   - Transaction construction (via libauth)
 *   - Change output calculation
 *   - Fee estimation
 *   - Broadcasting to Chipnet Electrum nodes
 *
 * @param {TestNetWallet} wallet        The funded user wallet
 * @param {number|string} amountBch    Amount to send, e.g. "0.01"
 * @returns {Promise<string>}          Transaction ID (txid) on success
 * @throws  Will throw if insufficient funds or network error
 */
export async function fundProject(wallet, amountBch) {
    const result = await wallet.send([
        {
            cashaddr: PROJECT_ADDRESS,
            value: parseFloat(amountBch),
            unit: 'bch',
        },
    ])
    // result.txId is the broadcast transaction hash on Chipnet
    return result.txId
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

/**
 * disconnectWallet()
 *
 * Removes the saved WIF from localStorage.
 * The next createOrLoadWallet() call will generate a fresh wallet.
 */
export function disconnectWallet() {
    localStorage.removeItem(WALLET_STORAGE_KEY)
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * getChipnetExplorerUrl(txId)
 *
 * Returns the Chipnet block explorer URL for a given transaction ID.
 * Use this to show the user a clickable link after a successful send.
 */
export function getChipnetExplorerUrl(txId) {
    return `https://chipnet.imaginary.cash/tx/${txId}`
}

/**
 * shortenAddress(address)
 *
 * Shortens a cashaddr for display: "bchtest:qzs8...wvy2"
 */
export function shortenAddress(address) {
    if (!address) return ''
    const prefix = address.includes(':') ? address.split(':')[0] + ':' : ''
    const raw = address.includes(':') ? address.split(':')[1] : address
    return `${prefix}${raw.slice(0, 6)}...${raw.slice(-4)}`
}
