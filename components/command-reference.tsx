"use client";

import { useState } from "react";

export type CommandRefItem = {
  command: string;
  description: string;
  /** Optional badge shown next to the command, e.g. the CLI mode. */
  mode?: string;
};

/**
 * Collapsible command cheat sheet, rendered as a neat, numbered table —
 * step · command · description · CLI mode — so every row lines up regardless
 * of how long the individual commands are, and the top-to-bottom order is
 * explicit. Commands are shown in the sequence they are entered.
 */
export function CommandReference({
  commands,
  title = "Command reference",
}: {
  commands: CommandRefItem[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasMode = commands.some((item) => item.mode);

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
        <table className="w-full border-t border-slate-800 text-left">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              <th className="w-8 py-2 pl-4 pr-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">#</th>
              <th className="py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">Command</th>
              <th className="w-full py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">Description</th>
              {hasMode && <th className="py-2 pl-3 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">Mode</th>}
            </tr>
          </thead>
          <tbody>
            {commands.map((item, index) => (
              <tr className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/40" key={item.command}>
                <td className="py-2 pl-4 pr-2 align-top text-right font-mono text-[10px] font-bold text-slate-600">{index + 1}</td>
                <td className="whitespace-nowrap py-2 pr-3 align-top">
                  <code className="font-mono text-xs text-cyan-200">{item.command}</code>
                </td>
                <td className="w-full py-2 pr-3 align-top text-xs leading-5 text-slate-400">{item.description}</td>
                {hasMode && (
                  <td className="py-2 pl-3 pr-4 align-top text-right">
                    {item.mode && <span className="whitespace-nowrap rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{item.mode}</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
