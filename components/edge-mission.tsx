"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  chooseBgpState,
  chooseConvergence,
  chooseIgp,
  chooseLocal,
  choosePbr,
  EDGE_PHASES as PHASES,
  edgePromptFor,
  runEdgeCommand,
  type EdgeConvergenceOption,
  type EdgeIgpOption,
  type EdgeLocalOption,
  type EdgeMissionState,
  type EdgePbrOption,
  type EdgeBgpStateOption,
} from "@/lib/edge-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  igp: {
    label: "IGP choice",
    title: "Pick the interior protocol",
    prompt: "The campus must pick one interior routing protocol. Which comparison of EIGRP and OSPF is correct?",
    output: null,
  },
  convergence: {
    label: "Convergence",
    title: "How fast can it heal?",
    prompt: "With OSPF chosen for the core, which statement about EIGRP versus OSPF convergence is correct?",
    output: null,
  },
  "bgp-state": {
    label: "eBGP to the ISP",
    title: "Read the session state",
    prompt: "R-EDGE peers eBGP with ISP-R (AS 65001), but the session never comes up: the neighbor stays Active. What does this mean?",
    output: "R-EDGE# show ip bgp summary\nBGP router identifier 198.51.100.1, local AS number 65100\nNeighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n203.0.113.2     4 65001       0       0        1    0    0 never    Active",
  },
  "bgp-fix": {
    label: "eBGP to the ISP",
    title: "Bring the session up",
    prompt: "R-EDGE and ISP-R are two hops apart — a transit router sits between them, and eBGP assumes directly connected peers by default (TTL 1). Configure the fix on R-EDGE, then verify.",
    output: null,
  },
  pbr: {
    label: "PBR at the edge",
    title: "Route with opinions",
    prompt: "This route-map is applied with ip policy route-map on R-EDGE Gi0/1. What does it do to matching traffic?",
    output: "route-map PREFER-ISP1 permit 10\n  match ip address 100\n  set ip next-hop 198.51.100.1\n\ninterface GigabitEthernet0/1\n  ip policy route-map PREFER-ISP1",
  },
  local: {
    label: "PBR at the edge",
    title: "Steer the router's own traffic",
    prompt: "To also steer traffic the router itself generates, which command applies the same route-map?",
    output: null,
  },
} as const;

const igpChoices: EdgeIgpOption[] = ["hybrid-vs-linkstate", "classes-reversed", "both-linkstate"];
const convergenceChoices: EdgeConvergenceOption[] = ["fs-vs-spf", "holddown", "lsa-flood"];
const bgpStateChoices: EdgeBgpStateOption[] = ["not-established", "established", "low-localpref"];
const pbrChoices: EdgePbrOption[] = ["overrides-lookup", "changes-table", "local-only"];
const localChoices: EdgeLocalOption[] = ["local-policy", "outbound-policy", "default-route"];

const optionCopy = {
  "hybrid-vs-linkstate": { title: "Hybrid vs link-state", note: "EIGRP composite metric; OSPF cost" },
  "classes-reversed": { title: "Classes reversed", note: "EIGRP link-state, OSPF distance-vector" },
  "both-linkstate": { title: "Both are link-state", note: "LSA flooding + SPF for both" },
  "fs-vs-spf": { title: "Feasible successor vs SPF", note: "DUAL backup paths vs recalculation" },
  holddown: { title: "OSPF uses holddown", note: "Holddown is a distance-vector tool" },
  "lsa-flood": { title: "EIGRP floods LSAs", note: "EIGRP sends partial updates" },
  "not-established": { title: "Session not Established", note: "Active means still retrying" },
  established: { title: "Session is established", note: "Would show uptime + prefixes" },
  "low-localpref": { title: "Local preference too low", note: "Shapes path selection, not state" },
  "overrides-lookup": { title: "Overrides route lookup", note: "Matched traffic takes the set next-hop" },
  "changes-table": { title: "Changes the routing table", note: "PBR never rewrites the RIB" },
  "local-only": { title: "Locally sourced traffic only", note: "Interface policy covers transit" },
  "local-policy": { title: "ip local policy route-map PREFER-ISP1", note: "Global policy for local traffic" },
  "outbound-policy": { title: "ip policy route-map on egress", note: "PBR is inbound only" },
  "default-route": { title: "ip route 0.0.0.0 0.0.0.0 198.51.100.1", note: "A default route, not PBR" },
} as const;

const phaseHints: Record<string, string[]> = {
  igp: [
    "EIGRP is a hybrid with a composite metric (bandwidth, delay, load, reliability).",
    "OSPF is link-state and derives its metric as cost.",
    "The comparison that swaps these roles is wrong — choose 'Hybrid vs link-state'.",
  ],
  convergence: [
    "EIGRP's DUAL can fail over to a feasible successor almost instantly.",
    "OSPF recalculates with SPF after a topology change.",
    "Choose 'Feasible successor vs SPF'.",
  ],
  "bgp-state": [
    "Active is not a working session.",
    "An established session would show uptime and received prefixes.",
    "The session is not Established — it is still trying.",
  ],
  "bgp-fix": [
    "eBGP assumes peers are directly connected (TTL 1).",
    "These peers are two hops apart — a transit router sits between them.",
    "Enable ebgp-multihop 2 for neighbor 203.0.113.2, then verify with show ip bgp summary.",
  ],
  pbr: [
    "The route-map sets a next-hop for matched traffic (ACL 100).",
    "The policy runs before the destination-based lookup.",
    "It overrides the route lookup for matching traffic.",
  ],
  local: [
    "An interface policy only catches transit traffic.",
    "Locally generated traffic needs a global policy.",
    "Use ip local policy route-map PREFER-ISP1.",
  ],
};

const EDGE_BGP_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "router bgp 65100", description: "Enter BGP router configuration.", mode: "config" },
  { command: "neighbor 203.0.113.2 ebgp-multihop 2", description: "Allow a two-hop eBGP peer.", mode: "config-router" },
  { command: "show ip bgp summary", description: "Verify the session is Established.", mode: "privileged" },
];

export default function EdgeMission({
  mission,
  onChange,
  onExit,
}: {
  mission: EdgeMissionState;
  onChange: (next: EdgeMissionState) => void;
  onExit: () => void;
}) {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "local" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.local : phaseCopy[activePhase];

  function choose(option: EdgeIgpOption | EdgeConvergenceOption | EdgeBgpStateOption | EdgePbrOption | EdgeLocalOption) {
    if (mission.phase === "igp") onChange(chooseIgp(mission, option as EdgeIgpOption));
    else if (mission.phase === "convergence") onChange(chooseConvergence(mission, option as EdgeConvergenceOption));
    else if (mission.phase === "bgp-state") onChange(chooseBgpState(mission, option as EdgeBgpStateOption));
    else if (mission.phase === "pbr") onChange(choosePbr(mission, option as EdgePbrOption));
    else onChange(chooseLocal(mission, option as EdgeLocalOption));
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!command.trim()) return;
    onChange(runEdgeCommand(mission, command));
    setCommand("");
    inputRef.current?.focus();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">NetQuest · Infrastructure</p>
            <h1 className="mt-2 text-xl font-bold">The Edge Has Opinions</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The edge router decides.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="R-EDGE is the campus border: it runs an IGP internally, peers eBGP with the ISP, and steers special traffic with PBR. Pick the right protocol comparison, type the eBGP fix, verify the session, then make the edge route with opinions." /></p>
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
                  <span className={index < phaseIndex ? "text-slate-200" : "text-slate-500"}>{index === 0 ? "IGP choice" : index === 1 ? "Convergence" : index === 2 ? "BGP state" : index === 3 ? "BGP fix" : index === 4 ? "PBR" : "Local PBR"}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="eBGP peers are directly connected by default (TTL 1) — `ebgp-multihop` raises it for two-hop peers. Verify with `show ip bgp summary`: Established means prefixes flow. PBR overrides the route lookup for matched traffic; `ip local policy` covers locally sourced flows." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The edge is open for business." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You matched EIGRP and OSPF to their strengths, typed the eBGP fix and verified Established, and steered traffic with PBR — including the router's own." : copy.prompt} /></p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {!complete && copy.output && (
            <pre className="mt-6 overflow-x-auto whitespace-pre rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs leading-5 text-slate-300">{copy.output}</pre>
          )}

          {!complete && mission.phase === "bgp-fix" && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#030914] shadow-2xl shadow-cyan-950/10">
                <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs font-bold text-slate-200">R-EDGE · console</p>
                    <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> connected</span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-slate-500">Type <span className="text-cyan-300">help</span> for available commands.</p>
                </div>
                <div className="max-h-64 space-y-3 overflow-y-auto p-4 font-mono text-xs leading-5" aria-live="polite">
                  {mission.cliHistory.length === 0 && <p className="text-slate-600">Enable, enter BGP configuration, raise the TTL for the two-hop peer, then verify with <span className="text-slate-400">show ip bgp summary</span>.</p>}
                  {mission.cliHistory.map((entry, index) => (
                    <div key={`${entry.input}-${index}`}>
                      <p><span className="text-cyan-300">{entry.prompt}</span> <span className="text-slate-200">{entry.input}</span></p>
                      {entry.output && <pre className="mt-1 whitespace-pre-wrap text-slate-400">{entry.output}</pre>}
                    </div>
                  ))}
                </div>
                <form className="border-t border-slate-800 p-3" onSubmit={submitCommand}>
                  <label className="sr-only" htmlFor="edge-cli">Enter a CLI command</label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-cyan-300/70">
                    <span className="font-mono text-xs text-cyan-300">{edgePromptFor(mission.cliMode)}</span>
                    <input ref={inputRef} autoComplete="off" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-700" id="edge-cli" onChange={(event) => setCommand(event.target.value)} placeholder="enter command" value={command} />
                    <button className="text-xs font-bold text-cyan-300 hover:text-cyan-100" type="submit">Run</button>
                  </div>
                </form>
              </div>
              <CommandReference commands={EDGE_BGP_COMMANDS} title="BGP console commands" />
            </div>
          )}

          {!complete && mission.phase !== "bgp-fix" && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {(mission.phase === "igp" ? igpChoices : mission.phase === "convergence" ? convergenceChoices : mission.phase === "bgp-state" ? bgpStateChoices : mission.phase === "pbr" ? pbrChoices : localChoices).map((option) => {
                const selected = mission.phase === "igp" ? mission.selectedIgp === option : mission.phase === "convergence" ? mission.selectedConvergence === option : mission.phase === "bgp-state" ? mission.selectedBgpState === option : mission.phase === "pbr" ? mission.selectedPbr === option : mission.selectedLocal === option;
                return (
                  <button aria-pressed={selected} className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={option} onClick={() => choose(option)} type="button">
                    <p className="font-mono text-sm font-bold">{optionCopy[option].title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{optionCopy[option].note}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <div className="mt-4 space-y-3" aria-live="polite">
              {mission.eventLog.map((entry, index) => <div className="flex gap-3 text-sm" key={`${entry.message}-${index}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} /><span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span></div>)}
            </div>
          </div>

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 3.2.a · 3.2.c · 3.2.d checkpoint</p><p className="mt-2 text-xl font-black">IGP · eBGP · PBR · +150 XP</p><p className="mt-2 text-sm text-slate-400">IGP: {mission.selectedIgp} · convergence: {mission.selectedConvergence} · state: {mission.selectedBgpState} · bgp fix: configured &amp; verified · PBR: {mission.selectedPbr} · local: {mission.selectedLocal}</p></div>}
        </section>
      </div>
    </main>
  );
}
