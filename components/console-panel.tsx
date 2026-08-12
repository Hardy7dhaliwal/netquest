"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export type ConsolePanelEntry = { input: string; output: string; prompt: string };

export type InsertSignal = { command: string; ts: number };

/**
 * Terminal-style console shared by the beginner missions. `insertSignal` lets
 * the parent (e.g. a guided "next step" panel) pre-fill the input box for the
 * player, who then presses Enter — typing practice without guesswork.
 */
export function ConsolePanel({
  deviceName,
  prompt,
  history,
  onRun,
  inputId,
  emptyText,
  insertSignal,
  onInsertConsumed,
}: {
  deviceName: string;
  prompt: string;
  history: ConsolePanelEntry[];
  onRun: (command: string) => void;
  inputId: string;
  emptyText: ReactNode;
  insertSignal?: InsertSignal | null;
  onInsertConsumed?: (ts: number) => void;
}) {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInsertTs = useRef(0);
  // Keep the latest callback in a ref so the insert effect only depends on the signal.
  const onInsertConsumedRef = useRef(onInsertConsumed);
  useEffect(() => {
    onInsertConsumedRef.current = onInsertConsumed;
  });

  useEffect(() => {
    if (insertSignal && insertSignal.ts !== lastInsertTs.current) {
      lastInsertTs.current = insertSignal.ts;
      setCommand(insertSignal.command);
      inputRef.current?.focus();
      onInsertConsumedRef.current?.(insertSignal.ts);
    }
  }, [insertSignal]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!command.trim()) return;
    onRun(command);
    setCommand("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#030914] shadow-2xl shadow-cyan-950/10">
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold text-slate-200">{deviceName} · console</p>
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> connected</span>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-500">Type <span className="text-cyan-300">help</span> for available commands.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 font-mono text-xs leading-5" aria-live="polite">
        {history.length === 0 ? emptyText : history.map((entry, index) => (
          <div key={`${entry.input}-${index}`}>
            <p><span className="text-cyan-300">{entry.prompt}</span> <span className="text-slate-200">{entry.input}</span></p>
            {entry.output && <pre className="mt-1 whitespace-pre-wrap text-slate-400">{entry.output}</pre>}
          </div>
        ))}
      </div>
      <form className="border-t border-slate-800 p-3" onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>Enter a CLI command</label>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-cyan-300/70">
          <span className="font-mono text-xs text-cyan-300">{prompt}</span>
          <input ref={inputRef} autoComplete="off" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-700" id={inputId} onChange={(event) => setCommand(event.target.value)} placeholder="enter command" value={command} />
          <button className="text-xs font-bold text-cyan-300 hover:text-cyan-100" type="submit">Run</button>
        </div>
      </form>
    </div>
  );
}
