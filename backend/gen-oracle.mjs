/**
 * gen-oracle.mjs
 *
 * Generates a fresh Oracle keypair for the Milestara backend.
 * Uses @bitauth/libauth v3 API correctly.
 *
 * Usage:
 *   cd backend
 *   node gen-oracle.mjs
 *
 * Then copy the output into backend/.env
 */

import * as libauth from '@bitauth/libauth';
import crypto from 'crypto';

async function run() {
    // 1. Instantiate crypto primitives
    const secp256k1 = await libauth.instantiateSecp256k1();

    // 2. Generate a random 32-byte private key
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);

    // 3. Derive compressed public key
    const pubKeyBytes = secp256k1.derivePublicKeyCompressed(privateKey);
    if (typeof pubKeyBytes === 'string') {
        throw new Error('Public key derivation failed: ' + pubKeyBytes);
    }
    const pubKeyHex = libauth.binToHex(pubKeyBytes);

    // 4. Encode private key as WIF (testnet = starts with 'c')
    //    libauth v3: encodePrivateKeyWif(privateKey, 'testnet')
    const wif = libauth.encodePrivateKeyWif(privateKey, 'testnet');
    if (typeof wif !== 'string') {
        throw new Error('WIF encoding failed');
    }

    console.log('\n=== Oracle Keypair ===');
    console.log('WIF (put in backend/.env as ORACLE_WIF):');
    console.log(wif);
    console.log('\nPubKey (put in src/pages/ProjectsPage.jsx as PLATFORM_ORACLE_PK_HEX):');
    console.log(pubKeyHex);
    console.log('=====================\n');
}

run().catch(e => { console.error(e); process.exit(1); });
