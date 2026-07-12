import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

/**
 * Safely creates an administrative Supabase client using the service role key.
 * If the service role key is not available (or during static evaluation), falls back to the provided user client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdminClient(fallbackClient?: any): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (url && serviceKey) {
    return createSupabaseJsClient(url, serviceKey);
  }
  return fallbackClient;
}
