"use client";
import { useState } from "react";
import { Wordmark } from "@/components/wordmark";

import {
  chooseCheckpoint,
  TUNNEL_VISION_PHASES as PHASES,
  tunnelPromptFor,
  runTunnelCommand,
  type TunnelCheckpointOption,
  type TunnelVisionMissionState,
} from "@/lib/tunnel-vision-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";
import { MissionPrimer } from "@/components/mission-primer";
import { NetworkMap } from "@/components/network-map";
import { MissionProgress, PhaseReviewModal, type PhaseReviewContent } from "@/components/phase-review";

const phaseCopy = {
  vrf: {
    label: "VRF · configure · 2.2.a",
    title: "Isolate the guests",
    prompt: "Give the guest LAN its own routing table on R-BR: define VRF GUEST, bind Gi0/1 (remember what vrf forwarding does to its IP), then verify.",
  },
  gre: {
    label: "GRE · configure · 2.2.b",
    title: "Tunnel the overlay",
    prompt: "Build the GRE tunnel to HQ (203.0.113.1) so the private overlay can cross the internet, then verify it is up.",
  },
  ipsec: {
    label: "IPsec · configure · 2.2.b",
    title: "Encrypt the tunnel",
    prompt: "Configure IKE phase 1 on R-BR: the ISAKMP policy, the pre-shared key for HQ, and the transform set.",
  },
  cryptomap: {
    label: "Crypto map · configure & verify · 2.2.b",
    title: "Decide what gets encrypted",
    prompt: "Build the crypto map that protects the GRE flow, lock it to the WAN interface, then verify the security association is active.",
  },
  checkpoint: {
    label: "Checkpoint · 2.2.b",
    title: "What does the map protect?",
    prompt: "The crypto map uses match address 101. What must ACL 101 match for GRE-over-IPsec to work?",
  },
} as const;

const checkpointChoices: TunnelCheckpointOption[] = ["outer-gre", "inner-ip", "auto-all"];

const optionCopy = {
  "outer-gre": { title: "The GRE flow between the WAN endpoints", note: "permit gre host 198.51.100.2 host 203.0.113.1 — protocol 47" },
  "inner-ip": { title: "The private subnets inside the tunnel", note: "That is the pattern for plain crypto-map VPNs without GRE" },
  "auto-all": { title: "Nothing — IPsec encrypts everything by default", note: "A crypto map only protects what its ACL matches" },
} as const;

const phaseHints: Record<string, string[]> = {
  vrf: [
    "Guests must stop sharing the corporate routing table — they get their own VRF.",
    "vrf forwarding on Gi0/1 strips its IP address, so restore it right after.",
    "On R-BR: enable → configure terminal → vrf definition GUEST → rd 65000:20 → interface gi0/1 → vrf forwarding GUEST → ip address 192.168.20.1 255.255.255.0 → show vrf brief.",
  ],
  gre: [
    "The tunnel rides inside the WAN interface (gi0/0) toward HQ at 203.0.113.1.",
    "Four commands build it: ip address, tunnel source, tunnel destination, tunnel mode gre ip.",
    "Verify with show interface tunnel 0 — expect 'up, line protocol is up' and GRE/IP.",
  ],
  ipsec: [
    "Phase 1 needs a policy, a pre-shared key for the peer, and a transform set.",
    "Complete the policy: encryption aes 256, authentication pre-share, hash sha256, group 14.",
    "crypto isakmp policy 10 → four lines → exit → crypto isakmp key c1scoHQ address 203.0.113.1 → crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac.",
  ],
  cryptomap: [
    "The ACL decides what IPsec protects — for GRE-over-IPsec it must match GRE (protocol 47) between the WAN IPs.",
    "crypto map CMAP 10 ipsec-isakmp → set peer → set transform-set → match address 101 → exit → interface gi0/0 → crypto map CMAP.",
    "Verify with show crypto ipsec sa — expect ACTIVE SAS and packet counters.",
  ],
  checkpoint: [
    "IPsec only encrypts what the crypto map's ACL matches.",
    "The tunnel carries GRE packets — the outer protocol is 47, not the inner IPs.",
    "Choose the ACL that matches the GRE flow between the WAN endpoints.",
  ],
};

const VRF_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "vrf definition GUEST", description: "Create the guest VRF.", mode: "config" },
  { command: "rd 65000:20", description: "Give the VRF its route distinguisher.", mode: "VRF" },
  { command: "interface gi0/1", description: "Enter the guest LAN port.", mode: "config" },
  { command: "vrf forwarding GUEST", description: "Bind the port to the VRF — strips its IP address.", mode: "interface" },
  { command: "ip address 192.168.20.1 255.255.255.0", description: "Re-add the address inside the VRF.", mode: "interface" },
  { command: "show vrf brief", description: "Verify GUEST exists with its interface.", mode: "privileged" },
];

const GRE_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface tunnel 0", description: "Create the overlay tunnel.", mode: "config" },
  { command: "ip address 10.99.0.2 255.255.255.252", description: "Address the tunnel on the overlay subnet.", mode: "interface" },
  { command: "tunnel source gi0/0", description: "The WAN interface carrying the tunnel.", mode: "interface" },
  { command: "tunnel destination 203.0.113.1", description: "The HQ WAN address.", mode: "interface" },
  { command: "tunnel mode gre ip", description: "GRE encapsulation over IPv4.", mode: "interface" },
  { command: "show interface tunnel 0", description: "Verify the tunnel is up.", mode: "privileged" },
];

const IPSEC_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "crypto isakmp policy 10", description: "Create IKE phase 1 policy 10.", mode: "config" },
  { command: "encryption aes 256", description: "Phase 1 encryption.", mode: "ISAKMP policy" },
  { command: "authentication pre-share", description: "Phase 1 authentication method.", mode: "ISAKMP policy" },
  { command: "hash sha256", description: "Phase 1 integrity.", mode: "ISAKMP policy" },
  { command: "group 14", description: "Phase 1 Diffie-Hellman group.", mode: "ISAKMP policy" },
  { command: "crypto isakmp key c1scoHQ address 203.0.113.1", description: "Pre-shared key for the HQ peer.", mode: "config" },
  { command: "crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac", description: "Phase 2 transform set (explicit 256-bit).", mode: "config" },
];

const CRYPTOMAP_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "access-list 101 permit gre host 198.51.100.2 host 203.0.113.1", description: "Match the GRE flow between WAN endpoints.", mode: "config" },
  { command: "crypto map CMAP 10 ipsec-isakmp", description: "Create the crypto map.", mode: "config" },
  { command: "set peer 203.0.113.1", description: "The HQ peer.", mode: "crypto map" },
  { command: "set transform-set TS", description: "Use the esp-256-aes transform set.", mode: "crypto map" },
  { command: "match address 101", description: "Protect whatever ACL 101 matches.", mode: "crypto map" },
  { command: "interface gi0/0", description: "Enter the WAN interface.", mode: "config" },
  { command: "crypto map CMAP", description: "Apply the map to the WAN.", mode: "interface" },
  { command: "show crypto ipsec sa", description: "Verify ACTIVE SAS and counters.", mode: "privileged" },
];

const phaseLabels = ["VRF isolation", "GRE tunnel", "IKE phase 1", "Crypto map", "Checkpoint"];

export default function TunnelVisionMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: TunnelVisionMissionState;
  onChange: (next: TunnelVisionMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "checkpoint" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.checkpoint : phaseCopy[activePhase];
  const cliPhase = complete || mission.phase === "vrf" || mission.phase === "gre" || mission.phase === "ipsec" || mission.phase === "cryptomap";

  const [reviewPhase, setReviewPhase] = useState<string | null>(null);
  const reviewContent: PhaseReviewContent | null = reviewPhase
    ? (() => {
        const copy = phaseCopy[reviewPhase as keyof typeof phaseCopy];
        const answer =
          reviewPhase === "checkpoint" && mission.selectedCheckpoint ? optionCopy[mission.selectedCheckpoint].title : null;
        const commands =
          reviewPhase === "vrf"
            ? VRF_COMMANDS
            : reviewPhase === "gre"
              ? GRE_COMMANDS
              : reviewPhase === "ipsec"
                ? IPSEC_COMMANDS
                : reviewPhase === "cryptomap"
                  ? CRYPTOMAP_COMMANDS
                  : undefined;
        return { label: copy.label, title: copy.title, prompt: copy.prompt, output: (copy as { output?: string | null }).output ?? null, answer, commands };
      })()
    : null;

  function choose(option: TunnelCheckpointOption) {
    onChange(chooseCheckpoint(mission, option));
  }

  const emptyText =
    mission.phase === "vrf" ? (
      <>
        On <span className="text-slate-400">R-BR</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">vrf definition GUEST</span> → <span className="text-slate-400">rd 65000:20</span> → <span className="text-slate-400">interface gi0/1</span> → <span className="text-slate-400">vrf forwarding GUEST</span> (strips the IP!) → re-add <span className="text-slate-400">ip address 192.168.20.1 255.255.255.0</span> → verify with <span className="text-slate-400">show vrf brief</span>.
      </>
    ) : mission.phase === "gre" ? (
      <>
        On <span className="text-slate-400">R-BR</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span> → <span className="text-slate-400">interface tunnel 0</span> → add the IP, <span className="text-slate-400">tunnel source gi0/0</span>, <span className="text-slate-400">tunnel destination 203.0.113.1</span>, <span className="text-slate-400">tunnel mode gre ip</span> → verify with <span className="text-slate-400">show interface tunnel 0</span>.
      </>
    ) : mission.phase === "ipsec" ? (
      <>
        On <span className="text-slate-400">R-BR</span>: <span className="text-slate-400">crypto isakmp policy 10</span> (encryption, authentication, hash, group) → <span className="text-slate-400">crypto isakmp key c1scoHQ address 203.0.113.1</span> → <span className="text-slate-400">crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">R-BR</span>: build <span className="text-slate-400">ACL 101</span> (permit gre to HQ), <span className="text-slate-400">crypto map CMAP 10 ipsec-isakmp</span> (peer, transform-set, match address), apply it on <span className="text-slate-400">gi0/0</span>, then verify with <span className="text-slate-400">show crypto ipsec sa</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Virtualization + Architecture" />
            <h1 className="mt-2 text-xl font-bold">Tunnel Vision</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The wire is tapped.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="The branch (R-BR, WAN 198.51.100.2) talks to HQ (WAN 203.0.113.1) across the internet in plaintext — anyone on the path can read it — and guest traffic (192.168.20.0/24) shares the corporate segment. Isolate the guests with a VRF, then build an encrypted GRE-over-IPsec tunnel (10.99.0.0/30) so the private overlay crosses safely." /></p>
          </section>
          <MissionPrimer missionId="tunnel-vision" />
          <NetworkMap missionId="tunnel-vision" />
          <MissionProgress labels={phaseLabels} phaseIndex={phaseIndex} phases={PHASES} onReview={setReviewPhase} />
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="VRF gives each tenant its own routing table; vrf forwarding on an interface strips its IP, so re-add it. GRE encapsulates the private overlay and can carry multicast and routing protocols; IPsec encrypts it. A crypto map protects only what its ACL matches — for GRE-over-IPsec that is the GRE flow (protocol 47) between the WAN endpoints, not the inner subnets." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The overlay is sealed." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You isolated the guests in VRF GUEST, ran the overlay through a GRE tunnel, and encrypted it end to end with an IPsec crypto map." : copy.prompt} /></p>
              {complete && <NextMissionButton next={next} />}
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
                prompt={tunnelPromptFor(mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runTunnelCommand(mission, command))}
                inputId="tunnel-cli"
                emptyText={emptyText}
                completions={(mission.phase === "vrf" ? VRF_COMMANDS : mission.phase === "gre" ? GRE_COMMANDS : mission.phase === "ipsec" ? IPSEC_COMMANDS : CRYPTOMAP_COMMANDS).map((entry) => entry.command)}
              />
              <CommandReference
                commands={mission.phase === "vrf" ? VRF_COMMANDS : mission.phase === "gre" ? GRE_COMMANDS : mission.phase === "ipsec" ? IPSEC_COMMANDS : CRYPTOMAP_COMMANDS}
                title={mission.phase === "vrf" ? "VRF commands" : mission.phase === "gre" ? "GRE tunnel commands" : mission.phase === "ipsec" ? "IKE phase 1 commands" : "Crypto map commands"}
              />
            </div>
          )}

          {!complete && mission.phase === "checkpoint" && (
            <div aria-label="Choose what the crypto map protects" className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {checkpointChoices.map((option) => {
                const selected = mission.selectedCheckpoint === option;
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 2.2.a · 2.2.b checkpoint</p><p className="mt-2 text-xl font-black">VRF · GRE · IPsec · +150 XP</p><p className="mt-2 text-sm text-slate-400">VRF: GUEST on Gi0/1 · tunnel: Tunnel0 up (GRE/IP) · IPsec: esp-256-aes ACTIVE · map: CMAP protects GRE (protocol 47)</p></div>}
        </section>
      </div>
      <PhaseReviewModal content={reviewContent} onClose={() => setReviewPhase(null)} phase={reviewPhase} />
    </main>
  );
}
