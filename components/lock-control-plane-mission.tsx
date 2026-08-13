"use client";
import { Wordmark } from "@/components/wordmark";

import {
  chooseCopp,
  chooseDesign,
  chooseIacl,
  chooseRest,
  LOCK_PHASES as PHASES,
  lockPromptFor,
  runLockCommand,
  type LockCoppOption,
  type LockControlPlaneMissionState,
  type LockDesignOption,
  type LockIaclOption,
  type LockRestOption,
} from "@/lib/lock-control-plane-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  local: {
    label: "Device access · configure · 5.1.a",
    title: "Lock the door",
    prompt: "The attacker guessed the VTY password. On R-BR, create a real user with a secret, make the VTY lines authenticate locally, and allow SSH only — then verify.",
  },
  aaa: {
    label: "AAA · configure · 5.1.b",
    title: "Centralize authentication",
    prompt: "One router's password database is not enough. Enable AAA on R-BR, point it at the ISE RADIUS server, and set the login method — then verify.",
  },
  iacl: {
    label: "Infrastructure ACL · interpret · 5.2.a",
    title: "Who may touch the device?",
    prompt: "An infrastructure ACL is going inbound on the external interface. Which statement about an iACL is correct?",
  },
  copp: {
    label: "CoPP · interpret · 5.2.b",
    title: "Police the control plane",
    prompt: "The control plane took the blast. Which statement about Control Plane Policing (CoPP) is correct?",
  },
  rest: {
    label: "REST API security · interpret · 5.3",
    title: "Secure the API",
    prompt: "The branch will be managed programmatically. Which statement about securing REST APIs is correct?",
  },
  design: {
    label: "Security design · predict · 5.4.a–d",
    title: "Defense in depth",
    prompt: "Endpoint security, next-generation firewalls, TrustSec, and MACsec all have a seat at the table. Which statement ties the design together?",
  },
} as const;

const iaclChoices: LockIaclOption[] = ["permit-mgmt-deny", "permit-all", "only-bgp"];
const coppChoices: LockCoppOption[] = ["copp-protects", "copp-blocks-https", "copp-replaces-acl"];
const restChoices: LockRestOption[] = ["api-key-https", "api-plaintext", "api-open"];
const designChoices: LockDesignOption[] = ["layered-defense", "macsec-l3", "trustsec-8021x"];

const optionCopy = {
  "permit-mgmt-deny": { title: "Permit management, deny the rest", note: "Inbound to the device: only allowed peers and mgmt flows" },
  "permit-all": { title: "Permit all inbound", note: "That defeats the whole point of the iACL" },
  "only-bgp": { title: "Only BGP is permitted", note: "SSH/NTP/OSPF peers belong in the ACL too" },
  "copp-protects": { title: "Polices control-plane traffic", note: "Rates matched classes, drops what exceeds" },
  "copp-blocks-https": { title: "Blocks HTTPS by default", note: "Management classes are admitted, not blocked" },
  "copp-replaces-acl": { title: "Replaces the infrastructure ACL", note: "ACL filters reach; CoPP rates the control plane" },
  "api-key-https": { title: "TLS + API keys, role-based", note: "HTTPS everywhere, authenticated and authorized" },
  "api-plaintext": { title: "Plaintext is fine for LANs", note: "Plaintext leaks credentials to anyone on the path" },
  "api-open": { title: "Open APIs are easiest", note: "An open API is an unauthenticated control channel" },
  "layered-defense": { title: "Endpoint + NGFW + TrustSec + MACsec", note: "Each layer covers the one below it" },
  "macsec-l3": { title: "MACsec replaces the firewall", note: "MACsec encrypts L2 links; the NGFW inspects L3+" },
  "trustsec-8021x": { title: "TrustSec is an 802.1X protocol", note: "TrustSec enforces with SGT tags, not 802.1X" },
} as const;

const LOCAL_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on R-BR.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "username admin secret C1scoBranch!", description: "Create a local user with a secret (not a weak password).", mode: "config" },
  { command: "line vty 0 4", description: "Enter the five VTY (remote access) lines.", mode: "config" },
  { command: "login local", description: "Authenticate VTY sessions against the local database.", mode: "config" },
  { command: "transport input ssh", description: "Accept SSH only — lock out Telnet.", mode: "config" },
  { command: "end", description: "Return to privileged EXEC.", mode: "config" },
  { command: "show running-config | include line vty", description: "Verify the VTY lines are locked down.", mode: "privileged" },
];

const AAA_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on R-BR.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "aaa new-model", description: "Enable AAA — authentication now follows method lists.", mode: "config" },
  { command: "radius server ISE", description: "Define the ISE RADIUS server.", mode: "config" },
  { command: "address ipv4 10.1.1.10", description: "Point RADIUS at ISE (auth 1812 / acct 1813).", mode: "config" },
  { command: "key c1scoRADIUS", description: "Set the shared RADIUS secret.", mode: "config" },
  { command: "aaa authentication login default group radius local", description: "Try RADIUS first, fall back to local.", mode: "config" },
  { command: "end", description: "Return to privileged EXEC.", mode: "config" },
  { command: "show aaa servers", description: "Verify ISE is ALIVE and answering.", mode: "privileged" },
];

const phaseHints: Record<string, string[]> = {
  local: [
    "Start on R-BR: enable, then configure terminal.",
    "Create the user with a secret, then lock the VTY lines: login local + transport input ssh.",
    "Verify from privileged mode: show running-config | include line vty.",
  ],
  aaa: [
    "Enable AAA first — aaa new-model.",
    "Define the RADIUS server: radius server ISE, its address, and the shared key.",
    "Set the login method, then verify with show aaa servers — expect Status: ALIVE.",
  ],
  iacl: [
    "An iACL sits inbound on external interfaces, protecting the device itself.",
    "It permits the management and control flows, then denies everything else aimed at the router.",
    "Choose the permit-management-then-deny statement.",
  ],
  copp: [
    "CoPP attaches to the control-plane interface, not a data interface.",
    "Matched classes get a police rate; excess is dropped before it burns CPU.",
    "Choose the control-plane policing statement.",
  ],
  rest: [
    "REST APIs must run over TLS and authenticate callers.",
    "API keys or tokens, role-based authorization, rate limiting.",
    "Choose the TLS + API keys statement.",
  ],
  design: [
    "The four pieces protect different layers: endpoints, apps, traffic tags, links.",
    "MACsec = Layer 2; NGFW = application inspection; TrustSec = SGT policy.",
    "Choose the defense-in-depth statement.",
  ],
};

const phaseLabels = ["Local auth", "AAA + RADIUS", "iACL", "CoPP", "REST API", "Design"];

export default function LockControlPlaneMission({
  mission,
  onChange,
  onExit,
}: {
  mission: LockControlPlaneMissionState;
  onChange: (next: LockControlPlaneMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "design" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.design : phaseCopy[activePhase];
  const cliPhase = mission.phase === "local" || mission.phase === "aaa";

  function choose(option: LockIaclOption | LockCoppOption | LockRestOption | LockDesignOption) {
    if (mission.phase === "iacl") onChange(chooseIacl(mission, option as LockIaclOption));
    else if (mission.phase === "copp") onChange(chooseCopp(mission, option as LockCoppOption));
    else if (mission.phase === "rest") onChange(chooseRest(mission, option as LockRestOption));
    else onChange(chooseDesign(mission, option as LockDesignOption));
  }

  const choices: LockIaclOption[] | LockCoppOption[] | LockRestOption[] | LockDesignOption[] =
    mission.phase === "iacl"
      ? iaclChoices
      : mission.phase === "copp"
        ? coppChoices
        : mission.phase === "rest"
          ? restChoices
          : designChoices;

  const emptyText =
    mission.phase === "local" ? (
      <>
        On <span className="text-slate-400">R-BR</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span>, create <span className="text-slate-400">username admin secret C1scoBranch!</span>, lock <span className="text-slate-400">line vty 0 4</span> with <span className="text-slate-400">login local</span> and <span className="text-slate-400">transport input ssh</span>, then verify with <span className="text-slate-400">show running-config | include line vty</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">R-BR</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span>, <span className="text-slate-400">aaa new-model</span>, define <span className="text-slate-400">radius server ISE</span> with its <span className="text-slate-400">address</span> and <span className="text-slate-400">key</span>, set <span className="text-slate-400">aaa authentication login default group radius local</span>, then verify with <span className="text-slate-400">show aaa servers</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Security" />
            <h1 className="mt-2 text-xl font-bold">Lock the Control Plane</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">A guessed password started this.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="The branch router was hit through a weak VTY password, and the control plane took the blast. Lock it down layer by layer: a real local user with a secret, AAA against ISE, an infrastructure ACL, CoPP on the control plane, a secure REST API — then the full defense-in-depth picture." /></p>
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
            <p className="mt-3"><GlossaryText text="Device access: username + secret, login local, transport input ssh. AAA: aaa new-model + a RADIUS/TACACS+ server, method lists (group radius local). iACLs permit only management/control flows inbound to the device. CoPP polices traffic destined to the control plane. REST APIs need TLS, API keys/tokens, and role-based authorization. Defense in depth: endpoint security (NAC/AV), NGFWs (application inspection), TrustSec (SGT tags → policy), MACsec (L2 encryption)." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The plane is locked." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You locked the VTY door, centralized auth with AAA + ISE, blocked the infrastructure from the outside, policed the control plane, secured the API — and saw how endpoint security, NGFW, TrustSec, and MACsec finish the job." : copy.prompt} /></p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to R-BR</span>
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName="R-BR"
                prompt={lockPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runLockCommand(mission, command))}
                inputId="lock-control-plane-cli"
                emptyText={emptyText}
              />
              <CommandReference commands={mission.phase === "local" ? LOCAL_COMMANDS : AAA_COMMANDS} title={mission.phase === "local" ? "Local authentication commands" : "AAA + RADIUS commands"} />
            </div>
          )}

          {(mission.phase === "iacl" || mission.phase === "copp" || mission.phase === "rest" || mission.phase === "design") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {choices.map((option) => {
                const selected =
                  mission.phase === "iacl"
                    ? mission.selectedIacl === option
                    : mission.phase === "copp"
                      ? mission.selectedCopp === option
                      : mission.phase === "rest"
                        ? mission.selectedRest === option
                        : mission.selectedDesign === option;
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 5.1.a · 5.1.b · 5.2.a · 5.2.b · 5.3 · 5.4.a–d checkpoint</p><p className="mt-2 text-xl font-black">Device access · AAA · iACL · CoPP · REST security · Defense in depth · +200 XP</p><p className="mt-2 text-sm text-slate-400">iACL: {mission.selectedIacl} · CoPP: {mission.selectedCopp} · REST: {mission.selectedRest} · design: {mission.selectedDesign}</p></div>}
        </section>
      </div>
    </main>
  );
}
