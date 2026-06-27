/**
 * scripts/fix-oracle-pubkey.mjs
 *
 * One-time migration: update every row in the Supabase `contracts` table
 * so that `oracle_pubkey` reflects the current backend signing key.
 *
 * ⚠ WARNING: Updating oracle_pubkey in the DB does NOT change the on-chain
 * contract. The P2SH address is derived from the original constructor args
 * (including the original oracle pubkey). If the oracle pubkey changed,
 * the contract address is now DIFFERENT and old UTXOs are unreachable.
 *
 * This script is most useful when:
 *   - No BCH has been locked in existing contracts yet (common on testnet)
 *   - You want to ensure new releases use the correct signing key
 *   - You plan to delete old projects and create fresh ones afterwards
 *
 * Usage:
 *   node scripts/fix-oracle-pubkey.mjs
 *
 * Requirements:
 *   - Backend must be running on http://localhost:3001 (npm start in /backend)
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in backend/.env
 *     OR in a .env file at the project root (loaded via dotenv below)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ── Config ─────────────────────────────────────────────────────────────────────
const ORACLE_URL    = process.env.VITE_ORACLE_URL || 'http://localhost:3001'
const SUPABASE_URL  = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

// ── Validate env ───────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
        '\n[fix-oracle-pubkey] ✗ Missing Supabase credentials.\n' +
        '  Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in backend/.env\n' +
        '  OR VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env\n'
    )
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
})

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n=== fix-oracle-pubkey.mjs ===')
    console.log(`Oracle backend: ${ORACLE_URL}`)
    console.log(`Supabase URL  : ${SUPABASE_URL}\n`)

    // 1. Fetch current oracle pubkey from backend
    let currentOraclePubkey
    try {
        const resp = await fetch(`${ORACLE_URL}/api/oracle/pubkey`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        currentOraclePubkey = json.oraclePubkey
        console.log('✓ Current oracle pubkey:', currentOraclePubkey)
    } catch (err) {
        console.error(
            '✗ Could not reach backend at', ORACLE_URL, '\n',
            '  Make sure the backend is running: cd backend && npm start\n',
            '  Error:', err.message
        )
        process.exit(1)
    }

    // 2. Read all rows from contracts table
    const { data: rows, error: fetchErr } = await supabase
        .from('contracts')
        .select('id, project_id, oracle_pubkey, contract_address')

    if (fetchErr) {
        console.error('✗ Failed to read contracts table:', fetchErr.message)
        process.exit(1)
    }

    if (!rows || rows.length === 0) {
        console.log('ℹ No rows found in contracts table — nothing to update.')
        return
    }

    console.log(`\nFound ${rows.length} contract row(s):\n`)

    let updatedCount = 0
    let skippedCount = 0

    for (const row of rows) {
        const alreadyMatches =
            row.oracle_pubkey?.toLowerCase() === currentOraclePubkey.toLowerCase()

        if (alreadyMatches) {
            console.log(`  [SKIP] project_id=${row.project_id} — oracle_pubkey already matches`)
            skippedCount++
            continue
        }

        console.log(`  [UPDATE] project_id=${row.project_id}`)
        console.log(`    Old pubkey : ${row.oracle_pubkey}`)
        console.log(`    New pubkey : ${currentOraclePubkey}`)

        // ⚠ Warn about contract address mismatch
        console.log(
            `    ⚠ WARNING: Contract address ${row.contract_address} was derived\n` +
            `      using the OLD oracle pubkey. It will be DIFFERENT with the new\n` +
            `      key. Any BCH locked at the old address is unreachable unless\n` +
            `      the original oracle WIF is restored. For testnet/Chipnet:\n` +
            `      → Delete this project and create a fresh one after updating.`
        )

        // Update the row
        const { error: updateErr } = await supabase
            .from('contracts')
            .update({ oracle_pubkey: currentOraclePubkey })
            .eq('id', row.id)

        if (updateErr) {
            console.error(`    ✗ Update failed for id=${row.id}:`, updateErr.message)
        } else {
            console.log(`    ✓ Updated successfully`)
            updatedCount++
        }
    }

    console.log(
        `\n=== Summary ===\n` +
        `  Updated : ${updatedCount}\n` +
        `  Skipped : ${skippedCount}\n` +
        `  Total   : ${rows.length}\n`
    )

    if (updatedCount > 0) {
        console.log(
            '⚠ oracle_pubkey updated in DB. IMPORTANT:\n' +
            '  The on-chain P2SH contract addresses have NOT changed.\n' +
            '  Existing UTXOs at old contract addresses are ONLY accessible\n' +
            '  with the original oracle WIF. For Chipnet (testnet) development:\n' +
            '  delete old projects and create new ones to test the full flow.\n'
        )
    }
}

main().catch(err => {
    console.error('\n✗ Unexpected error:', err)
    process.exit(1)
})
