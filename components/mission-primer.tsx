"use client";

import { useState } from "react";
import { MISSION_PRIMERS } from "@/lib/mission-primers";
import { useGlossary } from "@/components/glossary";

/**
 * A beginner-friendly "concept primer" shown on every mission, right under the
 * incident brief. Where the brief tells the story and the field note assumes
 * expertise, this panel answers the first question a newcomer asks: what IS
 * this technology and why does it exist? Key terms render as chips that open
 * the glossary focused on that term.
 */
export function MissionPrimer({ missionId }: { missionId: string }) {
  const { openGlossary } = useGlossary();
  const [open, setOpen] = useState(true);
  const primer = MISSION_PRIMERS[missionId];
  if (!primer) return null;

  return (
    <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-5">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">New here? The idea in plain words</p>
        <span aria-hidden="true" className="text-cyan-300">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <>
          <p className="mt-3 text-sm leading-6 text-slate-300">{primer.what}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {primer.terms.map((term) => (
              <button
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-300/20 focus:outline-none focus:ring-1 focus:ring-cyan-300/70"
                key={term}
                onClick={() => openGlossary(term)}
                title={`Look up ${term} in the glossary`}
                type="button"
              >
                {term} <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
