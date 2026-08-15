"use client";
import { Wordmark } from "@/components/wordmark";

import {
  chooseHypervisor,
  chooseVm,
  chooseVswitch,
  chooseVxlan,
  FABRIC_PHASES as PHASES,
  fabricPromptFor,
  runFabricCommand,
  type FabricExpressMissionState,
  type FabricHypervisorOption,
  type FabricVmOption,
  type FabricVswitchOption,
  type FabricVxlanOption,
} from "@/lib/fabric-express-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  hypervisor: {
    label: "Hypervisors · interpret · 2.1.a",
    title: "Who runs the hardware?",
    prompt: "The new workloads run on ESXi — a hypervisor installed straight onto the server. Which statement about it is correct?",
  },
  vm: {
    label: "Virtual machines · inspect · 2.1.b",
    title: "Read the VM",
    prompt: "Here is the spec of one of the VMs. Which statement about it is correct?",
  },
  vswitch: {
    label: "Virtual switching · inspect · 2.1.c",
    title: "Inside the vSwitch",
    prompt: "Open a shell on the host and inspect the virtual switch — the vSwitch and its uplinks. Then answer the checkpoint.",
  },
  "vswitch-check": {
    label: "Virtual switching · inspect · 2.1.c",
    title: "Can the VM reach the wire?",
    prompt: "You inspected vSwitch0 and its uplinks. Which statement about VM connectivity is correct?",
  },
  vxlan: {
    label: "VXLAN · inspect · 2.3.b",
    title: "The overlay on the wire",
    prompt: "The fabric leaf carries the workloads in VXLAN. Inspect the VTEP — nve1, the VNI table, and the peers. Then answer the checkpoint.",
  },
  "vxlan-check": {
    label: "VXLAN · inspect · 2.3.b",
    title: "What does the VNI identify?",
    prompt: "You inspected the VTEP: nve1 maps VLAN 10 → VNI 10010 and VLAN 20 → VNI 10020. Which statement about the VNI is correct?",
  },
} as const;

const hypervisorChoices: FabricHypervisorOption[] = ["type1", "type2", "hosted"];
const vmChoices: FabricVmOption[] = ["virtual-hardware", "physical-risc", "vmdk-physical"];
const vswitchChoices: FabricVswitchOption[] = ["uplink-needed", "no-uplink", "uplink-unused"];
const vxlanChoices: FabricVxlanOption[] = ["l2-segment", "vlan-number", "vrf-name"];

const optionCopy = {
  "type1": { title: "ESXi is a Type 1 hypervisor", note: "Bare-metal — no host OS beneath it" },
  "type2": { title: "ESXi is a Type 2 hypervisor", note: "Type 2 runs as an app on a host OS" },
  "hosted": { title: "ESXi is a hosted hypervisor", note: "Hosted IS Type 2 — it needs a host OS" },
  "virtual-hardware": { title: "vCPU, memory, vNIC — all virtual", note: "Backed by the host, scheduled by the hypervisor" },
  "physical-risc": { title: "The vNIC is a physical adapter", note: "vNICs plug into a vSwitch, not a physical port" },
  "vmdk-physical": { title: "The disk is a physical drive", note: "A vmdk is a file on the datastore" },
  "uplink-needed": { title: "An uplink carries VM traffic out", note: "vmnic0 (Up) connects the vSwitch to the NIC" },
  "no-uplink": { title: "The vSwitch has no uplink", note: "It does — vmnic0 is Up in the output" },
  "uplink-unused": { title: "Uplinks only serve management", note: "vmnic1 is Down, but vmnic0 carries VM traffic" },
  "l2-segment": { title: "A Layer 2 segment identifier", note: "The VXLAN overlay's 24-bit VLAN equivalent" },
  "vlan-number": { title: "The same as the VLAN number", note: "VLAN 10 maps to VNI 10010 — deliberately distinct" },
  "vrf-name": { title: "A routing-table (VRF) name", note: "VRFs isolate routing; VNIs identify L2 segments" },
} as const;

const HYPERVISOR_BLURB = [
  "The new workloads run on ESXi, installed directly on the bare metal — no host OS beneath it.",
  "Type 1 (bare-metal) hypervisors own every resource: ESXi, KVM, Hyper-V.",
  "Type 2 hypervisors are applications on a host OS: VirtualBox, VMware Workstation.",
].join("\n");

const VM_CONFIG = [
  "name: app-web-01",
  "cpu: 4 vCPU",
  "memory: 8 GB",
  "network:",
  "  - adapter: vmxnet3",
  "    connected: VM Network",
  "disk:",
  "  - size: 40 GB",
  "    file: [datastore1] app-web-01/app-web-01.vmdk",
  "guest-os: ubuntu-22.04",
].join("\n");

const VSWITCH_COMMANDS = [
  { command: "enable", description: "Enter privileged mode on the host.", mode: "user EXEC" },
  { command: "esxcli network vswitch standard list", description: "List the standard vSwitch and its port groups.", mode: "privileged" },
  { command: "esxcli network vswitch standard uplink list", description: "List the physical NICs bound as uplinks.", mode: "privileged" },
];

const VXLAN_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on the leaf.", mode: "user EXEC" },
  { command: "show running-config interface nve1", description: "Read the VTEP: source, VNIs, segment mapping.", mode: "privileged" },
  { command: "show vxlan vni", description: "List VNI → VLAN mappings and peer addresses.", mode: "privileged" },
  { command: "show nve peers", description: "Confirm the remote VTEP peers are Up.", mode: "privileged" },
];

const phaseHints: Record<string, string[]> = {
  hypervisor: [
    "ESXi installs straight onto the hardware — there is nothing between it and the CPU.",
    "Type 2 hypervisors (VirtualBox, Workstation) sit on top of a host OS.",
    "Bare-metal = Type 1. Choose the Type 1 statement.",
  ],
  vm: [
    "Read the config as the hypervisor sees it: every resource is virtual.",
    "vCPU and memory are carved out of the host and scheduled by the hypervisor.",
    "The vNIC is virtual NIC hardware that plugs into a vSwitch — choose that read.",
  ],
  vswitch: [
    "Start on the host shell: enable, then inspect with the esxcli commands.",
    "List the vSwitch, then list its uplinks — you need both reads.",
    "One uplink is Up; one is Down. That detail matters for the checkpoint.",
  ],
  "vswitch-check": [
    "Look back at the uplink list: vmnic0 is Up, vmnic1 is Down.",
    "A vSwitch with no connected uplink is an island — VMs could never leave the host.",
    "The working uplink is what carries VM frames onto the physical network.",
  ],
  vxlan: [
    "Start on the leaf console: enable, then read nve1, the VNI table, and the peers.",
    "Note the mapping: vlan 10 → vn-segment 10010. The numbers are different on purpose.",
    "Two remote VTEPs (192.0.2.11, 192.0.2.12) are Up on nve1.",
  ],
  "vxlan-check": [
    "A VNI is the overlay's segment number — the Layer 2 identity inside VXLAN.",
    "The config keeps VLANs and VNIs distinct: VLAN 10 rides VNI 10010.",
    "VNIs identify Layer 2 segments; VRFs are a Layer 3 routing concept.",
  ],
};

const phaseLabels = ["Hypervisors", "Virtual machines", "vSwitch", "vSwitch check", "VXLAN", "VXLAN check"];

export default function FabricExpressMission({
  mission,
  onChange,
  onExit,
  next,
}: {
  mission: FabricExpressMissionState;
  onChange: (next: FabricExpressMissionState) => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "vxlan-check" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy["vxlan-check"] : phaseCopy[activePhase];
  const cliPhase = mission.phase === "vswitch" || mission.phase === "vxlan";
  const interpretSnippet = mission.phase === "vm" ? VM_CONFIG : mission.phase === "hypervisor" ? HYPERVISOR_BLURB : null;
  const cliDevice = mission.phase === "vswitch" ? "HOST-1" : "LEAF-1";

  function choose(
    option: FabricHypervisorOption | FabricVmOption | FabricVswitchOption | FabricVxlanOption,
  ) {
    if (mission.phase === "hypervisor") onChange(chooseHypervisor(mission, option as FabricHypervisorOption));
    else if (mission.phase === "vm") onChange(chooseVm(mission, option as FabricVmOption));
    else if (mission.phase === "vswitch-check") onChange(chooseVswitch(mission, option as FabricVswitchOption));
    else onChange(chooseVxlan(mission, option as FabricVxlanOption));
  }

  const choices: FabricHypervisorOption[] | FabricVmOption[] | FabricVswitchOption[] | FabricVxlanOption[] =
    mission.phase === "hypervisor"
      ? hypervisorChoices
      : mission.phase === "vm"
        ? vmChoices
        : mission.phase === "vswitch-check"
          ? vswitchChoices
          : vxlanChoices;

  const emptyText =
    mission.phase === "vswitch" ? (
      <>
        On <span className="text-slate-400">HOST-1</span>: <span className="text-slate-400">enable</span>, then read the vSwitch with <span className="text-slate-400">esxcli network vswitch standard list</span> and the uplinks with <span className="text-slate-400">esxcli network vswitch standard uplink list</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">LEAF-1</span>: <span className="text-slate-400">enable</span>, then read the VTEP with <span className="text-slate-400">show running-config interface nve1</span>, <span className="text-slate-400">show vxlan vni</span>, and <span className="text-slate-400">show nve peers</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Virtualization" />
            <h1 className="mt-2 text-xl font-bold">The Fabric Express</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The workloads went virtual.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="The data center is moving from bare-metal servers to VMs on a Type 1 hypervisor — and the network has to follow. Read the VM, inspect the vSwitch inside the host, then check the VXLAN overlay that carries the fabric between leaves." /></p>
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
            <p className="mt-3"><GlossaryText text="Type 1 hypervisors (ESXi, KVM) own the hardware; Type 2 (VirtualBox, Workstation) run on a host OS. A VM's vCPU/memory/vNIC are virtual hardware backed by the host. A vSwitch is a virtual switch inside the hypervisor — its uplinks are physical NICs, and without one VMs are isolated. VXLAN wraps Layer 2 frames in UDP (port 4789); a VNI is the 24-bit overlay segment ID, and the VTEP (nve1) does the encapsulation." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The overlay is clear." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You read the hypervisor and the VM correctly, inspected the vSwitch and its uplinks, and traced the VXLAN overlay from the VTEP to its peers." : copy.prompt} /></p>
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
                prompt={fabricPromptFor(mission.cliMode, mission.phase)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runFabricCommand(mission, command))}
                inputId="fabric-express-cli"
                emptyText={emptyText}
              />
              <CommandReference commands={mission.phase === "vswitch" ? VSWITCH_COMMANDS : VXLAN_COMMANDS} title={mission.phase === "vswitch" ? "vSwitch inspection commands" : "VTEP inspection commands"} />
            </div>
          )}

          {(mission.phase === "hypervisor" || mission.phase === "vm" || mission.phase === "vswitch-check" || mission.phase === "vxlan-check") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {choices.map((option) => {
                const selected =
                  mission.phase === "hypervisor"
                    ? mission.selectedHypervisor === option
                    : mission.phase === "vm"
                      ? mission.selectedVm === option
                      : mission.phase === "vswitch-check"
                        ? mission.selectedVswitch === option
                        : mission.selectedVxlan === option;
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

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 2.1.a · 2.1.b · 2.1.c · 2.3.b checkpoint</p><p className="mt-2 text-xl font-black">Hypervisors · Virtual machines · Virtual switching · VXLAN · +100 XP</p><p className="mt-2 text-sm text-slate-400">hypervisor: {mission.selectedHypervisor} · VM: {mission.selectedVm} · vSwitch: {mission.selectedVswitch} · VXLAN: {mission.selectedVxlan}</p></div>}
        </section>
      </div>
    </main>
  );
}
