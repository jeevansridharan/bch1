import { Connection } from 'mainnet-js';
import * as libauth from '@bitauth/libauth';
import { generateVotingAddresses } from '../scripts/generateVotingAddresses.js';

/**
 * TallyEngine Service
 *
 * Responsibilities:
 * 1. Scan UTXOs at per-project voting addresses (Approve/Reject).
 * 2. Calculate token-weighted results for a specific project.
 * 3. Sign "Proof of Approval" for the MilestoneEscrow contract.
 *
 * ── Design ───────────────────────────────────────────────────────────────────
 * Each project has its OWN pair of voting addresses generated deterministically
 * from the project UUID. This isolates votes so Project A approval tokens
 * cannot be counted towards Project B.
 *
 * Addresses are derived via:
 *   APPROVE key = SHA256(SHA256("milestara:vote:approve:v1:" + projectId))
 *   REJECT  key = SHA256(SHA256("milestara:vote:reject:v1:"  + projectId))
 *   Address = P2PKH(SECP256K1_COMPRESSED_PUBKEY(key))
 *
 * Nobody holds the private keys — tokens sent there are permanently vote-locked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * getVotingAddresses(projectId)
 *
 * Returns the real Chipnet P2PKH addresses for this project's YES / NO votes.
 * These are deterministic — calling this twice with the same projectId always
 * gives the same pair of addresses.
 *
 * @param {string} projectId  — Supabase UUID for the project
 * @returns {{ approveAddr: string, rejectAddr: string }}
 */
export async function getVotingAddresses(projectId) {
    return generateVotingAddresses(projectId);
}

/**
 * tallyVotes(projectId, tokenCategoryId)
 *
 * Scans the Chipnet blockchain for token UTXOs at this project's voting
 * addresses and returns a weighted tally.
 *
 * @param {string} projectId        — Supabase UUID
 * @param {string} tokenCategoryId  — The GOV token category hex string
 */
export async function tallyVotes(projectId, tokenCategoryId) {
    if (!projectId) throw new Error('[TallyEngine] projectId is required');

    // 1. Derive the correct voting addresses for this project
    const { approveAddr, rejectAddr } = await getVotingAddresses(projectId);
    console.log(`[TallyEngine] Scanning votes for project: ${projectId}`);
    console.log(`  APPROVE addr: ${approveAddr}`);
    console.log(`  REJECT  addr: ${rejectAddr}`);

    // 2. Connect to Chipnet
    const conn = new Connection('testnet', 'wss://chipnet.imaginary.cash:50004');

    // 3. Fetch UTXOs
    const [approveUtxos, rejectUtxos] = await Promise.all([
        conn.networkProvider.getUtxos(approveAddr).catch(() => []),
        conn.networkProvider.getUtxos(rejectAddr).catch(() => []),
    ]);

    // 4. Sum matching token amounts (filter by category so GOV tokens from
    //    other projects don't contaminate this tally)
    const sumTokens = (utxos) => utxos.reduce((sum, u) => {
        if (u.token && u.token.category === tokenCategoryId) {
            return sum + BigInt(u.token.amount);
        }
        return sum;
    }, 0n);

    const yesVotes = sumTokens(approveUtxos);
    const noVotes = sumTokens(rejectUtxos);
    const totalVotes = yesVotes + noVotes;

    const approvalRate = totalVotes > 0n
        ? Number(yesVotes) / Number(totalVotes)
        : 0;

    // 5. Quorum: at least 1,000,000 tokens must have voted
    const QUORUM = 1_000_000n;

    const result = {
        projectId,
        yesVotes: yesVotes.toString(),
        noVotes: noVotes.toString(),
        totalVotes: totalVotes.toString(),
        percentage: (approvalRate * 100).toFixed(2),
        isApproved: approvalRate >= 0.60 && totalVotes >= QUORUM,
        approveAddr,
        rejectAddr,
    };

    console.log('[TallyEngine] Tally result:', result);
    return result;
}

/**
 * generateApprovalSignature(milestoneId, oracleWif)
 *
 * Creates the Data Signature proof that the MilestoneEscrow smart contract
 * requires to release funds.
 *
 * Proof format: SHA256(milestoneId_hex + "01")
 * The contract verifies checkDataSig(oracleSig, oraclePk, proofHash).
 *
 * @param {string} milestoneId  — 32-byte hex string (no 0x prefix)
 * @param {string} oracleWif    — WIF-encoded private key of the tally oracle
 */
export async function generateApprovalSignature(milestoneId, oracleWif) {
    // 1. Build the proof message: milestoneId_bytes || 0x01
    // CashScript checkDataSig verifies: sig covers sha256(message)
    let idHex = milestoneId.replace('0x', '');
    if (idHex.length < 64) idHex = idHex.padEnd(64, '0'); // Pad to bytes32

    const messageHex = idHex + '01';
    const messageBytes = libauth.hexToBin(messageHex);

    // sha256 hash the message — checkDataSig in CashScript uses sha256(msg) as the sighash
    const sha256 = await libauth.instantiateSha256();
    const messageHash = sha256.hash(messageBytes);

    // 2. Decode oracle WIF → private key bytes (libauth 3.x API)
    const wifResult = libauth.decodePrivateKeyWif(oracleWif);
    if (typeof wifResult === 'string') {
        throw new Error(`Oracle WIF decode failed: ${wifResult}`);
    }
    const privateKey = wifResult.privateKey;

    // 3. Sign with Schnorr (BCH datasig format used by checkDataSig opcode)
    // In libauth 3.x, signDataSigHash was removed; use secp256k1 directly.
    const secp256k1 = await libauth.instantiateSecp256k1();
    const signature = secp256k1.signMessageHashSchnorr(privateKey, messageHash);

    return {
        proofHex: messageHex,
        signatureHex: libauth.binToHex(signature),
    };
}
