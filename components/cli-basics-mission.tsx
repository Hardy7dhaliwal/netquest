"use client";
import { Wordmark } from "@/components/wordmark";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";

import { useEffect, useRef, useState } from "react";

import { ConsolePanel, type InsertSignal } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";
import {
  cliBasicsPromptFor,
  CLI_BASICS_STEPS,
  runCliBasicsCommand,
  type CliBasicsMissionState,
} from "@/lib/cli-basics-mission";

const GUIDE: Record<string, { command: string; what: string; tip: string }> = {
  help: { command: "help", what: "Ask the switch what it can do", tip: "Every Cisco CLI has built-in help. Run it first — it lists exactly what you can type right now." },
  enable: { command: "enable", what: "Move from user EXEC to privileged EXEC", tip: "Watch the prompt change from > to #. Privileged mode unlocks the show and configure commands." },
  configure: { command: "configure terminal", what: "Enter global configuration mode", tip: "This is the mode where changes to the device are made. You'll come back to it in every mission." },
  end: { command: "end", what: "Return to privileged EXEC", tip: "end jumps all the way back to privileged EXEC, while exit only moves back one mode at a time." },
  "show-version": { command: "show version", what: "Read the switch identity", tip: "show commands are read-only — completely safe to explore. This one reveals model and IOS version." },
};

const STEP_LABELS = ["Say hello with help", "Enter enable", "Enter config mode", "Return with end", "Show version"];

export default function CliBasicsMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: CliBasicsMissionState;
  onChange: (next: CliBasicsMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const stepIndex = complete ? CLI_BASICS_STEPS.length : CLI_BASICS_STEPS.indexOf(mission.step as (typeof CLI_BASICS_STEPS)[number]);
  const guide = complete ? null : GUIDE[mission.step];

  const tsRef = useRef(0);
  const [insertSignal, setInsertSignal] = useState<InsertSignal | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [mission.step]);

  function insertCommand(command: string) {
    tsRef.current += 1;
    setInsertSignal({ command, ts: tsRef.current });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Beginner track" />
            <h1 className="mt-2 text-xl font-bold">Console Basics</h1>
            <p className="mt-1 text-xs text-slate-500">Your first five commands · 50 XP</p>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">Meet the switch.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              <GlossaryText text="A brand-new switch is on the bench and you have the console cable. Before you can troubleshoot anything, you need five commands: how to ask for help, enter the right modes, and look at the device." />
            </p>
          </section>
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Your steps</p>
              <span className="text-xs text-slate-500">{stepIndex}/{CLI_BASICS_STEPS.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {STEP_LABELS.map((label, index) => (
                <div className="flex items-start gap-3 text-sm" key={label}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${index < stepIndex ? "border-emerald-300 bg-emerald-300 text-slate-950" : index === stepIndex ? "border-cyan-300 bg-cyan-300/10 text-cyan-200" : "border-slate-600 text-transparent"}`}>
                    {index < stepIndex ? "✓" : index === stepIndex ? "•" : ""}
                  </span>
                  <span className={index < stepIndex ? "text-slate-200" : index === stepIndex ? "font-semibold text-cyan-200" : "text-slate-500"}>{label}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Mission guide</p>
            {guide ? (
              <>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200/60">Step {stepIndex + 1} of {CLI_BASICS_STEPS.length}</p>
                <p className="mt-2 text-sm font-bold text-slate-100"><GlossaryText text={guide.what} /></p>
                <p className="mt-2 text-xs leading-5 text-slate-400"><GlossaryText text={guide.tip} /></p>
                {revealed ? (
                  <>
                    <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-center font-mono text-sm text-amber-100">{guide.command}</p>
                    <button className="mt-2 w-full rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-200" onClick={() => insertCommand(guide.command)} type="button">
                      Insert command
                    </button>
                    <p className="mt-2 text-center text-[10px] text-slate-500">Then press Enter to run it.</p>
                  </>
                ) : (
                  <button className="mt-4 w-full rounded-lg border border-amber-300/40 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-300/10" onClick={() => setRevealed(true)} type="button">
                    Reveal command
                  </button>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-300">Every step complete — you know your way around the console now. On to the network!</p>
            )}
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          {complete && (
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Mission complete</p>
              <p className="mt-2 text-2xl font-black">The console is yours. +50 XP</p>
              <p className="mt-2 text-sm text-slate-400">help · enable · configure terminal · end · show version — five commands down, a career of them to go.</p>
            <NextMissionButton next={next} />
            </div>
          )}
          <ConsolePanel
            deviceName="SW1"
            emptyText={<p className="text-slate-600">Welcome to SW1. Your guide on the left says what to type — start with <span className="text-slate-400">help</span>.</p>}
            history={mission.cliHistory}
            inputId="cli-basics-input"
            insertSignal={insertSignal}
            onInsertConsumed={(ts) => { if (insertSignal?.ts === ts) setInsertSignal(null); }}
            onRun={(command) => onChange(runCliBasicsCommand(mission, command))}
            prompt={cliBasicsPromptFor(mission.cliMode)}
            completions={guide ? [guide.command] : []}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
              <span className="text-xs text-slate-600">what you just learned</span>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto p-4" aria-live="polite">
              {mission.eventLog.length === 0 ? <p className="text-sm text-slate-600">Mission events will appear here.</p> : mission.eventLog.map((entry, index) => (
                <div className="flex gap-3 text-xs" key={`${entry.message}-${index}`}>
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} />
                  <span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
