"use client";
import { Wordmark } from "@/components/wordmark";

import {
  chooseController,
  chooseFlow,
  chooseNetconf,
  SIGNAL_PHASES as PHASES,
  signalPromptFor,
  runSignalCommand,
  type SignalControllerOption,
  type SignalDetectiveMissionState,
  type SignalFlowOption,
  type SignalNetconfOption,
} from "@/lib/signal-detective-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";
import { MissionPrimer } from "@/components/mission-primer";

const phaseCopy = {
  diagnose: {
    label: "Diagnostics · troubleshoot · 4.1",
    title: "Collect the evidence",
    prompt: "Users say the finance app is crawling. On R-CORE, work the ladder: prove reachability, trace the path, check the interface, then catch the culprit with a conditional debug.",
  },
  flow: {
    label: "Flexible NetFlow · interpret · 4.2",
    title: "Read the telemetry",
    prompt: "Here is the Flexible NetFlow setup on gi0/1. Which statement about it is correct?",
  },
  span: {
    label: "SPAN · configure · 4.3",
    title: "Mirror the link",
    prompt: "An analyzer is plugged into Gi0/2. Configure a SPAN session that copies Gi0/1 (both directions) to it — then verify.",
  },
  sla: {
    label: "IP SLA · configure · 4.4",
    title: "Probe the path",
    prompt: "Set up an IP SLA that measures the path to the app server every minute — then read the statistics.",
  },
  controller: {
    label: "Catalyst Center · inspect · 4.5",
    title: "The controller view",
    prompt: "Cisco Catalyst Center (formerly DNA Center) centralizes configuration, monitoring, and management — including AI-powered workflows. Which statement about it is correct?",
  },
  netconf: {
    label: "NETCONF / RESTCONF · configure · 4.6",
    title: "Ask the device, programmatically",
    prompt: "Enable RESTCONF on R-CORE, then read the interface configuration back over YANG JSON.",
  },
  "final-check": {
    label: "NETCONF / RESTCONF · interpret · 4.6",
    title: "What did you just use?",
    prompt: "You read the interface over RESTCONF. Which statement about what you used is correct?",
  },
} as const;

const flowChoices: SignalFlowOption[] = ["fnf-export", "packet-capture", "snmp-polling"];
const controllerChoices: SignalControllerOption[] = ["design-comply", "assurance", "ipsla-ctrl"];
const netconfChoices: SignalNetconfOption[] = ["restconf-yang", "netconf-ssh-only", "cli-only"];

const optionCopy = {
  "fnf-export": { title: "Flow records exported to a collector", note: "Counters over UDP 2055 to 203.0.113.50" },
  "packet-capture": { title: "Full packets copied to a file", note: "That is SPAN's job — NetFlow counts flows" },
  "snmp-polling": { title: "SNMP polls the device", note: "NetFlow pushes records; SNMP pulls counters" },
  "design-comply": { title: "Design, provision, compliance", note: "Templates push config; compliance checks golden state" },
  "assurance": { title: "Assurance health monitoring", note: "That is the monitoring side, not config workflows" },
  "ipsla-ctrl": { title: "Runs IP SLA probes", note: "IP SLA runs on routers — not a Catalyst Center workflow" },
  "restconf-yang": { title: "YANG data over HTTPS (443)", note: "JSON/XML via /restconf/data — programmatic" },
  "netconf-ssh-only": { title: "NETCONF over SSH/830", note: "That is NETCONF — you used RESTCONF/HTTPS" },
  "cli-only": { title: "Plain CLI automation", note: "You just saw JSON over HTTPS — not CLI" },
} as const;

const FLOW_CONFIG = [
  "flow record FN-RECORD",
  "  match ipv4 source address",
  "  match ipv4 destination address",
  "  collect counter bytes",
  "  collect counter packets",
  "flow exporter FN-EXPORTER",
  "  destination 203.0.113.50",
  "  transport udp 2055",
  "flow monitor FN-MONITOR",
  "  record FN-RECORD",
  "  exporter FN-EXPORTER",
  "interface gi0/1",
  "  ip flow monitor FN-MONITOR input",
].join("\n");

const DIAGNOSE_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on R-CORE.", mode: "user EXEC" },
  { command: "ping 10.20.0.1", description: "Prove basic reachability to the gateway.", mode: "privileged" },
  { command: "traceroute 10.20.0.1", description: "Trace the path hop by hop.", mode: "privileged" },
  { command: "show interface gi0/1", description: "Check for input errors and load.", mode: "privileged" },
  { command: "debug ip packet access-list 150", description: "Conditional debug: catch packets matching ACL 150.", mode: "privileged" },
  { command: "show ip access-lists 150", description: "Read the ACL hit counts — the smoking gun.", mode: "privileged" },
];

const SPAN_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "monitor session 1 source interface gi0/1 both", description: "Mirror Gi0/1 in both directions.", mode: "config" },
  { command: "monitor session 1 destination interface gi0/2", description: "Send the copy to the analyzer port.", mode: "config" },
  { command: "end", description: "Return to privileged EXEC.", mode: "config" },
  { command: "show monitor session 1", description: "Verify the session is live.", mode: "privileged" },
];

const SLA_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "ip sla 10", description: "Create probe operation 10.", mode: "config" },
  { command: "icmp-echo 203.0.113.1", description: "Probe the app server with ICMP echo.", mode: "config" },
  { command: "frequency 60", description: "Run every 60 seconds.", mode: "config" },
  { command: "ip sla schedule 10 life forever start-time now", description: "Start the probe now, forever.", mode: "config" },
  { command: "end", description: "Return to privileged EXEC.", mode: "config" },
  { command: "show ip sla statistics", description: "Read the RTT baseline.", mode: "privileged" },
];

const NETCONF_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "restconf", description: "Enable the RESTCONF service (HTTPS/443).", mode: "config" },
  { command: "end", description: "Return to privileged EXEC.", mode: "config" },
  { command: "show restconf interface gigabitethernet0/1", description: "GET the interface over YANG JSON.", mode: "privileged" },
];

const phaseHints: Record<string, string[]> = {
  diagnose: [
    "Start on R-CORE: enable, then prove the basics first.",
    "Ping = reachability, traceroute = path, show interface = link health.",
    "The interface shows heavy input errors — then the conditional debug names the exact culprit.",
    "Finish with show ip access-lists 150 — the hit count is the smoking gun.",
  ],
  flow: [
    "A flow record matches and counts; an exporter sends records to a collector.",
    "Flexible NetFlow counts flows — it never copies packets.",
    "The destination 203.0.113.50 with UDP 2055 is the collector — choose the export statement.",
  ],
  span: [
    "SPAN mirrors packets: a source port and a destination port.",
    "Monitor session 1: source gi0/1 both, destination gi0/2.",
    "Verify with show monitor session 1 after returning to privileged mode.",
  ],
  sla: [
    "IP SLA needs a probe (icmp-echo), a frequency, and a schedule.",
    "Define under ip sla 10, then schedule it to start now.",
    "Verify with show ip sla statistics — expect a low RTT baseline.",
  ],
  controller: [
    "Catalyst Center has a monitoring side (Assurance) and a config side.",
    "Design templates, provisioning, and compliance checks push and validate configuration.",
    "Choose the design/provision/compliance statement.",
  ],
  netconf: [
    "Enable the restconf service in config mode, then return to privileged EXEC.",
    "The GET returns YANG-modeled JSON — media type application/yang-data+json.",
    "Read the interface with show restconf interface gigabitethernet0/1.",
  ],
  "final-check": [
    "RESTCONF is RESTful HTTP — what port and data format did you just see?",
    "The response was JSON over HTTPS with YANG data.",
    "Choose the YANG-over-HTTPS statement.",
  ],
};

const phaseLabels = ["Diagnose", "NetFlow", "SPAN", "IP SLA", "Catalyst Center", "NETCONF/RESTCONF", "Final check"];

export default function SignalDetectiveMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: SignalDetectiveMissionState;
  onChange: (next: SignalDetectiveMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "final-check" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy["final-check"] : phaseCopy[activePhase];
  const cliPhase = complete || mission.phase === "diagnose" || mission.phase === "span" || mission.phase === "sla" || mission.phase === "netconf";
  const interpretSnippet = mission.phase === "flow" ? FLOW_CONFIG : null;
  const cliDevice = mission.phase === "sla" ? "R-EDGE" : "R-CORE";

  function choose(option: SignalFlowOption | SignalControllerOption | SignalNetconfOption) {
    if (mission.phase === "flow") onChange(chooseFlow(mission, option as SignalFlowOption));
    else if (mission.phase === "controller") onChange(chooseController(mission, option as SignalControllerOption));
    else onChange(chooseNetconf(mission, option as SignalNetconfOption));
  }

  const choices: SignalFlowOption[] | SignalControllerOption[] | SignalNetconfOption[] =
    mission.phase === "flow"
      ? flowChoices
      : mission.phase === "controller"
        ? controllerChoices
        : netconfChoices;

  const emptyText =
    mission.phase === "diagnose" ? (
      <>
        On <span className="text-slate-400">R-CORE</span>: <span className="text-slate-400">enable</span>, then <span className="text-slate-400">ping 10.20.0.1</span> → <span className="text-slate-400">traceroute 10.20.0.1</span> → <span className="text-slate-400">show interface gi0/1</span> → <span className="text-slate-400">debug ip packet access-list 150</span> → confirm with <span className="text-slate-400">show ip access-lists 150</span>.
      </>
    ) : mission.phase === "span" ? (
      <>
        On <span className="text-slate-400">R-CORE</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span>, mirror <span className="text-slate-400">gi0/1 both</span> to <span className="text-slate-400">gi0/2</span>, then <span className="text-slate-400">end</span> and verify with <span className="text-slate-400">show monitor session 1</span>.
      </>
    ) : mission.phase === "sla" ? (
      <>
        On <span className="text-slate-400">R-EDGE</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span>, define <span className="text-slate-400">ip sla 10</span> with <span className="text-slate-400">icmp-echo 203.0.113.1</span> and <span className="text-slate-400">frequency 60</span>, schedule it, then verify with <span className="text-slate-400">show ip sla statistics</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">R-CORE</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">restconf</span> → <span className="text-slate-400">end</span>, then read the interface with <span className="text-slate-400">show restconf interface gigabitethernet0/1</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Network Assurance" />
            <h1 className="mt-2 text-xl font-bold">The Signal Detective</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The finance app is crawling.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="Users on 10.20.0.0/24 report the finance app is barely usable. On R-CORE, work the diagnostic ladder to find what is eating the traffic, then build the telemetry so the next outage finds itself: NetFlow records, a SPAN mirror, an IP SLA probe, and a programmatic interface." /></p>
          </section>
          <MissionPrimer missionId="signal-detective" />
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
            <p className="mt-3"><GlossaryText text="Diagnose first: ping (reachability), traceroute (path), show interface (errors/load), conditional debug (exact culprit). Flexible NetFlow counts flows and exports records (UDP 2055); SPAN copies full packets to an analyzer; IP SLA probes latency on a schedule. Catalyst Center's Assurance monitors health; its design/provision/compliance workflows push config. NETCONF speaks YANG over SSH/830; RESTCONF serves YANG JSON/XML over HTTPS/443." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The case is closed." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You caught ACL 150 dropping the app's UDP/9999 traffic, then built the watch: NetFlow records, a SPAN mirror, an IP SLA baseline — and a RESTCONF API to manage it all programmatically." : copy.prompt} /></p>
              {complete && <NextMissionButton next={next} />}
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {interpretSnippet && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Configuration to interpret</p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/90 p-4 font-mono text-xs leading-6 text-emerald-200/90">{interpretSnippet}</pre>
            </div>
          )}

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to {cliDevice}</span>
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName={cliDevice}
                prompt={signalPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runSignalCommand(mission, command))}
                inputId="signal-detective-cli"
                emptyText={emptyText}
                completions={(mission.phase === "diagnose" ? DIAGNOSE_COMMANDS : mission.phase === "span" ? SPAN_COMMANDS : mission.phase === "sla" ? SLA_COMMANDS : NETCONF_COMMANDS).map((entry) => entry.command)}
              />
              <CommandReference
                commands={mission.phase === "diagnose" ? DIAGNOSE_COMMANDS : mission.phase === "span" ? SPAN_COMMANDS : mission.phase === "sla" ? SLA_COMMANDS : NETCONF_COMMANDS}
                title={mission.phase === "diagnose" ? "Diagnostic commands" : mission.phase === "span" ? "SPAN commands" : mission.phase === "sla" ? "IP SLA commands" : "RESTCONF commands"}
              />
            </div>
          )}

          {(mission.phase === "flow" || mission.phase === "controller" || mission.phase === "final-check") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {choices.map((option) => {
                const selected =
                  mission.phase === "flow"
                    ? mission.selectedFlow === option
                    : mission.phase === "controller"
                      ? mission.selectedController === option
                      : mission.selectedNetconf === option;
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 4.1 · 4.2 · 4.3 · 4.4 · 4.5 · 4.6 checkpoint</p><p className="mt-2 text-xl font-black">Diagnostics · NetFlow · SPAN · IP SLA · Catalyst Center · NETCONF/RESTCONF · +150 XP</p><p className="mt-2 text-sm text-slate-400">NetFlow: {mission.selectedFlow} · Catalyst Center: {mission.selectedController} · programmability: {mission.selectedNetconf}</p></div>}
        </section>
      </div>
    </main>
  );
}
