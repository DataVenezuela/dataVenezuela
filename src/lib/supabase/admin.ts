import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * Use ONLY in trusted server code (route handlers, server actions) for:
 *  - public reads of aportes/sources (controlled columns)
 *  - scraper API intake authenticated by API key
 *  - privileged writes after the caller's role has been checked in code
 *
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
