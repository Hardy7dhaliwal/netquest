"use client";

import {
  chooseCause,
  chooseEvidence,
  OSPF_PHASES as PHASES,
  ospfDeviceFor,
  ospfPromptFor,
  runOspfCommand,
  type OspfCauseOption,
  type OspfEvidenceOption,
  type OspfMissionState,
} from "@/lib/ospf-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  evidence: {
    label: "Evidence review",
    title: "Read the neighbor table",
    prompt: "R1# show ip ospf neighbor shows R2 stuck in EXSTART, and the log names a mismatch. What does this tell you?",
    output: "R1# show ip ospf neighbor\n\nNeighbor ID     Pri   State           Dead Time   Address         Interface\n10.0.2.2          1   EXSTART/ -     00:00:35    10.0.2.2        GigabitEthernet0/1\n\nR1#\n*Aug  5 10:22:01.311: %OSPF-4-ERRRCV: Received invalid packet from 10.0.2.2 on GigabitEthernet0/1, mismatch area 1, should be 0",
  },
  cause: {
    label: "Root cause",
    title: "Why is R2 stuck?",
    prompt: "show ip ospf interface confirms R1 Gi0/1 is in area 0. R2 Gi0/1 is in area 1. Which statement describes the fault?",
    output: null,
  },
  config: {
    label: "Fix it · CLI",
    title: "Put the link in the right area",
    prompt: "Type the fix on R2: move the segment into the backbone so the adjacency can form.",
    output: null,
  },
  verify: {
    label: "Verification · CLI",
    title: "Prove the adjacency",
    prompt: "The fix is in. From R1, prove R2 now reaches FULL and learns the core routes.",
    output: null,
  },
  summarize: {
    label: "Design decision · CLI",
    title: "Summarize the campus",
    prompt: "The adjacency is FULL, but R1's table is flooding: 24 separate /30 routes from area 1. On R2 (the ABR), collapse them into one summary for area 0.",
    output: "R1# show ip route ospf\n      172.16.0.0/30 is subnetted, 24 subnets\nO        172.16.0.0/30 [110/2] via 10.0.2.2, 00:12:03, GigabitEthernet0/1\nO        172.16.0.4/30 [110/2] via 10.0.2.2, 00:12:03, GigabitEthernet0/1\nO        172.16.0.8/30 [110/2] via 10.0.2.2, 00:12:03, GigabitEthernet0/1\n... (24 /30 entries total)",
  },
  filter: {
    label: "Compliance filter · CLI",
    title: "Keep the lab out of area 0",
    prompt: "The summary is clean, but R1 still learns the lab prefix 192.168.50.0/24 from area 1. Compliance says it must never cross into area 0. Filter it on R2 (the ABR) as the Type-3 LSA leaves area 1.",
    output: "R1# show ip route ospf\n      172.16.0.0/22 is subnetted, 1 subnets\nO IA     172.16.0.0/22 [110/2] via 10.0.2.2, 00:05:03, GigabitEthernet0/1\nO IA     192.168.50.0/24 [110/2] via 10.0.2.2, 00:01:12, GigabitEthernet0/1\n\nCompliance: the 192.168.50.0/24 lab must never be reachable from area 0.",
  },
} as const;

const evidenceChoices: OspfEvidenceOption[] = ["stuck-adjacency", "full-converged", "process-down"];
const causeChoices: OspfCauseOption[] = ["area-mismatch", "router-id-conflict", "process-id-diff"];

const optionCopy = {
  "stuck-adjacency": { title: "The adjacency is failing", note: "OSPF parameters do not match on the link" },
  "full-converged": { title: "Both routers are converged", note: "FULL state reached" },
  "process-down": { title: "OSPF is not running", note: "Process 1 is down" },
  "area-mismatch": { title: "Shared segment, two areas", note: "R2's link sits in area 1" },
  "router-id-conflict": { title: "Router IDs conflict", note: "Duplicate router IDs" },
  "process-id-diff": { title: "Process IDs must match", note: "Both run process 1 — which is fine" },
} as const;

const phaseHints: Record<string, string[]> = {
  evidence: [
    "The neighbor is stuck in EXSTART — not FULL.",
    "The log names the fault: 'mismatch area 1, should be 0'.",
    "The routers see each other but cannot agree on the link.",
  ],
  cause: [
    "The two routers disagree about which area the shared segment belongs to.",
    "Process IDs are local and never need to match between routers.",
    "The cause is an area mismatch: R2's link sits in area 1, R1 expects area 0.",
  ],
  config: [
    "R1 expects area 0 on this segment.",
    "R2's network statement must match the backbone area.",
    "On R2: enable → configure terminal → router ospf 1 → network 10.0.2.0 0.0.0.255 area 0.",
  ],
  verify: [
    "You need proof the adjacency reached FULL.",
    "The console moved to R1 — the core router that watches R2.",
    "On R1: enable, then show ip ospf neighbor — a state of FULL/ - for R2 is the proof.",
  ],
  summarize: [
    "24 separate /30 routes are flooding R1's table.",
    "The ABR can advertise one summarized prefix instead.",
    "On R2: enable → configure terminal → router ospf 1 → area 1 range 172.16.0.0 255.255.252.0.",
  ],
  filter: [
    "The lab prefix must never leave area 1 as a Type-3 LSA.",
    "Filter at the ABR edge, on the way out of area 1.",
    "On R2: enable → configure terminal → router ospf 1 → area 1 filter-list prefix LabDeny out (LabDeny denies 192.168.50.0/24).",
  ],
};

const AREA_FIX_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "router ospf 1", description: "Enter OSPF process 1 configuration.", mode: "config" },
  { command: "network 10.0.2.0 0.0.0.255 area 0", description: "Put the shared link in the backbone area.", mode: "router config" },
];

const VERIFY_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode on R1.", mode: "user EXEC" },
  { command: "show ip ospf neighbor", description: "Read R2's neighbor state — expect FULL/ -.", mode: "privileged" },
];

const SUMMARY_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "router ospf 1", description: "Enter OSPF process 1 configuration.", mode: "config" },
  { command: "area 1 range 172.16.0.0 255.255.252.0", description: "Advertise one /22 summary into area 0.", mode: "router config" },
];

const FILTER_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "router ospf 1", description: "Enter OSPF process 1 configuration.", mode: "config" },
  { command: "ip prefix-list LabDeny seq 5 deny 192.168.50.0/24", description: "Deny the lab prefix in the list.", mode: "router config" },
  { command: "ip prefix-list LabDeny seq 10 permit 0.0.0.0/0 le 32", description: "Permit everything else.", mode: "router config" },
  { command: "area 1 filter-list prefix LabDeny out", description: "Block the Type-3 LSA as it leaves area 1.", mode: "router config" },
];

export default function OspfMission({
  mission,
  onChange,
  onExit,
}: {
  mission: OspfMissionState;
  onChange: (next: OspfMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "filter" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.filter : phaseCopy[activePhase];
  const cliPhase = mission.phase === "config" || mission.phase === "verify" || mission.phase === "summarize" || mission.phase === "filter";
  const device = ospfDeviceFor(mission.phase);

  function choose(option: OspfEvidenceOption | OspfCauseOption) {
    if (mission.phase === "evidence") onChange(chooseEvidence(mission, option as OspfEvidenceOption));
    else onChange(chooseCause(mission, option as OspfCauseOption));
  }

  const emptyText =
    mission.phase === "config" ? (
      <>
        On <span className="text-slate-400">R2</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">router ospf 1</span> → <span className="text-slate-400">network 10.0.2.0 0.0.0.255 area 0</span>.
      </>
    ) : mission.phase === "verify" ? (
      <>
        The console moved to <span className="text-slate-400">R1</span>: <span className="text-slate-400">enable</span>, then <span className="text-slate-400">show ip ospf neighbor</span> — R2 should read <span className="text-slate-400">FULL/ -</span>.
      </>
    ) : mission.phase === "summarize" ? (
      <>
        On <span className="text-slate-400">R2</span> (the ABR): <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">router ospf 1</span> → <span className="text-slate-400">area 1 range 172.16.0.0 255.255.252.0</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">R2</span> (the ABR): <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">router ospf 1</span> → <span className="text-slate-400">area 1 filter-list prefix LabDeny out</span> (define the LabDeny prefix-list first).
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">NetQuest · Infrastructure</p>
            <h1 className="mt-2 text-xl font-bold">Area Zero Hero</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The backbone is one link away.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="R1 (core, area 0) and R2 (distribution) share Gi0/1, but R2 never reaches FULL and learns no core routes. Read the neighbor table, find the area fault, type the fix, verify convergence from R1, summarize R2's subnets — then filter the lab prefix so it never crosses into area 0." /></p>
          </section>
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Mission progress</p>
              <span className="text-xs text-slate-500">{phaseIndex}/{PHASES.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {PHASES.map((phase, index) => (
                <div className="flex items-start gap-3 text-sm" key={phase}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${index < phaseIndex ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-slate-600 text-transparent"}`}>✓</span>
                  <span className={index < phaseIndex ? "text-slate-200" : "text-slate-500"}>{index === 0 ? "Read evidence" : index === 1 ? "Name the cause" : index === 2 ? "Type the fix" : index === 3 ? "Verify" : index === 4 ? "Summarize" : "Filter"}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="Both ends of an OSPF segment must share the same area. Process IDs are local and never need to match. Inter-area summaries use area X range on the ABR; inter-area filters use area X filter-list prefix ... in|out. `distribute-list out` only touches redistributed routes." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "Area 0 is whole — and clean." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You read the stuck neighbor state, traced it to the area mismatch, typed the area-0 fix, verified FULL from R1, summarized 24 subnets — and filtered the lab prefix at the ABR edge." : copy.prompt} /></p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {!complete && copy.output && (
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
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">Fix applied — console moved to R1</span>
                ) : (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to {device}</span>
                )}
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName={device}
                prompt={ospfPromptFor(mission.cliMode, device)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runOspfCommand(mission, command))}
                inputId="ospf-cli"
                emptyText={emptyText}
              />
              <CommandReference
                commands={mission.phase === "config" ? AREA_FIX_COMMANDS : mission.phase === "verify" ? VERIFY_COMMANDS : mission.phase === "summarize" ? SUMMARY_COMMANDS : FILTER_COMMANDS}
                title={mission.phase === "config" ? "Area fix commands" : mission.phase === "verify" ? "Adjacency verification commands" : mission.phase === "summarize" ? "Summarization commands" : "Compliance filter commands"}
              />
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <div className="mt-4 space-y-3" aria-live="polite">
              {mission.eventLog.map((entry, index) => <div className="flex gap-3 text-sm" key={`${entry.message}-${index}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} /><span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span></div>)}
            </div>
          </div>

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objective 3.2.b checkpoint complete</p><p className="mt-2 text-xl font-black">Areas · adjacency · summarization · filtering · +100 XP</p><p className="mt-2 text-sm text-slate-400">Evidence: {mission.selectedEvidence} · cause: {mission.selectedCause} · fix: network 10.0.2.0 0.0.0.255 area 0 · check: FULL/ - from R1 · summary: area 1 range · filter: area 1 filter-list prefix LabDeny out</p></div>}
        </section>
      </div>
    </main>
  );
}
