/**
 * src/lib/db/contracts.js
 *
 * Supabase operations for the `contracts` table.
 *
 * Schema (run the snippet in schema.sql to create this table):
 *   id               UUID   PRIMARY KEY DEFAULT gen_random_uuid()
 *   project_id       UUID   NOT NULL REFERENCES projects(id) ON DELETE CASCADE
 *   contract_address TEXT   NOT NULL
 *   creator_pubkey   TEXT   NOT NULL   -- hex-encoded 33-byte compressed pubkey
 *   funder_pubkey    TEXT   NOT NULL   -- hex-encoded 33-byte compressed pubkey
 *   oracle_pubkey    TEXT   NOT NULL   -- hex-encoded 33-byte compressed pubkey
 *   milestone_id_hex TEXT   NOT NULL   -- hex-encoded 32-byte milestone ID
 *   deadline         BIGINT NOT NULL   -- block height
 *   created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
 */

import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveContractMetadata
 *
 * Upserts a contract row for a project. Uses project_id as the conflict key so
 * re-deploying the same project simply overwrites the old row.
 *
 * @param {object} params
 * @param {string} params.projectId        — Supabase UUID of the parent project
 * @param {string} params.contractAddress  — P2SH32 cashaddr (bchtest:…)
 * @param {string} params.creatorPubkey    — hex 33-byte compressed pubkey
 * @param {string} params.funderPubkey     — hex 33-byte compressed pubkey
 * @param {string} params.oraclePubkey     — hex 33-byte compressed pubkey
 * @param {string} params.milestoneIdHex   — hex 32-byte milestone ID
 * @param {number} params.deadline         — block height integer
 * @returns {Promise<object>}              — the inserted/updated row
 */
export async function saveContractMetadata({
    projectId,
    contractAddress,
    creatorPubkey,
    funderPubkey,
    oraclePubkey,
    milestoneIdHex,
    deadline,
}) {
    if (!projectId)        throw new Error('saveContractMetadata: projectId is required')
    if (!contractAddress)  throw new Error('saveContractMetadata: contractAddress is required')
    if (!creatorPubkey)    throw new Error('saveContractMetadata: creatorPubkey is required')
    if (!oraclePubkey)     throw new Error('saveContractMetadata: oraclePubkey is required')
    if (!milestoneIdHex)   throw new Error('saveContractMetadata: milestoneIdHex is required')

    const { data, error } = await supabase
        .from('contracts')
        .upsert(
            {
                project_id:       projectId,
                contract_address: contractAddress,
                creator_pubkey:   creatorPubkey,
                funder_pubkey:    funderPubkey,
                oracle_pubkey:    oraclePubkey,
                milestone_id_hex: milestoneIdHex,
                deadline:         deadline,
            },
            { onConflict: 'project_id' }   // one row per project; re-deploy overwrites
        )
        .select()
        .single()

    if (error) {
        console.error('[db/contracts] saveContractMetadata error:', error)
        throw new Error(error.message)
    }

    return data
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * loadContractMetadata
 *
 * Fetches the contract row for a given project.
 * Returns null if no row exists (project was created before on-chain metadata
 * was introduced, or deployment failed).
 *
 * @param {string} projectId  — Supabase UUID of the project
 * @returns {Promise<object|null>}
 */
export async function loadContractMetadata(projectId) {
    if (!projectId) throw new Error('loadContractMetadata: projectId is required')

    const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()   // returns null (not an error) when no row found

    if (error) {
        // 42P01 = relation does not exist (table not created yet)
        // PGRST116 = no rows matched — shouldn't happen with maybeSingle but guard anyway
        // In both cases treat as "no metadata" so the fallback can auto-register.
        if (error.code === '42P01' || error.code === 'PGRST116' || error.details?.includes('0 rows')) {
            console.warn('[db/contracts] contracts table missing or empty — returning null:', error.message)
            return null
        }
        console.error('[db/contracts] loadContractMetadata error:', error)
        throw new Error(error.message)
    }

    return data  // null when no contract row has been saved yet
}

