/**
 * src/lib/db/users.js
 *
 * All Supabase operations for the `users` table.
 *
 * In Milestara, a "user" is identified by their BCH wallet address.
 * No email/password — the wallet IS the identity (Web3 pattern).
 *
 * Schema (run in Supabase SQL Editor):
 *   CREATE TABLE users (
 *     id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     wallet_address TEXT UNIQUE NOT NULL,
 *     created_at     TIMESTAMPTZ DEFAULT now()
 *   );
 *   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read" ON users FOR SELECT USING (true);
 *   CREATE POLICY "Insert own" ON users FOR INSERT WITH CHECK (true);
 */

import { supabase } from '../supabase'

function requireSupabase() {
    if (!supabase) throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * upsertUser(walletAddress)
 *
 * Creates a new user row if the wallet address doesn't exist yet,
 * or returns the existing user if it does (idempotent).
 *
 * This is called every time a wallet connects — safe to call repeatedly.
 *
 * @param   {string} walletAddress  BCH cashaddr (e.g. "bchtest:qp...")
 * @returns {Promise<{ data: User, error: Error|null }>}
 */
export async function upsertUser(walletAddress) {
    if (!walletAddress) throw new Error('walletAddress is required')
    requireSupabase()

    const { data, error } = await supabase
        .from('users')
        .upsert(
            { wallet_address: walletAddress },
            {
                onConflict: 'wallet_address',  // if already exists → return existing
                ignoreDuplicates: false,
            }
        )
        .select()
        .single()

    if (error) {
        console.error('[db/users] upsertUser error:', error)
        throw new Error(error.message)
    }

    return data  // { id, wallet_address, created_at }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * getUserByWallet(walletAddress)
 *
 * Fetch a user by their BCH wallet address.
 * Returns null if the user doesn't exist yet.
 *
 * @param   {string} walletAddress
 * @returns {Promise<User|null>}
 */
export async function getUserByWallet(walletAddress) {
    if (!walletAddress) throw new Error('walletAddress is required')
    requireSupabase()

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle()   // returns null instead of error if not found

    if (error) {
        console.error('[db/users] getUserByWallet error:', error)
        throw new Error(error.message)
    }

    return data  // User object or null
}
