/**
 * src/lib/supabase.js
 *
 * Supabase client — single shared instance for the entire app.
 *
 * ── WHY ONE INSTANCE? ────────────────────────────────────────────────────────
 * Supabase maintains a connection pool internally. Creating multiple clients
 * wastes connections and can cause auth state drift. Always import THIS file,
 * never call createClient() anywhere else.
 *
 * ── ENV VARIABLES ────────────────────────────────────────────────────────────
 * Vite exposes only variables prefixed with VITE_ to the browser bundle.
 * Your .env file must have:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGc...
 *
 * ── SECURITY NOTE ────────────────────────────────────────────────────────────
 * The anon key is SAFE to expose in the browser — it is a public key.
 * All actual row-level security is enforced by Supabase's RLS policies.
 * Never put your service_role key in the frontend.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Warn in development if env vars are missing — but don't crash the app.
// Pages that need Supabase will show their own "not configured" UI.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)

if (!supabaseConfigured) {
    console.warn(
        '[Milestara] Supabase env vars not set.\n' +
        'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
        'See .env.example for reference.\n' +
        'The app will run in offline/demo mode until configured.'
    )
}

export const supabase = supabaseConfigured
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
            // Persist sessions in localStorage between page refreshes
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
        db: {
            // Default schema — change only if you use a custom Postgres schema
            schema: 'public',
        },
        global: {
            headers: {
                'x-app-name': 'milestara',
            },
        },
    })
    : null

export default supabase
