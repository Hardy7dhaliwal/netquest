import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server Supabase client used by the /auth/callback route to exchange the
 * magic-link PKCE code. It reads the same cookies the browser client writes,
 * so the resulting session is shared with the client on redirect. Only used
 * from route handlers, where cookie writes are applied to the response; the
 * catch below covers the Server Component case, where writes are forbidden.
 */
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes from a Server Component are not allowed — harmless
          // here since this helper only runs inside route handlers.
        }
      },
    },
  });
};
