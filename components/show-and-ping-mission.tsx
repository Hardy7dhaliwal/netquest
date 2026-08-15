"use client";
import { Wordmark } from "@/components/wordmark";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";

import { useEffect, useRef, useState } from "react";

import { ConsolePanel, type InsertSignal } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";
import {
  runShowAndPingCommand,
  SHOW_PING_STEPS,
  showPingPromptFor,
  type ShowAndPingMissionState,
} from "@/lib/show-and-ping-mission";

const GUIDE: Record<string, { command: string; what: string; lookFor: string }> = {
  enable: { command: "enable", what: "Enter privileged EXEC", lookFor: "The prompt changes from > to #." },
  "show-vlan": { command: "show vlan brief", what: "List the VLANs on SW1", lookFor: "VLAN 10 MANAGEMENT and VLAN 20 SALES, plus the ports that live in each." },
  "show-trunk": { command: "show interfaces trunk", what: "Inspect the inter-switch link", lookFor: "The allowed VLAN list — what may cross from SW1 to SW2." },
  "show-running": { command: "show running-config", what: "Read the live configuration", lookFor: "The interface blocks and their switchport settings." },
  ping: { command: "ping 10.20.0.1", what: "Verify the path to the gateway", lookFor: "!!!!! — five replies, 100% success." },
};

const STEP_LABELS = ["Enter enable", "List the VLANs", "Inspect the trunk", "Read the config", "Ping the gateway"];

export default function ShowAndPingMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: ShowAndPingMissionState;
  onChange: (next: ShowAndPingMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const stepIndex = complete ? SHOW_PING_STEPS.length : SHOW_PING_STEPS.indexOf(mission.step as (typeof SHOW_PING_STEPS)[number]);
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
            <h1 className="mt-2 text-xl font-bold">Show &amp; Ping</h1>
            <p className="mt-1 text-xs text-slate-500">Learn to look at a network · 50 XP</p>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">This network is healthy.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              <GlossaryText text="Nothing is broken — your job is to look around and learn what the outputs mean. Run each read-only command, read its answer, and finish with a successful ping." />
            </p>
          </section>
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Your steps</p>
              <span className="text-xs text-slate-500">{stepIndex}/{SHOW_PING_STEPS.length}</span>
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
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200/60">Step {stepIndex + 1} of {SHOW_PING_STEPS.length}</p>
                <p className="mt-2 text-sm font-bold text-slate-100">{guide.what}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400"><span className="font-semibold text-amber-200/80">Look for:</span> <GlossaryText text={guide.lookFor} /></p>
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
              <p className="mt-3 text-sm leading-6 text-slate-300">All five steps done — you can now read a network and prove it works. That is the foundation of every troubleshooting mission.</p>
            )}
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          {complete && (
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Mission complete</p>
              <p className="mt-2 text-2xl font-black">Path verified: 100%. +50 XP</p>
              <p className="mt-2 text-sm text-slate-400">show vlan brief · show interfaces trunk · show running-config · ping — the four commands you will use in every mission ahead.</p>
            <NextMissionButton next={next} />
            </div>
          )}
          <ConsolePanel
            deviceName="SW1"
            emptyText={<p className="text-slate-600">Welcome to SW1. Follow the guide — start with <span className="text-slate-400">enable</span>.</p>}
            history={mission.cliHistory}
            inputId="show-ping-input"
            insertSignal={insertSignal}
            onInsertConsumed={(ts) => { if (insertSignal?.ts === ts) setInsertSignal(null); }}
            onRun={(command) => onChange(runShowAndPingCommand(mission, command))}
            prompt={showPingPromptFor(mission.cliMode)}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
              <span className="text-xs text-slate-600">what each command means</span>
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
