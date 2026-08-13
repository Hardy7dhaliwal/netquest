"use client";
import { Wordmark } from "@/components/wordmark";

import {
  CAMPUS_PHASES as PHASES,
  campusPromptFor,
  chooseInterop,
  chooseLisp,
  chooseRoles,
  runCampusCommand,
  type CampusFabricMissionState,
  type CampusInteropOption,
  type CampusLispOption,
  type CampusRolesOption,
} from "@/lib/campus-fabric-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  roles: {
    label: "SD-Access roles · interpret · 1.3.a",
    title: "Who runs the fabric?",
    prompt: "The campus runs an SD-Access fabric with edge nodes, border nodes, and a control plane node. Which statement about the roles is correct?",
  },
  lisp: {
    label: "LISP · inspect · 2.3.a",
    title: "Read the EID-to-RLOC database",
    prompt: "Open a console on the control plane node (CP-1) and inspect the LISP sessions, the map-cache, and the site database. Then answer the checkpoint.",
  },
  "lisp-check": {
    label: "LISP · inspect · 2.3.a",
    title: "What does the map-cache hold?",
    prompt: "You inspected the control plane: two EID prefixes, each mapped to an RLOC. Which statement about the map-cache is correct?",
  },
  interop: {
    label: "Legacy interop · predict · 1.3.b",
    title: "The two worlds meet",
    prompt: "The legacy (non-fabric) network still needs to reach fabric hosts. Which statement about how the two worlds interoperate is correct?",
  },
} as const;

const rolesChoices: CampusRolesOption[] = ["cp-lisp", "edge-hosts", "edge-border"];
const lispChoices: CampusLispOption[] = ["eid-rloc", "rloc-route", "lisp-bgp"];
const interopChoices: CampusInteropOption[] = ["border-fusion", "vxlan-only", "no-access"];

const optionCopy = {
  "cp-lisp": { title: "Control plane node runs LISP", note: "Map-server/map-resolver hold the EID→RLOC database" },
  "edge-hosts": { title: "Edge nodes hold the database", note: "Edges register their hosts — the database is central" },
  "edge-border": { title: "Edge + border are the planes", note: "Both are data plane — the mapping brain is separate" },
  "eid-rloc": { title: "EID prefix → RLOC binding", note: "The map-cache resolves host prefixes to tunnel endpoints" },
  "rloc-route": { title: "A routing table for RLOCs", note: "The cache is EID-to-RLOC, not a RIB" },
  "lisp-bgp": { title: "BGP table from the underlay", note: "LISP maps; BGP/OSPF route the underlay" },
  "border-fusion": { title: "Border node + fusion router", note: "Advertises fabric prefixes outward, ingests external routes" },
  "vxlan-only": { title: "Legacy hosts run VXLAN", note: "VXLAN is inside the fabric — the border translates" },
  "no-access": { title: "Legacy hosts cannot reach the fabric", note: "They can — through the border node" },
} as const;

const LISP_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on the control plane node.", mode: "user EXEC" },
  { command: "show lisp session", description: "Confirm the LISP control-plane sessions are UP.", mode: "privileged" },
  { command: "show lisp map-cache", description: "Read the EID→RLOC bindings the edge nodes learned.", mode: "privileged" },
  { command: "show lisp site", description: "List registered sites, EID prefixes, and RLOCs.", mode: "privileged" },
];

const phaseHints: Record<string, string[]> = {
  roles: [
    "Three fabric node roles: edge, border, and control plane.",
    "The control plane node runs LISP's map-server and map-resolver.",
    "Choose the statement about the control plane node holding the mapping database.",
  ],
  lisp: [
    "Start on CP-1: enable, then inspect with the show commands.",
    "Read all three: sessions, map-cache, then the site database.",
    "The map-cache binds each EID prefix to its edge-node RLOC.",
  ],
  "lisp-check": [
    "Look back at the map-cache output you just read.",
    "EIDs are the hosts; RLOCs are the fabric switches that encapsulate.",
    "The cache resolves EID prefixes to RLOCs — choose that statement.",
  ],
  interop: [
    "Legacy hosts cannot speak LISP or VXLAN.",
    "The border node meets the legacy world and advertises fabric prefixes.",
    "The fusion router provides shared services — choose the border + fusion statement.",
  ],
};

const phaseLabels = ["Fabric roles", "LISP inspect", "Map-cache check", "Legacy interop"];

export default function CampusFabricMission({
  mission,
  onChange,
  onExit,
}: {
  mission: CampusFabricMissionState;
  onChange: (next: CampusFabricMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "interop" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.interop : phaseCopy[activePhase];
  const cliPhase = mission.phase === "lisp";

  function choose(option: CampusRolesOption | CampusLispOption | CampusInteropOption) {
    if (mission.phase === "roles") onChange(chooseRoles(mission, option as CampusRolesOption));
    else if (mission.phase === "lisp-check") onChange(chooseLisp(mission, option as CampusLispOption));
    else onChange(chooseInterop(mission, option as CampusInteropOption));
  }

  const choices: CampusRolesOption[] | CampusLispOption[] | CampusInteropOption[] =
    mission.phase === "roles" ? rolesChoices : mission.phase === "lisp-check" ? lispChoices : interopChoices;

  const emptyText = (
    <>
      On <span className="text-slate-400">CP-1</span>: <span className="text-slate-400">enable</span>, then read the mapping database with <span className="text-slate-400">show lisp session</span>, <span className="text-slate-400">show lisp map-cache</span>, and <span className="text-slate-400">show lisp site</span>.
    </>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Architecture + Virtualization" />
            <h1 className="mt-2 text-xl font-bold">The Campus Fabric</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The fabric meets the old campus.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="The new campus runs an SD-Access fabric: edge nodes serve the hosts, a border node faces the outside, and a control plane node keeps the LISP mapping database. Map the roles, inspect the EID-to-RLOC bindings on CP-1, then predict how the legacy network reaches fabric hosts." /></p>
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
            <p className="mt-3"><GlossaryText text="SD-Access roles: edge node (connects hosts, encapsulates/decapsulates), border node (faces external networks), control plane node (LISP map-server/map-resolver — the EID-to-RLOC database). In LISP, EIDs are endpoints and RLOCs are fabric tunnel endpoints; the map-cache resolves EID → RLOC so an edge can encapsulate. Legacy interop: the border advertises fabric prefixes outward (BGP/OSPF) and ingests external routes, with a fusion router for shared services and route leaking." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The fabric is whole." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You mapped the SD-Access roles, read the LISP EID-to-RLOC database on the control plane node, and predicted exactly how the legacy network reaches fabric hosts through the border node and fusion router." : copy.prompt} /></p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to CP-1</span>
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName="CP-1"
                prompt={campusPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runCampusCommand(mission, command))}
                inputId="campus-fabric-cli"
                emptyText={emptyText}
              />
              <CommandReference commands={LISP_COMMANDS} title="LISP control plane commands" />
            </div>
          )}

          {(mission.phase === "roles" || mission.phase === "lisp-check" || mission.phase === "interop") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {choices.map((option) => {
                const selected =
                  mission.phase === "roles"
                    ? mission.selectedRoles === option
                    : mission.phase === "lisp-check"
                      ? mission.selectedLisp === option
                      : mission.selectedInterop === option;
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 1.3.a · 1.3.b · 2.3.a checkpoint</p><p className="mt-2 text-xl font-black">SD-Access roles · LISP map-cache · Legacy interop · +100 XP</p><p className="mt-2 text-sm text-slate-400">roles: {mission.selectedRoles} · map-cache: {mission.selectedLisp} · interop: {mission.selectedInterop}</p></div>}
        </section>
      </div>
    </main>
  );
}
