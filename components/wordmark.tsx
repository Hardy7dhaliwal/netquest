"use client";

/**
 * Clickable NetQuest wordmark shown in every header. Clicking it returns to
 * the dashboard from any mission, quiz, or review view — the standard
 * logo-takes-you-home affordance.
 */
export function Wordmark({ onHome, track }: { onHome: () => void; track?: string }) {
  return (
    <button
      aria-label="Back to dashboard"
      className="text-left text-sm font-black uppercase tracking-[0.25em] text-cyan-300 transition hover:text-cyan-100"
      onClick={onHome}
      title="Back to dashboard"
      type="button"
    >
      NetQuest{track ? ` · ${track}` : ""}
    </button>
  );
}
