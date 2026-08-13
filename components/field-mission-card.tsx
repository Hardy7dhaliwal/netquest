"use client";

import { GlossaryText } from "@/components/glossary-text";

export type FieldMissionState = "complete" | "next" | "available";

type FieldMissionCardProps = {
  title: string;
  desc: string;
  xp: number;
  state: FieldMissionState;
  /** Overrides the "Available" chip label (used by the beginner track, e.g. "Beginner mission 1/3"). */
  chipLabel?: string;
  quizPerfect?: boolean;
  onPlay: () => void;
  /** Omit to hide the quiz button (beginner missions have no quiz). */
  onQuiz?: () => void;
};

const STATE_STYLES: Record<
  FieldMissionState,
  { card: string; chip: string; chipLabel: string; play: string; playLabel: string }
> = {
  complete: {
    card: "border-slate-800 bg-slate-900/40",
    chip: "text-emerald-300",
    chipLabel: "✓ Complete",
    play: "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200",
    playLabel: "Replay",
  },
  next: {
    card: "border-cyan-300/50 bg-cyan-300/10 ring-1 ring-cyan-300/40",
    chip: "text-cyan-300",
    chipLabel: "Up next",
    play: "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
    playLabel: "Start",
  },
  available: {
    card: "border-slate-800 bg-slate-900/60 hover:border-slate-700",
    chip: "text-slate-400",
    chipLabel: "Available",
    play: "bg-emerald-300 text-slate-950 hover:bg-emerald-200",
    playLabel: "Play",
  },
};

/** Status-aware mission card: the recommended next mission pops, completed ones are dimmed, the rest read as available. */
export default function FieldMissionCard({ title, desc, xp, state, chipLabel, quizPerfect, onPlay, onQuiz }: FieldMissionCardProps) {
  const s = STATE_STYLES[state];
  return (
    <div className={`rounded-xl border p-5 transition ${s.card}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${s.chip}`}>
            {state === "complete" ? "✓ Complete" : state === "next" ? "Up next" : (chipLabel ?? s.chipLabel)}
          </p>
          <p className="mt-2 font-bold">{title}</p>
          <p className="mt-2 text-sm text-slate-400">
            <GlossaryText text={desc} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button className={`rounded-lg px-4 py-2 text-xs font-black transition ${s.play}`} onClick={onPlay} type="button">
            {s.playLabel} · {xp} XP
          </button>
          {onQuiz && (
            <button
              className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/10"
              onClick={onQuiz}
              type="button"
            >
              {quizPerfect ? "★ " : ""}Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
