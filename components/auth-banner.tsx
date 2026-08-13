"use client";

import { useEffect, useState } from "react";

type AuthMessage = {
  tone: "emerald" | "amber";
  title: string;
  body: string;
  ctaLabel?: string;
};

const MESSAGES: Record<string, AuthMessage> = {
  signedin: {
    tone: "emerald",
    title: "You're signed in",
    body: "Your progress now backs up to the cloud automatically — mastery, badges, and streaks sync across devices.",
  },
  confirmed: {
    tone: "amber",
    title: "Account confirmed",
    body: "That was your confirmation link. Enter your email once more to receive the sign-in link — then you're in.",
    ctaLabel: "Go to sign-in",
  },
};

const TONE_STYLES: Record<AuthMessage["tone"], string> = {
  emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
};

/**
 * One-time status banner shown after the magic-link callback redirects back to
 * the dashboard (/?auth=signedin|confirmed). The marker is stripped from the
 * URL on mount so a refresh doesn't re-show it.
 */
export default function AuthBanner() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth && MESSAGES[auth]) {
      setStatus(auth);
      params.delete("auth");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  if (!status) return null;
  const message = MESSAGES[status];

  function scrollToSignIn() {
    const panel = document.getElementById("cloud-sync");
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>('input[aria-label="Email for sign-in link"]')
        ?.focus();
    }, 600);
  }

  return (
    <div
      className={`mt-5 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${TONE_STYLES[message.tone]}`}
      role="status"
    >
      <div>
        <p className="text-sm font-black">{message.title}</p>
        <p className="mt-1 text-xs leading-5 opacity-80">{message.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {message.ctaLabel && (
          <button
            className="rounded-lg border border-current px-3 py-1.5 text-xs font-bold transition hover:opacity-70"
            onClick={scrollToSignIn}
            type="button"
          >
            {message.ctaLabel}
          </button>
        )}
        <button
          aria-label="Dismiss"
          className="text-xs font-bold opacity-70 transition hover:opacity-100"
          onClick={() => setStatus(null)}
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
