"use client";
import { Wordmark } from "@/components/wordmark";

import {
  chooseMulticast,
  chooseMulticastDrill,
  chooseNtp,
  chooseQos,
  EDGE_SERVICES_PHASES as PHASES,
  edgeServicesPromptFor,
  runEdgeServicesCommand,
  type EdgeServicesMissionState,
  type EdgeServicesMulticastDrillOption,
  type EdgeServicesMulticastOption,
  type EdgeServicesNtpOption,
  type EdgeServicesQosOption,
} from "@/lib/edge-services-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  qos: {
    label: "QoS · interpret · 1.4",
    title: "Read the WAN policy",
    prompt: "Voice is degrading on the WAN. Read the QoS configuration — which statement about it is correct?",
    output: null,
  },
  ntp: {
    label: "NTP / PTP · interpret · 3.3.a",
    title: "Keep the clock honest",
    prompt: "The branch router must keep accurate time for logs and authentication. Which statement about this time configuration is correct?",
    output: null,
  },
  "nat-config": {
    label: "NAT/PAT · configure & verify · 3.3.b",
    title: "Give the LAN an exit",
    prompt: "Hosts on 10.0.1.0/24 have no path to the internet. Configure PAT on R-EDGE so LAN flows share the WAN address 203.0.113.5 — then verify with show ip nat statistics.",
    output: null,
  },
  "nat-drill": {
    label: "NAT/PAT · verify · 3.3.b",
    title: "Watch PAT at work",
    prompt: "NAT is live and Host-A is mid-session on the web. Read the translation table and confirm LAN hosts are sharing one public address.",
    output: null,
  },
  multicast: {
    label: "Multicast · describe · 3.3.d",
    title: "One source, many ears",
    prompt: "The finance desk joins a multicast video feed. Which statement about multicast is correct?",
    output: null,
  },
} as const;

const qosChoices: EdgeServicesQosOption[] = ["voice-ef", "policy-marks", "policy-shapes"];
const ntpChoices: EdgeServicesNtpOption[] = ["source-lo", "steps-clock", "ptp-config"];
const multicastChoices: EdgeServicesMulticastOption[] = ["rpf-check", "spm-flood", "igmpv3-any"];
const multicastDrillChoices: EdgeServicesMulticastDrillOption[] = ["msdp-peers", "bidir-flood", "ssm-many"];

const optionCopy = {
  "voice-ef": { title: "Voice gets strict priority", note: "class VOICE matches DSCP EF; priority 1000 is LLQ" },
  "policy-marks": { title: "The policy marks voice as EF", note: "class-maps match; marking needs a set dscp command" },
  "policy-shapes": { title: "The policy shapes to 20 Mbps", note: "bandwidth guarantees a share; shaping uses shape average" },
  "source-lo": { title: "ntp source pins the source address", note: "Stable addressing survives WAN interface flaps" },
  "steps-clock": { title: "The clock steps immediately", note: "NTP slews gradually; prefer only weights server choice" },
  "ptp-config": { title: "This is a PTP boundary clock", note: "PTP needs boundary/transparent clocks — not shown" },
  "rpf-check": { title: "RPF forwards toward the source path", note: "Only if the packet arrives on the source-facing interface" },
  "spm-flood": { title: "PIM sparse mode floods everywhere", note: "Sparse mode builds shared trees with explicit joins" },
  "igmpv3-any": { title: "IGMPv3 joins are always any-source", note: "IGMPv3 adds source-specific (S,G) joins" },
  "msdp-peers": { title: "MSDP peers RPs across domains", note: "PIM-SM domains exchange source info over TCP 639" },
  "bidir-flood": { title: "Bidir PIM floods to every receiver", note: "Bidir uses one shared tree through the RP — flooding is dense mode" },
  "ssm-many": { title: "SSM suits many-to-many groups", note: "SSM is one-to-many: source-specific (S,G) trees via IGMPv3" },
} as const;

const QOS_CONFIG = [
  "class-map match-any VOICE",
  "  match dscp ef",
  "policy-map WAN-EDGE",
  "  class VOICE",
  "    priority 1000",
  "  class class-default",
  "    bandwidth 20000",
  "    fair-queue",
  "interface gi0/1",
  "  service-policy output WAN-EDGE",
].join("\n");

const NTP_CONFIG = [
  "ntp server 192.0.2.10 prefer",
  "ntp source Loopback0",
  "ntp authentication-key 10 md5 c1scoNTP",
  "ntp authenticate",
  "ntp trusted-key 10",
].join("\n");

const phaseHints: Record<string, string[]> = {
  qos: [
    "The class-map matches traffic; the policy-map acts on it.",
    "priority is strict-priority queueing; bandwidth is a guaranteed share.",
    "The VOICE class matches DSCP EF and gets priority 1000 — no marking or shaping anywhere.",
  ],
  ntp: [
    "ntp source gives NTP packets a stable origin address.",
    "NTP corrects the clock gradually — and prefer only picks the server.",
    "This is plain NTP, not PTP — choose the source command statement.",
  ],
  "nat-config": [
    "Start on R-EDGE: enable, configure terminal.",
    "Mark inside (gi0/0) and outside (gi0/1), permit the LAN with an ACL, then enable overload.",
    "Verify with show ip nat statistics — expect active translations.",
  ],
  "nat-drill": [
    "The drill starts on a fresh console: enable first.",
    "One command proves the point: show ip nat translations.",
    "Look for many inside locals sharing one inside global (203.0.113.5).",
  ],
  multicast: [
    "Think about how multicast prevents loops and who asks for the stream.",
    "RPF is the loop guard; sparse mode uses joins; IGMPv3 is source-aware.",
    "Choose the statement about the RPF check.",
    "The family drill: SSM is one-to-many (S,G) trees; bidir PIM is one shared tree through the RP; MSDP peers RPs between separate PIM-SM domains.",
  ],
};

const NAT_CONFIG_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface gi0/0", description: "Enter the LAN-facing (inside) interface.", mode: "config" },
  { command: "ip nat inside", description: "Mark gi0/0 as the NAT inside interface.", mode: "interface" },
  { command: "interface gi0/1", description: "Enter the WAN-facing (outside) interface.", mode: "config" },
  { command: "ip nat outside", description: "Mark gi0/1 as the NAT outside interface.", mode: "interface" },
  { command: "access-list 1 permit 10.0.1.0 0.0.0.255", description: "Permit the LAN subnet for translation.", mode: "global config" },
  { command: "ip nat inside source list 1 interface gi0/1 overload", description: "Enable PAT: overload the WAN address.", mode: "global config" },
  { command: "show ip nat statistics", description: "Verify translations are active.", mode: "privileged" },
];

const NAT_DRILL_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "show ip nat translations", description: "Read the live translation table.", mode: "privileged" },
];

const phaseLabels = ["QoS policy", "Time sync", "NAT/PAT config", "Translation drill", "Multicast"];

export default function EdgeServicesMission({
  mission,
  onChange,
  onExit,
}: {
  mission: EdgeServicesMissionState;
  onChange: (next: EdgeServicesMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "multicast" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.multicast : phaseCopy[activePhase];
  const cliPhase = mission.phase === "nat-config" || mission.phase === "nat-drill";
  const interpretSnippet = mission.phase === "qos" ? QOS_CONFIG : mission.phase === "ntp" ? NTP_CONFIG : null;

  // The family drill unlocks only on the correct RPF answer — a wrong Q1 leaves
  // selectedMulticast holding a wrong value, so Q1 must stay visible for the retry.
  const multicastDrillActive = mission.phase === "multicast" && mission.selectedMulticast === "rpf-check";

  function choose(option: EdgeServicesQosOption | EdgeServicesNtpOption | EdgeServicesMulticastOption | EdgeServicesMulticastDrillOption) {
    if (mission.phase === "qos") onChange(chooseQos(mission, option as EdgeServicesQosOption));
    else if (mission.phase === "ntp") onChange(chooseNtp(mission, option as EdgeServicesNtpOption));
    else if (multicastDrillActive) onChange(chooseMulticastDrill(mission, option as EdgeServicesMulticastDrillOption));
    else onChange(chooseMulticast(mission, option as EdgeServicesMulticastOption));
  }

  const emptyText =
    mission.phase === "nat-config" ? (
      <>
        On <span className="text-slate-400">R-EDGE</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span>, mark <span className="text-slate-400">gi0/0</span> inside and <span className="text-slate-400">gi0/1</span> outside, permit the LAN with <span className="text-slate-400">access-list 1</span>, enable <span className="text-slate-400">ip nat inside source list 1 interface gi0/1 overload</span>, then verify with <span className="text-slate-400">show ip nat statistics</span>.
      </>
    ) : (
      <>
        <span className="text-slate-400">enable</span>, then read the live table with <span className="text-slate-400">show ip nat translations</span> — many inside locals, one shared global address.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Architecture + Infrastructure" />
            <h1 className="mt-2 text-xl font-bold">Edge Services</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The branch goes live today.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="Three services must be ready on the edge router: the WAN QoS policy protecting voice, an accurate clock for logs and authentication, and NAT so 10.0.1.x hosts can reach the internet. Interpret the configs, build PAT, and prove it with the translation table." /></p>
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
            <p className="mt-3"><GlossaryText text="QoS: class-maps classify (match DSCP), policy-maps act (priority = strict LLQ queue, bandwidth = guaranteed share), service-policy attaches them. NTP syncs over UDP/123 and slews; ntp source pins the address; PTP is the hardware-timestamped alternative. NAT translates private→public; PAT overloads one address with ports. Multicast: RPF is the loop guard, PIM builds trees, IGMPv2 joins groups, IGMPv3 joins sources. The family: SSM builds (S,G) trees for one-to-many; bidir PIM uses one shared tree through the RP for many-to-many; MSDP peers RPs so separate PIM-SM domains share sources." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The edge is ready." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You read the QoS policy and clock config correctly, built PAT so the whole LAN shares one public address, and proved it with live translations." : copy.prompt} /></p>
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
                {mission.phase === "nat-drill" ? (
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">NAT live — Host-A browsing the web</span>
                ) : (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to R-EDGE</span>
                )}
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName="R-EDGE"
                prompt={edgeServicesPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runEdgeServicesCommand(mission, command))}
                inputId="edge-services-cli"
                emptyText={emptyText}
              />
              <CommandReference commands={mission.phase === "nat-config" ? NAT_CONFIG_COMMANDS : NAT_DRILL_COMMANDS} title={mission.phase === "nat-config" ? "NAT/PAT console commands" : "Translation drill commands"} />
            </div>
          )}

          {!complete && !cliPhase && (
            <>
              {multicastDrillActive && (
                <div className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Follow-up · the multicast family</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">RPF is confirmed. Now complete the picture — SSM, bidir PIM, and MSDP. Which statement about them is correct?</p>
                </div>
              )}
              <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
                {(mission.phase === "qos" ? qosChoices : mission.phase === "ntp" ? ntpChoices : multicastDrillActive ? multicastDrillChoices : multicastChoices).map((option) => {
                  const selected = mission.phase === "qos"
                    ? mission.selectedQos === option
                    : mission.phase === "ntp"
                      ? mission.selectedNtp === option
                      : multicastDrillActive
                        ? mission.selectedMulticastDrill === option
                        : mission.selectedMulticast === option;
                  return (
                    <button aria-pressed={selected} className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={option} onClick={() => choose(option)} type="button">
                      <p className="text-sm font-bold">{optionCopy[option].title}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{optionCopy[option].note}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <div className="mt-4 space-y-3" aria-live="polite">
              {mission.eventLog.map((entry, index) => <div className="flex gap-3 text-sm" key={`${entry.message}-${index}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} /><span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span></div>)}
            </div>
          </div>

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 1.4 · 3.3.a · 3.3.b · 3.3.d checkpoint</p><p className="mt-2 text-xl font-black">QoS · NTP/PTP · NAT/PAT · Multicast · +150 XP</p><p className="mt-2 text-sm text-slate-400">QoS: {mission.selectedQos} · clock: {mission.selectedNtp} · NAT/PAT: configured &amp; verified · multicast: {mission.selectedMulticast} · family: {mission.selectedMulticastDrill ?? "—"}</p></div>}
        </section>
      </div>
    </main>
  );
}
