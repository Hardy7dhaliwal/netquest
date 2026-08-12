"use client";

import { useState, type ReactNode } from "react";
import type { RescueDefinition } from "@/lib/rescue";
import RescuePanel from "@/components/rescue-panel";

/**
 * Wraps a mission screen: renders a floating "Stuck? Open a mini-lesson"
 * button whenever a phase-appropriate rescue exists, and opens the rescue
 * walkthrough panel as an overlay. Rendering nothing but the mission when
 * `rescue` is null keeps beginner missions (which have no rescues) untouched.
 */
export default function RescueLauncher({ rescue, children }: { rescue: RescueDefinition | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children}
      {rescue && (
        <>
          <button
            className="fixed bottom-20 right-5 z-20 flex items-center gap-2.5 rounded-full border border-amber-300/30 bg-slate-900/95 py-2.5 pl-3 pr-4 text-xs font-bold text-amber-200 shadow-2xl shadow-slate-950/50 backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-slate-800/95 focus:outline-none focus:ring-2 focus:ring-amber-300/70"
            onClick={() => setOpen(true)}
            type="button"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[11px] font-black text-slate-950">?</span>
            Stuck? Open a mini-lesson
          </button>
          {open && <RescuePanel rescue={rescue} onClose={() => setOpen(false)} />}
        </>
      )}
    </>
  );
}
