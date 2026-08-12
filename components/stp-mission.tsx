"use client";

import {
  chooseProtocol,
  chooseRoot,
  runStpCommand,
  STP_PHASES as PHASES,
  stpPromptFor,
  type StpMissionState,
  type StpProtocol,
  type SwitchId,
} from "@/lib/stp-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  root_election: {
    label: "Prediction challenge",
    title: "Who becomes root?",
    prompt: "SW1 has bridge ID 32769. SW2 has bridge ID 24577. Choose before the BPDUs propagate.",
  },
  bpdu_guard: {
    label: "Edge-port defense · CLI",
    title: "Harden the edge port",
    prompt: "A user plugged a switch into access port Gi0/5 — unexpected BPDUs keep appearing. Enable BPDU Guard on the interface, then verify it.",
  },
  root_guard: {
    label: "Root protection · CLI",
    title: "Protect the root path",
    prompt: "A downstream switch is sending superior BPDUs on the designated uplink Gi0/2. Enable Root Guard on the interface, then verify it.",
  },
  mst_concept: {
    label: "Design decision",
    title: "Tame the VLAN storm",
    prompt: "Hundreds of VLANs are creating too much spanning-tree control traffic. Which protocol groups VLANs into instances?",
  },
} as const;

const protocolChoices: StpProtocol[] = ["rstp", "pvst", "mst"];

const labels = {
  rstp: "RSTP",
  pvst: "PVST+",
  mst: "MST",
} as const;

const phaseHints: Record<string, string[]> = {
  root_election: [
    "The root bridge is the switch with the lowest bridge ID.",
    "Bridge ID = priority + MAC address — lower wins.",
    "SW2's 24577 beats SW1's 32769, so SW2 becomes root.",
  ],
  bpdu_guard: [
    "Gi0/5 is an edge/access port — any BPDU here means someone plugged in a switch.",
    "The port must err-disable the moment that happens: that is BPDU Guard.",
    "On SW1: enable → configure terminal → interface gi0/5 → spanning-tree bpduguard enable, then verify with show spanning-tree interface gi0/5.",
  ],
  root_guard: [
    "Gi0/2 is the designated uplink toward other switches.",
    "It must reject superior root claims — that is Root Guard.",
    "On SW1: enable → configure terminal → interface gi0/2 → spanning-tree guard root, then verify with show spanning-tree interface gi0/2.",
  ],
  mst_concept: [
    "Hundreds of VLANs each want their own spanning-tree instance.",
    "You need fewer instances that group many VLANs together.",
    "MST maps VLANs to a smaller set of instances — that is the scale solution.",
  ],
};

const BPDU_GUARD_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface gi0/5", description: "Enter the edge port receiving BPDUs.", mode: "config" },
  { command: "spanning-tree bpduguard enable", description: "Err-disable the port on unexpected BPDUs.", mode: "interface" },
  { command: "show spanning-tree interface gi0/5", description: "Verify Bpdu guard is enabled.", mode: "privileged" },
];

const ROOT_GUARD_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface gi0/2", description: "Enter the designated uplink.", mode: "config" },
  { command: "spanning-tree guard root", description: "Reject superior BPDUs on this port.", mode: "interface" },
  { command: "show spanning-tree interface gi0/2", description: "Verify Root guard is enabled.", mode: "privileged" },
];

export default function StpMission({
  mission,
  onChange,
  onExit,
}: {
  mission: StpMissionState;
  onChange: (next: StpMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "mst_concept" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.mst_concept : phaseCopy[activePhase];
  const cliPhase = mission.phase === "bpdu_guard" || mission.phase === "root_guard";

  function selectRoot(switchId: SwitchId) {
    onChange(chooseRoot(mission, switchId));
  }

  function selectProtocol(protocol: StpProtocol) {
    onChange(chooseProtocol(mission, protocol));
  }

  const emptyText =
    mission.phase === "bpdu_guard" ? (
      <>
        On <span className="text-slate-400">SW1</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">interface gi0/5</span> → <span className="text-slate-400">spanning-tree bpduguard enable</span>, then verify with <span className="text-slate-400">show spanning-tree interface gi0/5</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">SW1</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">interface gi0/2</span> → <span className="text-slate-400">spanning-tree guard root</span>, then verify with <span className="text-slate-400">show spanning-tree interface gi0/2</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">NetQuest · Infrastructure</p>
            <h1 className="mt-2 text-xl font-bold">The STP Storm</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The loop is brewing.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="Stabilize the campus in four steps: elect the root, harden the edge, protect the root path, and control VLAN scale." /></p>
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
                  <span className={index < phaseIndex ? "text-slate-200" : "text-slate-500"}>{index === 0 ? "Root election" : index === 1 ? "BPDU Guard" : index === 2 ? "Root Guard" : "MST design"}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="BPDU Guard belongs on edge ports. Root Guard belongs on designated ports that must not accept a superior root claim. MST reduces repeated spanning-tree instances." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The storm is contained." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You applied the right STP protection at each layer and chose MST for scale." : copy.prompt} /></p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {!complete && mission.phase === "root_election" && (
            <div aria-label="Choose the STP root bridge" className="mt-8 grid gap-5 md:grid-cols-2" role="group">
              {(["SW1", "SW2"] as const).map((switchId) => {
                const selected = mission.selectedRoot === switchId;
                return (
                  <button aria-pressed={selected} className={`rounded-2xl border p-6 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected && switchId === mission.expectedRoot ? "border-emerald-300/60 bg-emerald-300/10" : selected ? "border-rose-300/60 bg-rose-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={switchId} onClick={() => selectRoot(switchId)} type="button">
                    <div className="flex items-center justify-between"><span className="text-lg font-black">{switchId}</span><span className="rounded-full bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400">bridge ID</span></div>
                    <p className="mt-8 font-mono text-2xl font-bold text-cyan-200">{switchId === "SW1" ? "32769" : "24577"}</p>
                    <p className="mt-2 text-xs text-slate-500">{selected ? (switchId === mission.expectedRoot ? "Root prediction confirmed" : "Prediction rejected") : "Select this switch"}</p>
                  </button>
                );
              })}
            </div>
          )}

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to SW1 · {mission.phase === "bpdu_guard" ? "edge port Gi0/5" : "designated uplink Gi0/2"}</span>
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName="SW1"
                prompt={stpPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runStpCommand(mission, command))}
                inputId="stp-cli"
                emptyText={emptyText}
              />
              <CommandReference commands={mission.phase === "bpdu_guard" ? BPDU_GUARD_COMMANDS : ROOT_GUARD_COMMANDS} title={mission.phase === "bpdu_guard" ? "BPDU Guard commands" : "Root Guard commands"} />
            </div>
          )}

          {!complete && mission.phase === "mst_concept" && (
            <div aria-label="Choose a spanning-tree protocol" className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {protocolChoices.map((protocol) => {
                const selected = mission.selectedProtocol === protocol;
                return <button aria-pressed={selected} className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={protocol} onClick={() => selectProtocol(protocol)} type="button"><p className="font-bold">{labels[protocol]}</p><p className="mt-2 text-xs leading-5 text-slate-500">{protocol === "mst" ? "Map many VLANs to a smaller set of instances." : protocol === "rstp" ? "Fast convergence, but not the many-instance scale solution." : "Per-VLAN spanning trees can multiply control traffic."}</p></button>;
              })}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <div className="mt-4 space-y-3" aria-live="polite">
              {mission.eventLog.map((entry, index) => <div className="flex gap-3 text-sm" key={`${entry.message}-${index}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} /><span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span></div>)}
            </div>
          </div>

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objective 3.1.c checkpoint complete</p><p className="mt-2 text-xl font-black">RSTP guard strategy stabilized · +100 XP</p><p className="mt-2 text-sm text-slate-400">Root: {mission.selectedRoot} · edge: BPDU Guard enabled on Gi0/5 · designated path: Root Guard enabled on Gi0/2 · scale: {mission.selectedProtocol?.toUpperCase()}</p></div>}
        </section>
      </div>
    </main>
  );
}
