"use client";
import { useState } from "react";
import { Wordmark } from "@/components/wordmark";

import {
  chooseCause,
  chooseEvidence,
  EC_PHASES as PHASES,
  ecPromptFor,
  runEcCommand,
  type CauseOption,
  type EcMissionState,
  type EvidenceOption,
} from "@/lib/etherchannel-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";
import { MissionPrimer } from "@/components/mission-primer";
import { NetworkMap } from "@/components/network-map";
import { MissionProgress, PhaseReviewModal, type PhaseReviewContent } from "@/components/phase-review";

const phaseCopy = {
  evidence: {
    label: "Evidence review",
    title: "Read the bundle",
    prompt: "SW1# show etherchannel summary reports Port-Channel 1 with only one member. What does that tell you?",
    output: "SW1# show etherchannel summary\nFlags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        U - in use      f - failed to allocate aggregator\n\nNumber of channel-groups in use: 1\nNumber of aggregators:           1\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------\n1      Po1(SU)         LACP      Gi0/1(P)   Gi0/2",
  },
  cause: {
    label: "Root cause",
    title: "Why is Gi0/2 missing?",
    prompt: "show etherchannel detail reveals SW1 Gi0/2 is channel-group 1 mode passive, and SW2 Gi0/2 is also mode passive.",
    output: null,
  },
  config: {
    label: "Fix it · CLI",
    title: "Bring the link into the bundle",
    prompt: "Type the fix on SW1: change Gi0/2 from passive to LACP active so the bundle can form.",
    output: null,
  },
  verify: {
    label: "Verification · CLI",
    title: "Prove the bundle is healthy",
    prompt: "The fix is in. Prove both links are members of Port-Channel 1 by reading the summary.",
    output: null,
  },
} as const;

const evidenceChoices: EvidenceOption[] = ["missing-link", "healthy-bundle", "no-lacp"];
const causeChoices: CauseOption[] = ["passive-passive", "group-mismatch", "access-mode"];

const optionCopy = {
  "missing-link": { title: "Only Gi0/1 joined Po1", note: "Gi0/2 is not negotiating" },
  "healthy-bundle": { title: "Both links are bundled", note: "Po1 is fully formed" },
  "no-lacp": { title: "LACP is unsupported here", note: "Hardware limitation" },
  "passive-passive": { title: "LACP passive on both ends", note: "Neither side initiates" },
  "group-mismatch": { title: "Channel-group numbers differ", note: "Group 1 vs group 2" },
  "access-mode": { title: "Ports must be access mode", note: "Trunking is the issue" },
} as const;

const PHASE_LABELS = ["Read evidence", "Name the cause", "Type the fix", "Verify"];

const phaseHints: Record<string, string[]> = {
  evidence: [
    "Look at the Ports column under Port-Channel 1.",
    "Gi0/1 has a (P) flag; Gi0/2 has no flag at all.",
    "Only one link ever joined the bundle — the evidence is a missing link.",
  ],
  cause: [
    "Both switches configured their ports with LACP mode passive.",
    "Passive ports wait for the other side to initiate negotiation.",
    "Passive/passive — nobody ever starts the handshake.",
  ],
  config: [
    "LACP needs at least one active side to send negotiation PDUs.",
    "Change SW1's Gi0/2 mode from passive to active.",
    "On SW1: enable → configure terminal → interface gi0/2 → channel-group 1 mode active.",
  ],
  verify: [
    "You want proof both links are bundled members of Po1.",
    "show etherchannel summary is the canonical check.",
    "Enable, then show etherchannel summary — expect Gi0/1(P) and Gi0/2(P) under Port-Channel 1 (SU).",
  ],
};

const CONFIG_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface gi0/2", description: "Enter the missing member port.", mode: "config" },
  { command: "channel-group 1 mode active", description: "LACP active — start negotiating with the passive neighbor.", mode: "interface" },
  { command: "show etherchannel summary", description: "Check whether Gi0/2 joins Po1.", mode: "privileged" },
];

const VERIFY_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "show etherchannel summary", description: "Read the (P) members of Port-Channel 1.", mode: "privileged" },
];

export default function EtherchannelMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: EcMissionState;
  onChange: (next: EcMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "verify" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.verify : phaseCopy[activePhase];
  const cliPhase = complete || mission.phase === "config" || mission.phase === "verify";

  const [reviewPhase, setReviewPhase] = useState<string | null>(null);
  const reviewContent: PhaseReviewContent | null = reviewPhase
    ? (() => {
        const copy = phaseCopy[reviewPhase as keyof typeof phaseCopy];
        const answer =
          reviewPhase === "evidence" && mission.selectedEvidence
            ? optionCopy[mission.selectedEvidence].title
            : reviewPhase === "cause" && mission.selectedCause
              ? optionCopy[mission.selectedCause].title
              : null;
        const commands =
          reviewPhase === "config" ? CONFIG_COMMANDS : reviewPhase === "verify" ? VERIFY_COMMANDS : undefined;
        return { label: copy.label, title: copy.title, prompt: copy.prompt, output: (copy as { output?: string | null }).output ?? null, answer, commands };
      })()
    : null;

  function choose(option: EvidenceOption | CauseOption) {
    if (mission.phase === "evidence") onChange(chooseEvidence(mission, option as EvidenceOption));
    else onChange(chooseCause(mission, option as CauseOption));
  }

  const emptyText =
    mission.phase === "config" ? (
      <>
        On <span className="text-slate-400">SW1</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">interface gi0/2</span> → <span className="text-slate-400">channel-group 1 mode active</span>.
      </>
    ) : (
      <>
        <span className="text-slate-400">enable</span>, then read the proof with <span className="text-slate-400">show etherchannel summary</span> — expect both <span className="text-slate-400">Gi0/1(P)</span> and <span className="text-slate-400">Gi0/2(P)</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Infrastructure" />
            <h1 className="mt-2 text-xl font-bold">The Bundled Bottleneck</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">Two links, one at a time.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="Gi0/1 and Gi0/2 should form one 2 Gbps LACP bundle to the gateway, but only one link ever bundles. Trace the evidence, name the cause, type the fix, and prove it." /></p>
          </section>
          <MissionPrimer missionId="bundled-bottleneck" />
          <NetworkMap missionId="bundled-bottleneck" />
          <MissionProgress labels={PHASE_LABELS} phaseIndex={phaseIndex} phases={PHASES} onReview={setReviewPhase} />
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="LACP needs at least one active side. Every member of a bundle must share the same channel-group number and port attributes. `show etherchannel summary` is the proof." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The bundle is whole." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You read the summary, found the passive/passive LACP mismatch, typed the active fix, and verified both links in Po1." : copy.prompt} /></p>
              {complete && <NextMissionButton next={next} />}
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {!complete && mission.phase === "evidence" && copy.output && (
            <pre className="mt-6 overflow-x-auto whitespace-pre rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs leading-5 text-slate-300">{copy.output}</pre>
          )}

          {!complete && (mission.phase === "evidence" || mission.phase === "cause") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {(mission.phase === "evidence" ? evidenceChoices : causeChoices).map((option) => {
                const selected = mission.phase === "evidence" ? mission.selectedEvidence === option : mission.selectedCause === option;
                return (
                  <button aria-pressed={selected} className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={option} onClick={() => choose(option)} type="button">
                    <p className="font-mono text-sm font-bold">{optionCopy[option].title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{optionCopy[option].note}</p>
                  </button>
                );
              })}
            </div>
          )}

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                {mission.phase === "verify" ? (
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">Fix applied — Gi0/2 negotiating</span>
                ) : (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to SW1</span>
                )}
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName="SW1"
                prompt={ecPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runEcCommand(mission, command))}
                inputId="ec-cli"
                emptyText={emptyText}
                completions={(mission.phase === "config" ? CONFIG_COMMANDS : VERIFY_COMMANDS).map((entry) => entry.command)}
              />
              <CommandReference commands={mission.phase === "config" ? CONFIG_COMMANDS : VERIFY_COMMANDS} title={mission.phase === "config" ? "LACP fix commands" : "Verification commands"} />
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <div className="mt-4 space-y-3" aria-live="polite">
              {mission.eventLog.map((entry, index) => <div className="flex gap-3 text-sm" key={`${entry.message}-${index}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} /><span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span></div>)}
            </div>
          </div>

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objective 3.1.b checkpoint complete</p><p className="mt-2 text-xl font-black">Port-Channel 1 healthy · +100 XP</p><p className="mt-2 text-sm text-slate-400">Evidence: {mission.selectedEvidence} · cause: {mission.selectedCause} · fix: channel-group 1 mode active · check: show etherchannel summary (SU)</p></div>}
        </section>
      </div>
      <PhaseReviewModal content={reviewContent} onClose={() => setReviewPhase(null)} phase={reviewPhase} />
    </main>
  );
}
