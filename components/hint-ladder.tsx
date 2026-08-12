"use client";

import { useEffect, useRef, useState } from "react";
import { GlossaryText } from "@/components/glossary-text";

/**
 * Progressive hint ladder: hints are hidden until the player asks for the next
 * one, going from vague to specific. Pass a `resetKey` (e.g. the current mission
 * phase) when hints change per phase so the reveal count starts over.
 */
export function HintLadder({
  hints,
  title = "Hint ladder",
  resetKey,
}: {
  hints: string[];
  title?: string;
  resetKey?: string;
}) {
  const [revealed, setRevealed] = useState(0);
  const lastResetKey = useRef(resetKey);
  const allShown = revealed >= hints.length;

  // When the phase/context changes (e.g. a new mission phase), start the ladder over.
  useEffect(() => {
    if (lastResetKey.current !== resetKey) {
      lastResetKey.current = resetKey;
      setRevealed(0);
    }
  }, [resetKey]);

  if (hints.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">{title}</p>
        <span className="text-[10px] font-semibold text-amber-200/60">{revealed}/{hints.length} revealed</span>
      </div>
      <ol className="mt-3 space-y-2">
        {hints.slice(0, revealed).map((hint, index) => (
          <li className="flex items-start gap-2 text-xs leading-5 text-slate-400" key={`${resetKey ?? "hint"}-${index}`}>
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-[10px] font-bold text-amber-200">{index + 1}</span>
            <span><GlossaryText text={hint} /></span>
          </li>
        ))}
      </ol>
      {!allShown ? (
        <button
          className="mt-4 w-full rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-bold text-amber-200 transition hover:border-amber-200 hover:bg-amber-300/10"
          onClick={() => setRevealed((value) => Math.min(value + 1, hints.length))}
          type="button"
        >
          💡 Get a hint ({revealed + 1} of {hints.length})
        </button>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-amber-200/70">All hints revealed</p>
      )}
    </section>
  );
}
