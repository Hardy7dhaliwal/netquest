"use client";
import { Wordmark } from "@/components/wordmark";

import {
  chooseBenefit,
  chooseOmp,
  choosePlanes,
  chooseTlocs,
  SDWAN_PHASES as PHASES,
  sdwanPromptFor,
  runSdwanCommand,
  type SdwanBenefitOption,
  type SdwanMissionState,
  type SdwanOmpOption,
  type SdwanPlanesOption,
  type SdwanTlocsOption,
} from "@/lib/sdwan-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  planes: {
    label: "SD-WAN planes · interpret · 1.2.a",
    title: "Who does what in the fabric?",
    prompt: "The branch is joining a Catalyst SD-WAN fabric with vManage, vSmart, vBond, and vEdge. Which statement about the planes is correct?",
  },
  omp: {
    label: "OMP · interpret · 1.2.a",
    title: "Read what OMP carries",
    prompt: "This is what OMP advertises between vSmart and a vEdge. Which statement about an OMP route is correct?",
  },
  tlocs: {
    label: "Data plane · inspect · 1.2.a",
    title: "Verify the vEdge",
    prompt: "Open a console on the branch vEdge and inspect the TLOCs, the BFD sessions, and the control connections. Then answer the checkpoint.",
  },
  "tlocs-check": {
    label: "Data plane · inspect · 1.2.a",
    title: "What moves the packets?",
    prompt: "You verified TLOCs, BFD, and the control connections. Which statement about the data plane is correct?",
  },
  benefit: {
    label: "SD-WAN benefits · interpret · 1.2.b",
    title: "The tradeoff",
    prompt: "The CFO asks whether SD-WAN is worth it. Which statement about Catalyst SD-WAN benefits and limitations is correct?",
  },
} as const;

const planesChoices: SdwanPlanesOption[] = ["control-omp", "data-vsmart", "mgmt-vbond"];
const ompChoices: SdwanOmpOption[] = ["omp-tloc-attr", "full-table", "transit-traffic"];
const tlocsChoices: SdwanTlocsOption[] = ["tlocs-forward", "tlocs-routes", "bfd-replaces-omp"];
const benefitChoices: SdwanBenefitOption[] = ["benefit-transport", "limit-complexity", "limit-no-overlay"];

const optionCopy = {
  "control-omp": { title: "OMP is the control plane", note: "Runs between vSmart and the vEdges over DTLS" },
  "data-vsmart": { title: "vSmart forwards packets", note: "vSmart reflects routes and policy — vEdges forward" },
  "mgmt-vbond": { title: "vBond manages the fabric", note: "vBond orchestrates; vManage manages" },
  "omp-tloc-attr": { title: "Prefix + TLOC + attributes", note: "Control-plane info, not the full routing table" },
  "full-table": { title: "The full routing table", note: "OMP reflects prefixes — never the whole table" },
  "transit-traffic": { title: "User packets ride OMP", note: "OMP is signaling; data flows in GRE/IPsec tunnels" },
  "tlocs-forward": { title: "TLOCs are what forwarding uses", note: "BFD watches them and triggers failover" },
  "tlocs-routes": { title: "TLOCs replace OMP routes", note: "Routes reference TLOCs — both stay" },
  "bfd-replaces-omp": { title: "BFD replaces OMP", note: "BFD monitors; OMP still builds routes" },
  "benefit-transport": { title: "Transport independence + central control", note: "Any WAN joins; OMP picks the best path" },
  "limit-complexity": { title: "Complexity is a benefit", note: "Complexity is the real limitation — not a win" },
  "limit-no-overlay": { title: "Overlay complexity is avoidable", note: "The overlay is the point — cost is the limit" },
} as const;

const OMP_ROUTES = [
  "vEdge# show omp routes vpn 1",
  "Code: C -> chosen, I -> installed, R -> resolved",
  "",
  "VPN PREFIX      FROM PEER  ID  LABEL  STATUS  TYPE        TLOC IP     COLOR         ENCAP   PREFERENCE",
  "1   10.20.0.0/24  10.1.0.3  31  1002   C,I,R   installed   10.70.70.1  biz-internet  ipsec   -",
  "1   0.0.0.0/0     10.1.0.3  29  1002   C,I,R   installed   10.70.70.1  biz-internet  ipsec   -",
].join("\n");

const VEDGE_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on the vEdge.", mode: "user EXEC" },
  { command: "show omp tlocs", description: "List the TLOCs — tunnel endpoints with color/encap and BFD status.", mode: "privileged" },
  { command: "show bfd sessions", description: "Check BFD liveness on each WAN transport.", mode: "privileged" },
  { command: "show control connections", description: "Confirm the DTLS control connections to vSmart/vManage/vBond.", mode: "privileged" },
];

const phaseHints: Record<string, string[]> = {
  planes: [
    "OMP runs between the vSmart controllers and the vEdge routers.",
    "vManage is the management plane (UI/APIs); vBond does orchestration.",
    "Control plane = OMP. Choose the OMP statement.",
  ],
  omp: [
    "An OMP route bundles a prefix with the TLOC that can reach it.",
    "OMP is a route reflector over a secure channel — not the full table.",
    "Choose the prefix + TLOC + attributes read.",
  ],
  tlocs: [
    "Start on the vEdge console: enable, then inspect with the show commands.",
    "Read the TLOC table, the BFD sessions, then the control connections — all three.",
    "The control connection to vSmart should be up (DTLS).",
  ],
  "tlocs-check": [
    "Look back at the TLOC table and the BFD sessions you just read.",
    "TLOCs identify the tunnel endpoints; BFD watches them.",
    "Routes reference TLOCs — the data plane forwards over the TLOCs.",
  ],
  benefit: [
    "The headline benefit is using ANY transport as one overlay.",
    "SD-WAN's real limitations are cost and operational complexity.",
    "Choose the benefit statement — transport independence.",
  ],
};

const phaseLabels = ["Planes", "OMP routes", "vEdge inspect", "Data plane check", "Benefits"];

export default function SdwanMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: SdwanMissionState;
  onChange: (next: SdwanMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "benefit" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.benefit : phaseCopy[activePhase];
  const cliPhase = mission.phase === "tlocs";
  const interpretSnippet = mission.phase === "omp" ? OMP_ROUTES : null;

  function choose(option: SdwanPlanesOption | SdwanOmpOption | SdwanTlocsOption | SdwanBenefitOption) {
    if (mission.phase === "planes") onChange(choosePlanes(mission, option as SdwanPlanesOption));
    else if (mission.phase === "omp") onChange(chooseOmp(mission, option as SdwanOmpOption));
    else if (mission.phase === "tlocs-check") onChange(chooseTlocs(mission, option as SdwanTlocsOption));
    else onChange(chooseBenefit(mission, option as SdwanBenefitOption));
  }

  const choices: SdwanPlanesOption[] | SdwanOmpOption[] | SdwanTlocsOption[] | SdwanBenefitOption[] =
    mission.phase === "planes"
      ? planesChoices
      : mission.phase === "omp"
        ? ompChoices
        : mission.phase === "tlocs-check"
          ? tlocsChoices
          : benefitChoices;

  const emptyText = (
    <>
      On <span className="text-slate-400">vEdge</span>: <span className="text-slate-400">enable</span>, then read the tunnel endpoints with <span className="text-slate-400">show omp tlocs</span>, liveness with <span className="text-slate-400">show bfd sessions</span>, and the control plane with <span className="text-slate-400">show control connections</span>.
    </>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Architecture" />
            <h1 className="mt-2 text-xl font-bold">SD-WAN: The WAN Overlay</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The branch joins the overlay.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="The branch WAN is being rebuilt with Catalyst SD-WAN: cloud controllers (vManage — now branded SD-WAN Manager — plus vSmart and vBond, the SD-WAN Validator) and a vEdge on site. Map the planes, read what OMP advertises, then verify the vEdge's TLOCs, BFD, and control connections — and decide whether the tradeoff is worth it." /></p>
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
            <p className="mt-3"><GlossaryText text="Catalyst SD-WAN planes: vManage (now SD-WAN Manager) = management (UI/APIs), vSmart = control (OMP route reflection + policy), vBond (now SD-WAN Validator) = orchestration (authentication + address resolution), vEdge/cEdge = data plane. OMP advertises prefixes with their TLOC over a secure DTLS/TLS channel. A TLOC (system IP + color + encapsulation) is the tunnel endpoint the data plane forwards over; BFD watches TLOCs for fast failover. Benefits: transport independence, centralized policy, app-aware paths. Limits: cost, controller dependency, overlay complexity." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The overlay is live." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You mapped the SD-WAN planes, read OMP routes as prefix + TLOC + attributes, verified the vEdge's TLOCs, BFD, and control connections — and weighed the benefit against the cost." : copy.prompt} /></p>
              {complete && <NextMissionButton next={next} />}
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {interpretSnippet && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">OMP output to interpret</p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/90 p-4 font-mono text-xs leading-6 text-emerald-200/90">{interpretSnippet}</pre>
            </div>
          )}

          {cliPhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to vEdge</span>
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName="vEdge"
                prompt={sdwanPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runSdwanCommand(mission, command))}
                inputId="sdwan-cli"
                emptyText={emptyText}
                completions={VEDGE_COMMANDS.map((entry) => entry.command)}
              />
              <CommandReference commands={VEDGE_COMMANDS} title="vEdge inspection commands" />
            </div>
          )}

          {(mission.phase === "planes" || mission.phase === "omp" || mission.phase === "tlocs-check" || mission.phase === "benefit") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {choices.map((option) => {
                const selected =
                  mission.phase === "planes"
                    ? mission.selectedPlanes === option
                    : mission.phase === "omp"
                      ? mission.selectedOmp === option
                      : mission.phase === "tlocs-check"
                        ? mission.selectedTlocs === option
                        : mission.selectedBenefit === option;
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 1.2.a · 1.2.b checkpoint</p><p className="mt-2 text-xl font-black">SD-WAN planes · OMP/TLOC · Benefits &amp; limitations · +100 XP</p><p className="mt-2 text-sm text-slate-400">planes: {mission.selectedPlanes} · OMP: {mission.selectedOmp} · data plane: {mission.selectedTlocs} · benefit: {mission.selectedBenefit}</p></div>}
        </section>
      </div>
    </main>
  );
}
