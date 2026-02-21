/**
 * src/lib/db/transactions.js
 *
 * All Supabase operations for the `transactions` table.
 *
 * This table is the on-chain ↔ off-chain bridge:
 * Every Chipnet transaction that matters gets recorded here.
 *
 * Schema (run in Supabase SQL Editor):
 *   CREATE TABLE transactions (
 *     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 *     tx_hash    TEXT NOT NULL,
 *     amount     NUMERIC(18, 8) NOT NULL,
 *     type       TEXT NOT NULL CHECK (type IN ('funding', 'release', 'refund')),
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
 *   ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read"   ON transactions FOR SELECT USING (true);
 *   CREATE POLICY "Anyone insert" ON transactions FOR INSERT WITH CHECK (true);
 */

import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────

/**
 * insertTransaction({ projectId, txHash, amount, type })
 *
 * Records a BCH on-chain transaction in the Supabase database.
 * Call this AFTER a successful wallet.send() on Chipnet.
 *
 * @param {object} params
 * @param {string} params.projectId  UUID of the project
 * @param {string} params.txHash     Chipnet transaction ID (64-char hex)
 * @param {number} params.amount     BCH amount (e.g. 0.001)
 * @param {'funding'|'release'|'refund'} params.type  Type of transaction
 * @returns {Promise<Transaction>}
 */
export async function insertTransaction({ projectId, txHash, amount, type }) {
    if (!projectId) throw new Error('projectId is required')
    if (!txHash) throw new Error('txHash is required')
    if (!amount || amount <= 0) throw new Error('amount must be > 0')

    const validTypes = ['funding', 'release', 'refund']
    if (!validTypes.includes(type)) {
        throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`)
    }

    const { data, error } = await supabase
        .from('transactions')
        .insert({
            project_id: projectId,
            tx_hash: txHash,
            amount,
            type,
        })
        .select()
        .single()

    if (error) {
        console.error('[db/transactions] insertTransaction error:', error)
        throw new Error(error.message)
    }

    return data
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchTransactionsByProject(projectId)
 *
 * Returns all transactions for a project, newest first.
 * Used to display the funding history panel.
 *
 * @param   {string} projectId
 * @returns {Promise<Transaction[]>}
 */
export async function fetchTransactionsByProject(projectId) {
    if (!projectId) throw new Error('projectId is required')

    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[db/transactions] fetchTransactionsByProject error:', error)
        throw new Error(error.message)
    }

    return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * getProjectFundingTotal(projectId)
 *
 * Returns the SUM of all 'funding' type transactions for a project.
 * Use this as the source of truth for how much BCH has been received on-chain.
 *
 * @param   {string} projectId
 * @returns {Promise<number>}   Total BCH funded (e.g. 0.025)
 */
export async function getProjectFundingTotal(projectId) {
    if (!projectId) throw new Error('projectId is required')

    const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('project_id', projectId)
        .eq('type', 'funding')

    if (error) {
        console.error('[db/transactions] getProjectFundingTotal error:', error)
        throw new Error(error.message)
    }

    const total = (data ?? []).reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
    return parseFloat(total.toFixed(8))
}
