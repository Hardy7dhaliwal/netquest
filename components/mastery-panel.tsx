"use client";

import { bandLabel, recommendNext, type MasteryMap } from "@/lib/mastery";

/**
 * Mastery panel: the single next-best activity from the mastery engine plus the
 * weak topics behind it. Replaces the static "weak topic" hint with a real
 * recommendation driven by per-objective scores.
 */
export default function MasteryPanel({
  mastery,
  weakTopics,
  onOpen,
}: {
  mastery: MasteryMap;
  weakTopics: string[];
  onOpen: (arcId: string) => void;
}) {
  const recommendation = recommendNext(mastery);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Recommended next</p>
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-5">
        {recommendation.kind === "unseen" && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Unseen objective</p>
              <p className="mt-2 font-bold">{recommendation.arcTitle}</p>
              <p className="mt-1 text-sm text-slate-400">
                <code className="font-mono font-semibold text-cyan-200">{recommendation.objective.id}</code>
                <span className="ml-1.5">{recommendation.objective.label}</span> — no mastery yet.
              </p>
            </div>
            <button
              className="shrink-0 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
              onClick={() => onOpen(recommendation.arcId)}
              type="button"
            >
              Play {recommendation.arcTitle}
            </button>
          </div>
        )}

        {recommendation.kind === "review" && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Below Guided — review</p>
              <p className="mt-2 font-bold">{recommendation.arcTitle}</p>
              <p className="mt-1 text-sm text-slate-400">
                {recommendation.weakObjectives.length} objective{recommendation.weakObjectives.length === 1 ? "" : "s"} need practice to reach Guided (70):
              </p>
              <ul className="mt-2 space-y-1">
                {recommendation.weakObjectives.map((objective) => (
                  <li className="text-xs text-slate-400" key={objective.id}>
                    <code className="font-mono font-semibold text-amber-200">{objective.id}</code>
                    <span className="ml-1.5">{objective.label}</span>
                    <span className="ml-1.5 text-slate-600">· {bandLabel(mastery[objective.id] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              className="shrink-0 rounded-lg bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-200"
              onClick={() => onOpen(recommendation.arcId)}
              type="button"
            >
              Review {recommendation.arcTitle}
            </button>
          </div>
        )}

        {recommendation.kind === "ready" && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Exam-ready track</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{recommendation.message}</p>
          </div>
        )}
      </div>

      {weakTopics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {weakTopics.map((topic) => (
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200" key={topic}>
              {topic}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
