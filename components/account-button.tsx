"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSyncConfigured, supabase } from "@/lib/supabase";

/**
 * Header account chip so sign-in is visible from the top of the dashboard
 * (the Cloud sync panel itself lives at the bottom of the page). Signed out it
 * reads "Sign in · Cloud sync" and smooth-scrolls to the panel, focusing the
 * email field; signed in it shows the account email with a sign-out button.
 */
export default function AccountButton() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isSyncConfigured || !supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!isSyncConfigured || !supabase) return null;
  const client = supabase;

  function goToSignIn() {
    const panel = document.getElementById("cloud-sync");
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus the email field once the scroll settles so the user can type right away.
    window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>('input[aria-label="Email for sign-in link"]')
        ?.focus();
    }, 600);
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="hidden max-w-[180px] truncate rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200 md:block"
          title={user.email ?? undefined}
        >
          {user.email}
        </span>
        <button
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
          onClick={() => void client.auth.signOut()}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/20"
      onClick={goToSignIn}
      type="button"
    >
      Sign in · Cloud sync
    </button>
  );
}
