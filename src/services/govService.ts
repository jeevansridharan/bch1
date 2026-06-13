/**
 * govService.ts — Milestara On-Chain Governance Service
 *
 * Handles CashTokens lifecycle on Bitcoin Cash Chipnet:
 * 1. Minting GOV tokens upon funding
 * 2. Transferring GOV tokens between wallets
 * 3. Voting by sending tokens to per-project script addresses
 * 4. Tallying votes by scanning UTXOs at project-specific addresses
 *
 * ── Voting Address Design ────────────────────────────────────────────────────
 * Previously, the code used hardcoded placeholder addresses like bchtest:pz...
 * These were invalid and shared across all projects.
 *
 * New design:
 *   • Each project gets its OWN Approve/Reject P2PKH addresses.
 *   • Addresses are derived deterministically from the project UUID.
 *   • They are generated on project creation, stored in Supabase (description
 *     field as fallback, or a dedicated column when schema is updated).
 *   • The scanVotes() function accepts these addresses as parameters so the
 *     tally is always project-isolated.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ElectrumNetworkProvider } from 'cashscript';
// No top-level mainnet-js imports to avoid side-effects

// --- Constants ---

// The Unique ID for the Milestara Governance Token (Chipnet)
// Replace with your actual category ID after the genesis/mint transaction.
export const GOV_TOKEN_CATEGORY_ID = '9da68991a0c7c647565c567540a02d41549dad1182284730b9a92e21d7a4c651';

// Chipnet Electrum endpoint
const CHIPNET_WSS = 'wss://chipnet.imaginary.cash:50004';

// Minting Ratio: 1 BCH = 100,000 GOV tokens
const MINTING_RATIO = 100000;
const DUST_LIMIT = 1000n; // Satoshis to carry tokens

/**
 * Interface for Vote Tally
 */
export interface VoteStats {
    yesVotes: number;
    noVotes: number;
    totalVotes: number;
    approvalPercentage: number;
    approveAddr?: string;
    rejectAddr?: string;
}

// --- Service Functions ---

/**
 * getProjectVotingAddresses(projectId)
 *
 * Returns the Approve/Reject P2PKH addresses for a specific project.
 * These are deterministic — always the same for the same project UUID.
 *
 * @param {string} projectId  — Supabase UUID
 */
export async function getProjectVotingAddresses(projectId: string): Promise<{ approveAddr: string; rejectAddr: string }> {
    const { generateVotingAddresses } = await import('../../production/scripts/generateVotingAddresses');
    return generateVotingAddresses(projectId);
}

/**
 * mintGovTokens
 *
 * Mints GOV tokens to a funder based on their BCH contribution.
 * NOTE: Requires a 'Minter Wallet' with the minting baton UTXO.
 */
export async function mintGovTokens(recipientAddress: string, bchAmount: number, minterWif: string) {
    console.log(`[govService] Minting tokens for ${recipientAddress} (Amount: ${bchAmount} BCH)`);

    try {
        const { TestNetWallet } = await import('mainnet-js');
        const minterWallet = await TestNetWallet.fromWIF(minterWif);
        const tokenAmount = BigInt(Math.floor(bchAmount * MINTING_RATIO));

        const result = await minterWallet.tokenMint(
            GOV_TOKEN_CATEGORY_ID,
            [
                {
                    cashaddr: recipientAddress,
                    value: DUST_LIMIT,
                    token: {
                        amount: tokenAmount,
                        capability: 'none',
                    }
                } as any
            ]
        );

        console.log(`[govService] ✓ Minted ${tokenAmount} GOV tokens. TXID: ${result.txId}`);
        return result;
    } catch (err: any) {
        console.error('[govService] Minting failed:', err.message);
        throw err;
    }
}

/**
 * transferGovTokens
 *
 * Transfers fungible GOV tokens from the active wallet to another address.
 */
export async function transferGovTokens(wallet: any, toAddress: string, amount: number) {
    console.log(`[govService] Transferring ${amount} GOV to ${toAddress}`);

    if (!wallet) throw new Error('Wallet not connected');

    try {
        const result = await wallet.send([
            {
                cashaddr: toAddress,
                value: DUST_LIMIT,
                token: {
                    amount: BigInt(amount),
                    category: GOV_TOKEN_CATEGORY_ID,
                }
            }
        ]);

        console.log(`[govService] ✓ Transfer successful. TXID: ${result.txId}`);
        return result;
    } catch (err: any) {
        console.error('[govService] Transfer failed:', err.message);
        throw err;
    }
}

/**
 * scanVotes(projectId)
 *
 * Scans the blockchain UTXOs for the project's specific voting addresses.
 * Each project has its own addresses so votes are always isolated.
 *
 * Uses cashscript's ElectrumNetworkProvider which correctly handles newly-
 * derived addresses that have zero UTXOs (unlike mainnet-js Connection).
 *
 * @param {string} projectId — Supabase UUID. Required for project isolation.
 */
export async function scanVotes(projectId?: string): Promise<VoteStats> {
    console.log(`[govService] Scanning blockchain for votes (project: ${projectId ?? 'none'})...`);

    if (!projectId) {
        console.warn('[govService] No projectId provided to scanVotes. Returning zero tally.');
        return { yesVotes: 0, noVotes: 0, totalVotes: 0, approvalPercentage: 0 };
    }

    try {
        // 1. Get this project's unique voting addresses
        // NOTE: Call directly — do NOT re-import './govService' (circular import bug)
        const { approveAddr, rejectAddr } = await getProjectVotingAddresses(projectId);

        // 2. Use cashscript ElectrumNetworkProvider — handles empty addresses correctly
        const { ElectrumNetworkProvider } = await import('cashscript');
        const provider = new ElectrumNetworkProvider('chipnet');

        // 3. Fetch UTXOs — each address gets its own try/catch so one failure
        //    doesn't silence the other.
        const safeGetUtxos = async (addr: string): Promise<any[]> => {
            try {
                return await provider.getUtxos(addr);
            } catch {
                return [];
            }
        };

        let yesUtxos: any[] = [];
        let noUtxos: any[] = [];
        try {
            [yesUtxos, noUtxos] = await Promise.all([
                safeGetUtxos(approveAddr),
                safeGetUtxos(rejectAddr),
            ]);
        } finally {
            // Always disconnect — prevents MaxListenersExceededWarning from
            // the persistent WebSocket accumulating on every Dashboard refresh.
            try { await provider.disconnect(); } catch { /* ignore */ }
        }

        // 4. Sum only the GOV tokens (filter by category)
        const sumTokens = (utxos: any[]) => (utxos ?? []).reduce((acc: number, utxo: any) => {
            if (utxo?.token && utxo.token.category === GOV_TOKEN_CATEGORY_ID) {
                return acc + Number(utxo.token.amount);
            }
            return acc;
        }, 0);

        const yesVotes = sumTokens(yesUtxos);
        const noVotes = sumTokens(noUtxos);
        const totalVotes = yesVotes + noVotes;
        const approvalPercentage = totalVotes > 0
            ? (yesVotes / totalVotes) * 100
            : 0;

        console.log(`[govService] Tally for ${projectId} → YES: ${yesVotes} | NO: ${noVotes}`);

        return { yesVotes, noVotes, totalVotes, approvalPercentage, approveAddr, rejectAddr };
    } catch (err: any) {
        console.error('[govService] Vote scan failed:', err.message);
        return { yesVotes: 0, noVotes: 0, totalVotes: 0, approvalPercentage: 0 };
    }
}

