"use client";

import { CommandReference } from "@/components/command-reference";

export type PhaseReviewContent = {
  label: string;
  title: string;
  prompt: string;
  output?: string | null;
  /** The player's selected answer for choice phases (e.g. "The adjacency is failing"). */
  answer?: string | null;
  /** The command reference for CLI phases. */
  commands?: { command: string; description: string; mode?: string }[];
};

/**
 * The "Mission progress" sidebar list. Completed phases (index < phaseIndex)
 * become clickable buttons that open the read-only phase review, so a player
 * deep in a mission can re-read an earlier step (evidence, prompts, answers).
 */
export function MissionProgress({
  phases,
  labels,
  phaseIndex,
  onReview,
}: {
  phases: readonly string[];
  labels: string[];
  phaseIndex: number;
  onReview: (phase: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Mission progress</p>
        <span className="text-xs text-slate-500">{phaseIndex}/{phases.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {phases.map((phase, index) => {
          const done = index < phaseIndex;
          if (done) {
            return (
              <button
                className="group flex w-full items-start gap-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                key={phase}
                onClick={() => onReview(phase)}
                title={`Review: ${labels[index]}`}
                type="button"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-300 text-[10px] text-slate-950">✓</span>
                <span className="text-slate-200 transition group-hover:text-cyan-200">{labels[index]}</span>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-cyan-300/50 transition group-hover:text-cyan-200">↺ view</span>
              </button>
            );
          }
          return (
            <div className="flex items-start gap-3 text-sm" key={phase}>
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[10px] text-transparent">✓</span>
              <span className="text-slate-500">{labels[index]}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Read-only review of a past phase, opened from the progress list. Shows the
 * phase prompt, any evidence output, the player's answer (choice phases), and
 * the command reference (CLI phases) — without letting them alter progress.
 */
export function PhaseReviewModal({
  phase,
  content,
  onClose,
}: {
  phase: string | null;
  content: PhaseReviewContent | null;
  onClose: () => void;
}) {
  if (!phase || !content) return null;

  return (
    <div
      aria-label={`Phase review: ${content.label}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-900 p-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Phase review · {content.label}</p>
          <button
            aria-label="Close phase review"
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ✕ Close
          </button>
        </div>
        <h3 className="mt-3 text-2xl font-black tracking-tight">{content.title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">{content.prompt}</p>

        {content.output && (
          <pre className="mt-5 overflow-x-auto whitespace-pre rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs leading-5 text-slate-300">{content.output}</pre>
        )}

        {content.answer && (
          <div className="mt-5 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Your answer</p>
            <p className="mt-1.5 text-sm font-bold text-emerald-100">{content.answer}</p>
          </div>
        )}

        {content.commands && (
          <div className="mt-5">
            <CommandReference commands={content.commands} title="Commands for this phase" />
          </div>
        )}

        <button
          className="mt-6 w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
          onClick={onClose}
          type="button"
        >
          Back to current phase
        </button>
      </div>
    </div>
  );
}
