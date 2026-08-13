"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useProgressStore, type SyncStatus } from "@/lib/progress-store";
import { isSyncConfigured, supabase } from "@/lib/supabase";
import { buildSnapshot, mergeProgress, syncWithTransport } from "@/lib/sync";
import { fetchRemoteProgress, pushRemoteProgress } from "@/lib/sync-supabase";

const STATUS_STYLES: Record<SyncStatus, string> = {
  idle: "border-slate-700 text-slate-400",
  syncing: "border-cyan-300/40 text-cyan-200 animate-pulse",
  synced: "border-emerald-300/40 text-emerald-300",
  error: "border-rose-300/40 text-rose-300",
};

const STATUS_LABELS: Record<SyncStatus, string> = {
  idle: "Not synced yet",
  syncing: "Syncing…",
  synced: "In sync",
  error: "Sync issue",
};

/** Cloud progress sync: magic-link sign-in, manual + debounced auto-sync. */
export default function SyncPanel() {
  const xp = useProgressStore((s) => s.xp);
  const streak = useProgressStore((s) => s.streak);
  const completedMissions = useProgressStore((s) => s.completedMissions);
  const badges = useProgressStore((s) => s.badges);
  const mastery = useProgressStore((s) => s.mastery);
  const quizResults = useProgressStore((s) => s.quizResults);
  const cardReviews = useProgressStore((s) => s.cardReviews);
  const daily = useProgressStore((s) => s.daily);
  const bossRecords = useProgressStore((s) => s.bossRecords);
  const lastSyncedAt = useProgressStore((s) => s.lastSyncedAt);
  const syncStatus = useProgressStore((s) => s.syncStatus);
  const syncMessage = useProgressStore((s) => s.syncMessage);
  const applyRemote = useProgressStore((s) => s.applyRemote);
  const setSyncStatus = useProgressStore((s) => s.setSyncStatus);

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Track the Supabase session.
  useEffect(() => {
    if (!isSyncConfigured || !supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLinkSent(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Surface a failed magic-link exchange (the callback redirects to /?auth=error).
  useEffect(() => {
    if (window.location.search.includes("auth=error")) {
      setSignInError("That sign-in link didn't work — it may have expired or already been used. Request a new one below.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!user || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSyncStatus("syncing", "Syncing your progress…");
    try {
      const local = buildSnapshot(useProgressStore.getState());
      const merged = await syncWithTransport(local, {
        fetchRemote: fetchRemoteProgress,
        pushRemote: pushRemoteProgress,
      });
      applyRemote(merged);
    } catch (error) {
      setSyncStatus("error", error instanceof Error ? error.message : "Sync failed");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [user, applyRemote, setSyncStatus]);

  const pullLatest = useCallback(async () => {
    if (!user || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSyncStatus("syncing", "Pulling latest progress…");
    try {
      const remote = await fetchRemoteProgress();
      if (remote) {
        const local = buildSnapshot(useProgressStore.getState());
        applyRemote(mergeProgress(local, remote));
      } else {
        setSyncStatus("synced", "Nothing in the cloud yet — hit Sync now to back up.");
      }
    } catch (error) {
      setSyncStatus("error", error instanceof Error ? error.message : "Pull failed");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [user, applyRemote, setSyncStatus]);

  // Debounced auto-sync whenever progress changes while signed in — this is
  // what makes a browser wipe recoverable. Every persisted field is in the key
  // (a forgotten-card review or a re-quiz changes no XP but must still sync);
  // lastSyncedAt is excluded so a converged sync can't retrigger itself.
  const progressKey = JSON.stringify({ xp, streak, completedMissions, badges, mastery, quizResults, cardReviews, daily, bossRecords });
  useEffect(() => {
    if (!user || !isSyncConfigured) return;
    const id = window.setTimeout(() => {
      if (!busyRef.current) void runSync();
    }, 4000);
    return () => window.clearTimeout(id);
  }, [progressKey, user, runSync]);

  function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || busy) return;
    void (async () => {
      setBusy(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setBusy(false);
      if (error) {
        setSyncStatus("error", error.message);
        return;
      }
      setLinkSent(true);
    })();
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!isSyncConfigured) {
    return (
      <section id="cloud-sync" className="mt-6 scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Cloud sync</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Cross-device progress is <span className="font-bold text-slate-200">off</span>. Add{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">.env.local</code> and restart the dev server to
              back up mastery, badges, and streaks — and pick them up on any other device.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="cloud-sync" className="mt-6 scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Cloud sync</p>
          <p className="mt-1 text-sm text-slate-400">
            {user ? (
              <>
                Signed in as <span className="font-bold text-slate-200">{user.email}</span>
              </>
            ) : (
              "Back up your progress and continue on any device."
            )}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[syncStatus]}`}>
          {STATUS_LABELS[syncStatus]}
        </span>
      </div>

      {syncMessage && syncStatus !== "syncing" && (
        <p className={`mt-3 text-xs ${syncStatus === "error" ? "text-rose-300" : "text-slate-500"}`}>{syncMessage}</p>
      )}

      <div className="mt-5">
        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              {lastSyncedAt
                ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — mastery, badges, and streaks merge automatically.`
                : "Never synced — your progress is only on this device so far."}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                disabled={busy}
                onClick={() => void pullLatest()}
                type="button"
              >
                Pull latest
              </button>
              <button
                className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                disabled={busy}
                onClick={() => void runSync()}
                type="button"
              >
                {busy ? "Syncing…" : "Sync now"}
              </button>
              <button
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                onClick={() => void signOut()}
                type="button"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : linkSent ? (
          <p className="text-sm text-slate-300">
            Check <span className="font-bold text-cyan-200">{email.trim()}</span> and click the sign-in link we just sent.{" "}
            <button className="font-bold text-cyan-300 underline underline-offset-2 hover:text-cyan-200" onClick={() => setLinkSent(false)} type="button">
              Use a different email
            </button>
          </p>
        ) : (
          <>
            {signInError && <p className="mb-3 text-xs text-rose-300">{signInError}</p>}
            <form className="flex max-w-md items-center gap-2" onSubmit={sendMagicLink}>
            <input
              aria-label="Email for sign-in link"
              autoComplete="email"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/70"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <button
              className="shrink-0 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
              disabled={busy || !email.trim()}
              type="submit"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
