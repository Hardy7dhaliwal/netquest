import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client for cloud progress sync. Uses @supabase/ssr so the
 * session (and the PKCE code verifier) lives in cookies — that's what lets the
 * /auth/callback route complete a magic-link sign-in server-side and hand the
 * session back to this client. The client is only created once the public URL
 * and key are present in .env.local; until then the app runs fully offline and
 * the sync panel shows how to enable cloud sync.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSyncConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient | null = isSyncConfigured
  ? createBrowserClient(url!, publishableKey!)
  : null;
