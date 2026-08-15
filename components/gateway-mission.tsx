"use client";
import { Wordmark } from "@/components/wordmark";

import {
  chooseDesign,
  chooseHa,
  chooseVrrp,
  GATEWAY_PHASES as PHASES,
  gatewayPromptFor,
  runGatewayCommand,
  type GatewayDesignOption,
  type GatewayHaOption,
  type GatewayMissionState,
  type GatewayVrrpOption,
} from "@/lib/gateway-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  design: {
    label: "Design · 1.1.a",
    title: "Where should the gateway live?",
    prompt: "The campus needs a resilient default gateway for its access layer. Which design delivers redundancy at the distribution layer?",
    output: null,
  },
  ha: {
    label: "High availability · 1.1.b",
    title: "One gateway, two routers",
    prompt: "Two distribution switches will share gateway duty. Which mechanism gives end hosts a single virtual gateway that survives a switch failure?",
    output: null,
  },
  "hsrp-config": {
    label: "HSRP · configure & verify · 3.3.c",
    title: "Bring the virtual gateway up",
    prompt: "Configure HSRP group 1 on GW1's LAN interface Gi0/1 with virtual IP 10.30.0.1, priority 110, and preempt — then verify the roles with show standby.",
    output: null,
  },
  failover: {
    label: "Failover drill · 3.3.c",
    title: "Kill the active, watch the standby",
    prompt: "The campus needs proof the gateway can survive. Take GW1's gateway interface down, then verify GW2 takes over the virtual IP.",
    output: null,
  },
  vrrp: {
    label: "FHRP comparison · 3.3.c",
    title: "HSRP vs VRRP",
    prompt: "HSRP and VRRP are both first-hop redundancy protocols. Which statement about them is correct?",
    output: null,
  },
} as const;

const designChoices: GatewayDesignOption[] = ["collapsed-core-pair", "three-tier-single", "flat-single"];
const haChoices: GatewayHaOption[] = ["fhrp", "stp", "ecmp"];
const vrrpChoices: GatewayVrrpOption[] = ["virtual-mac", "same-mac", "vrrp-no-preempt"];

const optionCopy = {
  "collapsed-core-pair": { title: "Two-tier: collapsed-core pair", note: "Two distribution switches share gateway duty" },
  "three-tier-single": { title: "Three-tier, one core router", note: "Still a single gateway point of failure" },
  "flat-single": { title: "One flat L2 switch", note: "No redundancy at all" },
  fhrp: { title: "First-Hop Redundancy Protocol", note: "HSRP / VRRP / GLBP share a virtual IP" },
  stp: { title: "STP root election", note: "Prevents loops, never answers for a gateway" },
  ecmp: { title: "Equal-cost multipath", note: "A routing-table tool, not a host default gateway" },
  "virtual-mac": { title: "HSRP virtual MAC, VRRP real MAC", note: "0000.0c07.acXX vs the active router's MAC" },
  "same-mac": { title: "Both share one well-known MAC", note: "The virtual MACs are not identical" },
  "vrrp-no-preempt": { title: "VRRP disables preemption by default", note: "VRRP preempts by default — HSRP needs the command" },
} as const;

const phaseHints: Record<string, string[]> = {
  design: [
    "Two switches at the distribution layer can share the gateway's job.",
    "Hosts should never depend on a single device for their first hop.",
    "Choose the two-tier collapsed-core distribution pair.",
  ],
  ha: [
    "The gateway must be a virtual address that either router can answer for.",
    "STP is about loops, not gateways.",
    "An FHRP — HSRP, VRRP, or GLBP — is the mechanism.",
  ],
  "hsrp-config": [
    "Start on GW1: enable, configure terminal, interface gi0/1.",
    "Three standby commands build the group: virtual IP, priority 110, preempt.",
    "Verify with show standby — GW1 should be Active.",
  ],
  failover: [
    "The active router must actually die for the drill to be real.",
    "Shut down GW1's Gi0/1, then the console switches to GW2.",
    "On GW2: enable, then show standby — it should be Active.",
  ],
  vrrp: [
    "Compare the virtual MAC address each protocol answers with.",
    "HSRP has a well-known virtual MAC; VRRP does not.",
    "Choose 'HSRP virtual MAC, VRRP real MAC'.",
  ],
};

const HSRP_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface gi0/1", description: "Enter the LAN-facing interface.", mode: "config" },
  { command: "standby 1 ip 10.30.0.1", description: "Set the HSRP virtual IP for group 1.", mode: "interface" },
  { command: "standby 1 priority 110", description: "Make GW1 the preferred active router.", mode: "interface" },
  { command: "standby 1 preempt", description: "Let GW1 reclaim Active if it returns.", mode: "interface" },
  { command: "show standby", description: "Verify the Active / Standby roles.", mode: "privileged" },
];

const FAILOVER_COMMANDS = [
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface gi0/1", description: "Enter GW1's gateway interface.", mode: "config" },
  { command: "shutdown", description: "Take GW1's interface down to force failover.", mode: "interface" },
  { command: "enable", description: "Enter privileged EXEC on GW2.", mode: "user EXEC" },
  { command: "show standby", description: "Verify GW2 took over as Active.", mode: "privileged" },
];

const phaseLabels = ["Design", "High availability", "HSRP configure", "Failover drill", "HSRP vs VRRP"];

export default function GatewayMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: GatewayMissionState;
  onChange: (next: GatewayMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "vrrp" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.vrrp : phaseCopy[activePhase];
  const cliPhase = mission.phase === "hsrp-config" || mission.phase === "failover";

  function choose(option: GatewayDesignOption | GatewayHaOption | GatewayVrrpOption) {
    if (mission.phase === "design") onChange(chooseDesign(mission, option as GatewayDesignOption));
    else if (mission.phase === "ha") onChange(chooseHa(mission, option as GatewayHaOption));
    else onChange(chooseVrrp(mission, option as GatewayVrrpOption));
  }

  const emptyText =
    mission.phase === "hsrp-config" ? (
      <>
        On <span className="text-slate-400">GW1</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">interface gi0/1</span>, add the HSRP group (virtual IP, priority, preempt), then verify with <span className="text-slate-400">show standby</span>.
      </>
    ) : mission.device === "GW1" ? (
      <>
        Take <span className="text-slate-400">GW1</span> down: <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">interface gi0/1</span> → <span className="text-slate-400">shutdown</span>. The console will switch to GW2 — verify the takeover there.
      </>
    ) : (
      <>
        <span className="text-slate-400">GW2</span>'s console: run <span className="text-slate-400">show standby</span> and confirm it is <span className="text-slate-400">Active</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Architecture + Infrastructure" />
            <h1 className="mt-2 text-xl font-bold">Gateway at Dawn</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The gateway has a single point of failure.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="GW1 and GW2 form the distribution pair, but hosts still depend on one router. Configure first-hop redundancy so the campus keeps its default gateway even when a router dies — then prove the failover." /></p>
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
                  <span className={index < phaseIndex ? "text-slate-200" : "text-slate-500"}>{phaseLabels[index]}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="HSRP: two routers share a virtual IP + MAC; the Active answers for it and forwards. Priority elects the Active; `preempt` lets a higher-priority router reclaim the role after returning. VRRP does the same job — but the Master uses its real MAC and preempts by default." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The gateway cannot die." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You picked the redundant design, shared one virtual gateway between two routers, configured HSRP with priority and preempt, and watched GW2 take over the moment GW1 fell." : copy.prompt} /></p>
              {complete && <NextMissionButton next={next} />}
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                {mission.phase === "failover" && mission.gw1ShutDown ? (
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">GW1 is down — console switched to GW2</span>
                ) : (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to {mission.device}</span>
                )}
              </div>
              <ConsolePanel
                key={mission.device}
                deviceName={mission.device}
                prompt={gatewayPromptFor(mission.cliMode, mission.device)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runGatewayCommand(mission, command))}
                inputId="gateway-cli"
                emptyText={emptyText}
              />
              <CommandReference commands={mission.phase === "hsrp-config" ? HSRP_COMMANDS : FAILOVER_COMMANDS} title={mission.phase === "hsrp-config" ? "HSRP console commands" : "Failover console commands"} />
            </div>
          )}

          {!complete && !cliPhase && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {(mission.phase === "design" ? designChoices : mission.phase === "ha" ? haChoices : vrrpChoices).map((option) => {
                const selected = mission.phase === "design" ? mission.selectedDesign === option : mission.phase === "ha" ? mission.selectedHa === option : mission.selectedVrrp === option;
                return (
                  <button aria-pressed={selected} className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={option} onClick={() => choose(option)} type="button">
                    <p className="text-sm font-bold">{optionCopy[option].title}</p>
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 1.1.a · 1.1.b · 3.3.c checkpoint</p><p className="mt-2 text-xl font-black">Design · HA · HSRP/VRRP · +150 XP</p><p className="mt-2 text-sm text-slate-400">design: {mission.selectedDesign} · HA: {mission.selectedHa} · HSRP: configured &amp; verified · failover: GW2 Active · VRRP: {mission.selectedVrrp}</p></div>}
        </section>
      </div>
    </main>
  );
}
