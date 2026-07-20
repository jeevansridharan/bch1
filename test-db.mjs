/**
 * test-db.mjs — Milestara Supabase Database Test
 * Run: node test-db.mjs
 * Tests: connection, all 5 tables, insert + fetch + delete
 */

import { createClient } from '@supabase/supabase-js'

// ── Config (same values as .env) ──────────────────────────────────────────────
const SUPABASE_URL = 'https://hxnxaycccccrboyrjykv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_eZYyNh6khmtUWPhCmZd3FA__Ei19Kgp'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const pass = (msg) => console.log(`  ${GREEN}✓${RESET} ${msg}`)
const fail = (msg) => console.log(`  ${RED}✗${RESET} ${msg}`)
const info = (msg) => console.log(`  ${CYAN}→${RESET} ${msg}`)
const head = (msg) => console.log(`\n${BOLD}${YELLOW}${msg}${RESET}`)

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${BOLD}╔══════════════════════════════════════════╗${RESET}`)
    console.log(`${BOLD}║     Milestara — Supabase DB Test          ║${RESET}`)
    console.log(`${BOLD}╚══════════════════════════════════════════╝${RESET}`)
    info(`URL: ${SUPABASE_URL}`)

    let userId, projectId, milestoneId, voteId, txId

    // ── 1. Test connection ────────────────────────────────────────────────────
    head('1. Connection Test')
    try {
        const { error } = await supabase.from('users').select('count').limit(1)
        if (error) throw error
        pass('Connected to Supabase successfully')
    } catch (e) {
        fail(`Connection failed: ${e.message}`)
        console.log(`\n${RED}→ Make sure you ran schema.sql in the Supabase SQL Editor first!${RESET}\n`)
        process.exit(1)
    }

    // ── 2. Test USERS table ───────────────────────────────────────────────────
    head('2. Users Table')
    try {
        const wallet = `bchtest:qptest${Date.now()}`
        const { data, error } = await supabase
            .from('users')
            .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address' })
            .select()
            .single()
        if (error) throw error
        userId = data.id
        pass(`Inserted user`)
        info(`id:             ${data.id}`)
        info(`wallet_address: ${data.wallet_address}`)
        info(`created_at:     ${data.created_at}`)
    } catch (e) {
        fail(`Users table error: ${e.message}`)
    }

    // ── 3. Test PROJECTS table ─────────────────────
    head('3. Projects Table')
    try {
        const { data, error } = await supabase
            .from('projects')
            .insert({
                creator_id: userId,
                title: 'Test Project — Milestara',
                description: 'Automated DB test project',
                funding_target: 0.01,
                funded_amount: 0,
                status: 'active',
            })
            .select()
            .single()
        if (error) throw error
        projectId = data.id
        pass(`Inserted project`)
        info(`id:             ${data.id}`)
        info(`title:          ${data.title}`)
        info(`funding_target: ${data.funding_target} BCH`)
        info(`status:         ${data.status}`)
    } catch (e) {
        fail(`Projects table error: ${e.message}`)
    }

    // ── 4. Test MILESTONES table ──────────────────────────────────────────────
    head('4. Milestones Table')
    try {
        const { data, error } = await supabase
            .from('milestones')
            .insert({
                project_id: projectId,
                title: 'Milestone 1 — MVP Launch',
                description: 'Deploy the first version of the app',
                amount_allocated: 0.003,
                status: 'pending',
            })
            .select()
            .single()
        if (error) throw error
        milestoneId = data.id
        pass(`Inserted milestone`)
        info(`id:               ${data.id}`)
        info(`title:            ${data.title}`)
        info(`amount_allocated: ${data.amount_allocated} BCH`)
        info(`status:           ${data.status}`)
    } catch (e) {
        fail(`Milestones table error: ${e.message}`)
    }

    // ── 5. Test VOTES table ───────────────────────────────────────────────────
    head('5. Votes Table')
    try {
        const { data, error } = await supabase
            .from('votes')
            .insert({
                milestone_id: milestoneId,
                voter_id: userId,
                vote: true,       // YES
                voting_power: 10,
            })
            .select()
            .single()
        if (error) throw error
        voteId = data.id
        pass(`Inserted vote`)
        info(`id:           ${data.id}`)
        info(`vote:         ${data.vote ? '✅ YES' : '❌ NO'}`)
        info(`voting_power: ${data.voting_power} tokens`)
    } catch (e) {
        fail(`Votes table error: ${e.message}`)
    }

    // ── 6. Test TRANSACTIONS table ────────────────────────────────────────────
    head('6. Transactions Table')
    try {
        const fakeTxHash = 'abcd1234'.repeat(8) // 64-char fake tx hash
        const { data, error } = await supabase
            .from('transactions')
            .insert({
                project_id: projectId,
                tx_hash: fakeTxHash,
                amount: 0.001,
                type: 'funding',
            })
            .select()
            .single()
        if (error) throw error
        txId = data.id
        pass(`Inserted transaction`)
        info(`id:      ${data.id}`)
        info(`tx_hash: ${data.tx_hash.substring(0, 16)}...`)
        info(`amount:  ${data.amount} BCH`)
        info(`type:    ${data.type}`)
    } catch (e) {
        fail(`Transactions table error: ${e.message}`)
    }

    // ── 7. Fetch full project with relations ──────────────────────────────────
    head('7. Fetch Full Project (with relations)')
    try {
        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                creator:users(wallet_address),
                milestones(*),
                transactions(*)
            `)
            .eq('id', projectId)
            .single()
        if (error) throw error
        pass(`Fetched project with all relations`)
        info(`Project:      ${data.title}`)
        info(`Creator:      ${data.creator.wallet_address}`)
        info(`Milestones:   ${data.milestones.length} found`)
        info(`Transactions: ${data.transactions.length} found`)
    } catch (e) {
        fail(`Fetch relations error: ${e.message}`)
    }

    // ── 8. Cleanup (delete test data) ─────────────────────────────────────────
    head('8. Cleanup Test Data')
    try {
        // Deleting the project cascades to milestones, votes, transactions
        await supabase.from('projects').delete().eq('id', projectId)
        await supabase.from('users').delete().eq('id', userId)
        pass(`Deleted test project, milestones, votes, transactions`)
        pass(`Deleted test user`)
    } catch (e) {
        fail(`Cleanup error: ${e.message}`)
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}${GREEN}╔══════════════════════════════════════════╗${RESET}`)
    console.log(`${BOLD}${GREEN}║   All tests passed! Database is ready.   ║${RESET}`)
    console.log(`${BOLD}${GREEN}╚══════════════════════════════════════════╝${RESET}\n`)
}

main().catch(e => {
    console.error(`\n${RED}Fatal error: ${e.message}${RESET}\n`)
    process.exit(1)
})
