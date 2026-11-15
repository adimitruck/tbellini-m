import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export { createSupabaseRepositories } from './supabase-repositories';
export { SupabaseAuth } from './supabase-auth';

/** Browser client for a configured project; the composition root supplies the validated URL and key. */
export function createArchiveClient(url: string, publishableKey: string): SupabaseClient {
  return createBrowserClient(url, publishableKey);
}
