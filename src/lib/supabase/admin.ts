import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client using the service role key.
 * ONLY use in Server Actions / Route Handlers — never expose to the client.
 * The service role bypasses Row Level Security.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
