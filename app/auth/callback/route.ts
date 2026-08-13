import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";

/**
 * Magic-link callback (Auth > URL Configuration > Redirect URLs must include
 * /auth/callback). The sign-in link carries a PKCE code; we exchange it
 * server-side so the session lands in cookies, then redirect home where the
 * sync panel's cookie-based browser client picks it up automatically.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/?auth=error`);
}
