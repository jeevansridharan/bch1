// check-oracle-key.mjs  —  run with: node check-oracle-key.mjs
// Compares the pubkey derived from ORACLE_WIF against
// PLATFORM_ORACLE_PK_HEX hardcoded in ProjectsPage.jsx

import 'dotenv/config'
import * as libauth from '@bitauth/libauth'

const PLATFORM_ORACLE_PK_HEX = '02989c0b76cb563971fdc9bef31ec06c3560f3249d6ee9e5d83c57625596e05f6f'
const WIF = process.env.ORACLE_WIF

if (!WIF) {
  console.error('❌ ORACLE_WIF is not set in backend/.env')
  process.exit(1)
}

const wifResult = libauth.decodePrivateKeyWif(WIF)
if (typeof wifResult === 'string') {
  console.error('❌ WIF decode error:', wifResult)
  process.exit(1)
}

const secp = await libauth.instantiateSecp256k1()
const pubkeyBytes = secp.derivePublicKeyCompressed(wifResult.privateKey)
if (typeof pubkeyBytes === 'string') {
  console.error('❌ Public key derivation error:', pubkeyBytes)
  process.exit(1)
}

const derivedPubkeyHex = libauth.binToHex(pubkeyBytes)

console.log('')
console.log('════════════════════════════════════════════════════════')
console.log('  ORACLE PUBKEY COMPARISON')
console.log('════════════════════════════════════════════════════════')
console.log('  Derived from ORACLE_WIF       :', derivedPubkeyHex)
console.log('  Hardcoded PLATFORM_ORACLE_PK  :', PLATFORM_ORACLE_PK_HEX)
console.log('  MATCH?', derivedPubkeyHex === PLATFORM_ORACLE_PK_HEX ? '✅ YES — Keys are the same' : '❌ NO — MISMATCH! THIS IS THE ROOT CAUSE OF checkDataSig() FAILURE')
console.log('════════════════════════════════════════════════════════')

if (derivedPubkeyHex !== PLATFORM_ORACLE_PK_HEX) {
  console.log('')
  console.log('ROOT CAUSE:')
  console.log('  The contract was deployed with PLATFORM_ORACLE_PK_HEX as tallyOraclePk.')
  console.log('  The backend signs oracle proofs with the key from ORACLE_WIF.')
  console.log('  These two keys are DIFFERENT — checkDataSig() verifies using the')
  console.log('  embedded tallyOraclePk, but the signature was made with a different')
  console.log('  private key. The verification will ALWAYS fail.')
  console.log('')
  console.log('FIX OPTIONS:')
  console.log('  Option A (preferred): Update PLATFORM_ORACLE_PK_HEX in ProjectsPage.jsx')
  console.log('    to match the pubkey derived from ORACLE_WIF, then redeploy the contract.')
  console.log('    New PLATFORM_ORACLE_PK_HEX should be:', derivedPubkeyHex)
  console.log('')
  console.log('  Option B: Generate a new ORACLE_WIF that corresponds to the existing')
  console.log('    PLATFORM_ORACLE_PK_HEX key (requires the private key for that pubkey).')
  console.log('')
  console.log('NOTE: For existing funded contracts, you MUST use Option B or manually')
  console.log('  update the contracts table oracle_pubkey and redeploy at a new address.')
}
console.log('')
