/**
 * gen-oracle-mainnetjs.mjs
 *
 * Generates a fresh Oracle keypair using mainnet-js.
 * Also prints the compressed public key so you can update ProjectsPage.jsx.
 *
 * Usage (from project root):
 *   node gen-oracle-mainnetjs.mjs
 */

import { TestNetWallet } from 'mainnet-js';

async function run() {
    const wallet = await TestNetWallet.newRandom();

    // mainnet-js wallet.publicKey is a Uint8Array — convert to hex
    const pubKeyHex = Buffer.from(wallet.publicKey).toString('hex');

    console.log('\n=== Oracle Keypair ===');
    console.log('WIF (put in backend/.env as ORACLE_WIF):');
    console.log(wallet.privateKeyWif);
    console.log('\nPubKey (put in src/pages/ProjectsPage.jsx as PLATFORM_ORACLE_PK_HEX):');
    console.log(pubKeyHex);
    console.log('=====================\n');
}

run().catch(e => { console.error(e); process.exit(1); });
