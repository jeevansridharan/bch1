/**
 * production/scripts/deployContract.js
 *
 * ── WHAT THIS FILE DOES ──────────────────────────────────────────────────────
 * Deploys (instantiates) the MilestoneEscrow CashScript contract on Chipnet.
 *
 * CashScript P2SH32 contracts are NOT broadcast during "deployment" —
 * the contract address is deterministic from its constructor arguments.
 * This function computes and returns the real Chipnet P2SH32 address by
 * loading the pre-compiled MilestoneEscrow.json artifact and calling
 * `new Contract(artifact, args, { provider })`.
 *
 * ── HOW TO RECOMPILE THE ARTIFACT ────────────────────────────────────────────
 * If you change MilestoneEscrow.cash, regenerate the JSON artifact with:
 *   npx cashc production/contracts/MilestoneEscrow.cash \
 *     -o production/contracts/MilestoneEscrow.json
 * (requires: npm install -g @cashscript/cashc  OR  npx cashc)
 *
 * ── CONSTRUCTOR PARAMETERS ───────────────────────────────────────────────────
 * contract MilestoneEscrow(
 *   pubkey  creatorPk,      // compressed 33-byte pubkey of the project creator
 *   pubkey  funderPk,       // compressed 33-byte pubkey of the funder
 *   pubkey  tallyOraclePk,  // compressed 33-byte pubkey of the Tally Engine oracle
 *   bytes32 milestoneId,    // 32-byte unique identifier for this milestone
 *   int     deadline        // block height after which the funder can refund
 * )
 *
 * ── DEPENDENCIES ─────────────────────────────────────────────────────────────
 *   cashscript           → Contract, ElectrumNetworkProvider
 *   @cashscript/utils    → binToHex (for display only)
 */

import { Contract, ElectrumNetworkProvider } from 'cashscript';
import { binToHex, hexToBin, secp256k1 }      from '@bitauth/libauth';
import artifact                               from '../contracts/MilestoneEscrow.json' assert { type: 'json' };

// ── Oracle backend URL (same VITE_ var the frontend uses) ─────────────────────
// In a browser context import.meta.env is available; in Node scripts it is not.
// We fall back to localhost:3001 so the script works from both environments.
const ORACLE_BASE_URL =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ORACLE_URL) ||
    'http://localhost:3001';

// ── Chipnet block explorer base URL (for human-readable logs) ─────────────────
const CHIPNET_EXPLORER = 'https://chipnet.imaginary.cash/address';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * ensureUint8Array
 *
 * Normalises a pubkey / milestoneId that may arrive as either:
 *   • Uint8Array  → returned as-is
 *   • hex string  → decoded to Uint8Array (without 0x prefix)
 *
 * @param {Uint8Array|string} value
 * @param {string}            label  — shown in error messages
 * @returns {Uint8Array}
 */
function ensureUint8Array(value, label) {
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string') {
        const hex = value.startsWith('0x') ? value.slice(2) : value;
        if (hex.length % 2 !== 0) {
            throw new Error(`[deployContract] ${label}: odd-length hex string ("${hex.slice(0, 16)}…")`);
        }
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }
    throw new TypeError(`[deployContract] ${label}: expected Uint8Array or hex string, got ${typeof value}`);
}

/**
 * compressPubKeyIfNeeded
 *
 * Compress an uncompressed public key (65 bytes, starts with 0x04) to 33 bytes.
 * If already compressed (33 bytes, starts with 0x02 or 0x03), returns as-is.
 *
 * @param {Uint8Array} pk
 * @param {string}     label
 * @returns {Uint8Array} compressed 33-byte pubkey
 */
function compressPubKeyIfNeeded(pk, label) {
    if (pk.length === 33 && (pk[0] === 0x02 || pk[0] === 0x03)) {
        // Already compressed
        return pk;
    }
    if (pk.length === 65 && pk[0] === 0x04) {
        // Uncompressed — compress it
        const compressed = secp256k1.compressPublicKey(pk);
        console.log(`[deployContract] ${label}: compressed 65-byte pubkey to 33 bytes`);
        return compressed;
    }
    throw new Error(
        `[deployContract] ${label}: expected 33-byte compressed or 65-byte uncompressed pubkey, got ${pk.length} bytes (first: 0x${pk[0].toString(16).padStart(2, '0')})`
    );
}

/**
 * validateCompressedPubKey
 *
 * A compressed SEC public key is exactly 33 bytes and starts with 0x02 or 0x03.
 *
 * @param {Uint8Array} pk
 * @param {string}     label
 */
function validateCompressedPubKey(pk, label) {
    if (pk.length !== 33) {
        throw new RangeError(
            `[deployContract] ${label}: expected 33 bytes (compressed pubkey), got ${pk.length}`
        );
    }
    if (pk[0] !== 0x02 && pk[0] !== 0x03) {
        throw new Error(
            `[deployContract] ${label}: first byte must be 0x02 or 0x03 (compressed), got 0x${pk[0].toString(16).padStart(2, '0')}`
        );
    }
}

/**
 * validateMilestoneId
 *
 * milestoneId must be exactly 32 bytes (matches bytes32 in the contract).
 *
 * @param {Uint8Array} id
 */
function validateMilestoneId(id) {
    if (id.length !== 32) {
        throw new RangeError(
            `[deployContract] milestoneId: expected 32 bytes, got ${id.length}`
        );
    }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * deployMilestoneEscrow
 *
 * Instantiates the MilestoneEscrow CashScript contract using the bundled
 * MilestoneEscrow.json artifact and returns the deterministic P2SH32
 * contract address on Chipnet.
 *
 * @param {object} params
 * @param {Uint8Array|string} params.creatorPk      — 33-byte compressed pubkey (creator)
 * @param {Uint8Array|string} params.funderPk       — 33-byte compressed pubkey (funder)
 * @param {Uint8Array|string} params.oraclePk       — 33-byte compressed pubkey (tally oracle)
 * @param {Uint8Array|string} params.milestoneId    — 32-byte unique milestone ID (e.g. SHA-256 hash)
 * @param {number|bigint}    params.deadlineHeight  — block height after which funder may refund
 *
 * @returns {Promise<{
 *   address:      string,   // Chipnet P2SH32 cashaddr (prefix: "bchtest:")
 *   tokenAddress: string,   // Same address with CashToken prefix for token-aware wallets
 *   contract:     Contract, // The live Contract instance (use for .getBalance(), .unlock.*)
 *   milestoneIdHex: string, // milestoneId as hex (useful for Supabase storage)
 * }>}
 *
 * @throws {RangeError|TypeError|Error} if any argument fails validation
 */
export async function deployMilestoneEscrow(params) {
    const {
        creatorPk,
        funderPk,
        oraclePk,          // used as fallback if backend unreachable
        milestoneId,
        deadlineHeight,
    } = params;

    // ── STEP 2: Fetch live oracle pubkey from the backend ─────────────────────
    // This ensures the contract is always baked with the key the backend is
    // currently signing with, eliminating the pubkey-mismatch root cause.
    let fetchedOraclePubkeyHex = null
    try {
        const resp = await fetch(`${ORACLE_BASE_URL}/api/oracle/pubkey`)
        if (resp.ok) {
            const json = await resp.json()
            fetchedOraclePubkeyHex = json.oraclePubkey
            console.log('[deployContract] ✓ Oracle pubkey fetched from backend:', fetchedOraclePubkeyHex)
        } else {
            console.warn('[deployContract] ⚠ /api/oracle/pubkey returned', resp.status, '- using passed oraclePk')
        }
    } catch (fetchErr) {
        console.warn('[deployContract] ⚠ Could not reach Oracle backend:', fetchErr.message, '- using passed oraclePk')
    }

    // Resolve final oracle pubkey bytes:
    //   1st choice: freshly fetched hex from backend
    //   2nd choice: caller-supplied oraclePk (Uint8Array or hex)
    let resolvedOraclePk
    if (fetchedOraclePubkeyHex) {
        resolvedOraclePk = hexToBin(fetchedOraclePubkeyHex)
    } else if (oraclePk) {
        resolvedOraclePk = ensureUint8Array(oraclePk, 'oraclePk (fallback)')
    } else {
        throw new Error('[deployContract] oraclePk is required (backend unreachable and no fallback provided)')
    }

    // ── Step 1: Normalise inputs to Uint8Array ─────────────────────────────────
    const creatorPkBytes   = ensureUint8Array(creatorPk,   'creatorPk');
    const funderPkBytes    = ensureUint8Array(funderPk,    'funderPk');
    const oraclePkBytes    = resolvedOraclePk;  // already Uint8Array from above
    const milestoneIdBytes = ensureUint8Array(milestoneId, 'milestoneId');

    // ── Step 2: Compress pubkeys if uncompressed (65 bytes) ────────────────────
    const creatorPkCompressed = compressPubKeyIfNeeded(creatorPkBytes, 'creatorPk');
    const funderPkCompressed  = compressPubKeyIfNeeded(funderPkBytes,  'funderPk');
    const oraclePkCompressed  = compressPubKeyIfNeeded(oraclePkBytes,  'oraclePk');

    // ── Step 3: Validate all byte lengths and pubkey prefixes ─────────────────
    validateCompressedPubKey(creatorPkCompressed, 'creatorPk');
    validateCompressedPubKey(funderPkCompressed,  'funderPk');
    validateCompressedPubKey(oraclePkCompressed,  'oraclePk');
    validateMilestoneId(milestoneIdBytes);

    // deadline must be a non-negative integer
    const deadlineBigInt = BigInt(deadlineHeight);
    if (deadlineBigInt < 0n) {
        throw new RangeError(`[deployContract] deadlineHeight must be ≥ 0, got ${deadlineHeight}`);
    }

    // ── Step 3: Connect to Chipnet via Electrum ───────────────────────────────
    //
    // ElectrumNetworkProvider('chipnet') points to the BCH Chipnet testnet.
    // No network call is made here; the provider is used lazily when
    // getBalance() / getUtxos() / send() are called later.
    //
    const provider = new ElectrumNetworkProvider('chipnet');

    // ── Step 4: Instantiate the Contract ─────────────────────────────────────
    //
    // CashScript maps constructor parameter types as follows:
    //   pubkey  → Uint8Array (33-byte compressed)
    //   bytes32 → Uint8Array (32 bytes)
    //   int     → bigint
    //
    // The order MUST match the contract definition in MilestoneEscrow.cash:
    //   contract MilestoneEscrow(
    //     pubkey  creatorPk,
    //     pubkey  funderPk,
    //     pubkey  tallyOraclePk,
    //     bytes32 milestoneId,
    //     int     deadline
    //   )
    //
    const contract = new Contract(
        artifact,
        [
            creatorPkCompressed, // pubkey  → Uint8Array
            funderPkCompressed,  // pubkey  → Uint8Array
            oraclePkCompressed,  // pubkey  → Uint8Array  (tallyOraclePk)
            milestoneIdBytes,    // bytes32 → Uint8Array
            deadlineBigInt,      // int     → bigint
        ],
        { provider }
    );

    // ── Step 5: Extract the real on-chain addresses ───────────────────────────
    //
    // contract.address      → P2SH32 cashaddr with "bchtest:" prefix (Chipnet)
    // contract.tokenAddress → same address, CashToken-aware prefix
    //
    const { address, tokenAddress } = contract;

    // ── Step 6: Helpful diagnostics ───────────────────────────────────────────
    const milestoneIdHex = binToHex(milestoneIdBytes);
    const creatorPkHex   = binToHex(creatorPkBytes);
    const oraclePkHex    = binToHex(oraclePkBytes);

    console.group('[MilestoneEscrow] ✅ Contract instantiated on Chipnet');
    console.log('  Address      :', address);
    console.log('  Token Address:', tokenAddress);
    console.log('  Explorer     :', `${CHIPNET_EXPLORER}/${address}`);
    console.log('  Bytecode size:', contract.bytesize, 'bytes /', contract.opcount, 'opcodes');
    console.log('  Params ──────────────────────────────────────');
    console.log('  creatorPk   :', binToHex(creatorPkCompressed));
    console.log('  funderPk    :', binToHex(funderPkCompressed));
    console.log('  oraclePk    :', binToHex(oraclePkCompressed));
    console.log('  milestoneId :', milestoneIdHex);
    console.log('  deadline    :', deadlineBigInt.toString(), 'blocks');
    console.groupEnd();

    // ── Step 7: Return everything the caller needs ────────────────────────────────
    return {
        address,           // real Chipnet P2SH32 cashaddr — store in DB as contract_address
        tokenAddress,      // CashToken-aware variant
        contract,          // live Contract instance — use for .getBalance(), .getUtxos()
        milestoneIdHex,    // hex string of milestoneId — store in DB / description
        oraclePubkeyHex:   binToHex(oraclePkCompressed),  // the pubkey baked into this contract
    };
}
