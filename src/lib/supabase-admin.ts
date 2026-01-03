import { createClient } from '@supabase/supabase-js';

// Server-side only admin client (Service Role)
export function getAdminSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Try to find the service role key
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supa_service_role;

    if (!url || !key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing. Cannot perform Admin actions.");
    }

    // Auth is NOT required for service role, it bypasses RLS
    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

/**
 * Helper to get or create a valid Test User ID for development
 */
// [DEPRECATED] Test User logic removed.
// Use getAuthenticatedUser() from '@/lib/supabase-server' instead.
