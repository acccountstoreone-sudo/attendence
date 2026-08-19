import { SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SupabaseAuthClient {
    getUser(): Promise<any>;
    getSession(): Promise<any>;
    signInWithPassword(credentials: any): Promise<any>;
    signOut(): Promise<any>;
    updateUser(attributes: any): Promise<any>;
    admin: any;
  }
}
