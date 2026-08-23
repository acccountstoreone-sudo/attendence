import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client configured for the browser (public anon key).
 * Used in Client Components only.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  ) as any;
}

