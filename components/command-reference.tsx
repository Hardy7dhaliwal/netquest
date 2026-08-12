"use client";

import { useState } from "react";

export type CommandRefItem = {
  command: string;
  description: string;
  /** Optional badge shown next to the command, e.g. the CLI mode. */
  mode?: string;
};

/**
 * Collapsible command cheat sheet. Shows every command a player can type,
 * optionally labelled with the CLI mode it belongs to.
 */
export function CommandReference({
  commands,
  title = "Command reference",
}: {
  commands: CommandRefItem[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-800/50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">⌘ {title}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{commands.length}</span>
        </span>
        <span className={`text-xs text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-slate-800 p-3">
          {commands.map((item) => (
            <li className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-800/40" key={item.command}>
              <code className="shrink-0 font-mono text-cyan-200">{item.command}</code>
              <span className="min-w-0 flex-1 text-right text-slate-400">{item.description}</span>
              {item.mode && <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{item.mode}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
