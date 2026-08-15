import { iosHelpForMode } from "./ios-help";

export type FabricStatus = "not_started" | "in_progress" | "complete";
export type FabricPhase = "hypervisor" | "vm" | "vswitch" | "vswitch-check" | "vxlan" | "vxlan-check" | "complete";
export type FabricCliMode = "user" | "privileged";
export type FabricHypervisorOption = "type1" | "type2" | "hosted";
export type FabricVmOption = "virtual-hardware" | "physical-risc" | "vmdk-physical";
export type FabricVswitchOption = "no-uplink" | "uplink-needed" | "uplink-unused";
export type FabricVxlanOption = "l2-segment" | "vlan-number" | "vrf-name";

export type FabricEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type FabricCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const FABRIC_PHASES: Exclude<FabricPhase, "complete">[] = ["hypervisor", "vm", "vswitch", "vswitch-check", "vxlan", "vxlan-check"];

export type FabricExpressMissionState = {
  status: FabricStatus;
  phase: FabricPhase;
  cliMode: FabricCliMode;
  cliHistory: FabricCliEntry[];
  // vswitch phase (ESXi shell inspection)
  vsListed: boolean;
  uplinkListed: boolean;
  // vxlan phase (leaf switch inspection)
  nveInspected: boolean;
  vniListed: boolean;
  nvePeersSeen: boolean;
  selectedHypervisor: FabricHypervisorOption | null;
  selectedVm: FabricVmOption | null;
  selectedVswitch: FabricVswitchOption | null;
  selectedVxlan: FabricVxlanOption | null;
  attempts: number;
  eventLog: FabricEvent[];
};

export const FABRIC_EXPECTED = {
  hypervisor: "type1",
  vm: "virtual-hardware",
  vswitch: "uplink-needed",
  vxlan: "l2-segment",
} as const;

export const INITIAL_FABRIC_EXPRESS_MISSION: FabricExpressMissionState = {
  status: "not_started",
  phase: "hypervisor",
  cliMode: "user",
  cliHistory: [],
  vsListed: false,
  uplinkListed: false,
  nveInspected: false,
  vniListed: false,
  nvePeersSeen: false,
  selectedHypervisor: null,
  selectedVm: null,
  selectedVswitch: null,
  selectedVxlan: null,
  attempts: 0,
  eventLog: [],
};

export function fabricPromptFor(mode: FabricCliMode, phase?: FabricPhase) {
  const device = phase === "vxlan" || phase === "vxlan-check" ? "LEAF-1" : "HOST-1";
  if (mode === "user") return `${device}>`;
  return `${device}#`;
}

export function vswitchInspected(state: FabricExpressMissionState) {
  return state.vsListed && state.uplinkListed;
}

export function vxlanInspected(state: FabricExpressMissionState) {
  return state.nveInspected && state.vniListed && state.nvePeersSeen;
}

export function resetFabricExpressMission(): FabricExpressMissionState {
  return { ...INITIAL_FABRIC_EXPRESS_MISSION, cliHistory: [], eventLog: [] };
}

export function startFabricExpressMission(): FabricExpressMissionState {
  return {
    ...resetFabricExpressMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. Workloads are moving off physical servers and into VMs — and the network has to follow them. Work out how virtualization shapes the data path, then inspect the vSwitch and the VXLAN overlay that carries the new fabric.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: FabricExpressMissionState,
  message: string,
  tone: FabricEvent["tone"],
  updates: Partial<FabricExpressMissionState> = {},
): FabricExpressMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function vswitchList(): string {
  return [
    "Name     Num Ports   Used Ports  Configured Ports  MTU    Uplinks",
    "vSwitch0 128        4          128               1500   vmnic0",
    "  PortGroups:",
    "    Management Network",
    "    VM Network",
  ].join("\n");
}

function uplinkList(): string {
  return [
    "Uplink     Adapter  Link    Speed   Duplex",
    "vmnic0     vmnic0   Up      10000   Full",
    "vmnic1     vmnic1   Down    -       -",
  ].join("\n");
}

function nveConfig(): string {
  return [
    "interface nve1",
    "  source-interface Loopback0",
    "  host-reachability protocol BGP",
    "  member vni 10010",
    "    ingress-replication",
    "  member vni 10020",
    "    ingress-replication",
    "!",
    "vlan 10",
    "  vn-segment 10010",
    "vlan 20",
    "  vn-segment 10020",
  ].join("\n");
}

function vniTable(): string {
  return [
    "VNI      VRF          VLAN        Peer-addr       State",
    "10010    -            10          192.0.2.11      Up",
    "10020    -            20          192.0.2.12      Up",
  ].join("\n");
}

function nvePeers(): string {
  return [
    "Peer-VTEP         State  Interface  Uptime",
    "192.0.2.11        Up     nve1       2w3d",
    "192.0.2.12        Up     nve1       2w3d",
  ].join("\n");
}

export function runFabricCommand(state: FabricExpressMissionState, rawCommand: string): FabricExpressMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "vswitch" || state.phase === "vxlan";
  if (!command || state.status === "complete" || !cliPhase) return state;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "vswitch"
        ? "Commands: enable, esxcli network vswitch standard list, esxcli network vswitch standard uplink list, exit, help"
        : "Commands: enable, show running-config interface nve1, show vxlan vni, show nve peers, exit, help";
  } else if (command === "exit") {
    nextMode = "user";
  } else if (command === "end") {
    nextMode = "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.phase === "vswitch" && (command === "esxcli network vswitch standard list" || command === "esxcli network vswitch standard uplink list")) {
    output = command === "esxcli network vswitch standard list" ? vswitchList() : uplinkList();
    next = command === "esxcli network vswitch standard list" ? { ...state, vsListed: true } : { ...state, uplinkListed: true };
  } else if (state.phase === "vxlan" && state.cliMode === "privileged" && command === "show running-config interface nve1") {
    output = nveConfig();
    next = { ...state, nveInspected: true };
  } else if (state.phase === "vxlan" && state.cliMode === "privileged" && command === "show vxlan vni") {
    output = vniTable();
    next = { ...state, vniListed: true };
  } else if (state.phase === "vxlan" && state.cliMode === "privileged" && command === "show nve peers") {
    output = nvePeers();
    next = { ...state, nvePeersSeen: true };
  } else if (state.phase === "vxlan" && command.startsWith("show ")) {
    output = state.cliMode === "user" ? "Type enable to enter privileged EXEC on LEAF-1, then run the show command." : "Run show commands from privileged EXEC — type exit first if you are in user mode.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: fabricPromptFor(state.cliMode, state.phase) }];

  if (next.phase === "vswitch" && vswitchInspected(next)) {
    return {
      ...next,
      phase: "vswitch-check",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "vSwitch0 inspected — the VMs live behind one virtual switch with a single uplink. One quick check before the overlay: can a VM actually reach the physical network?", tone: "success" },
      ],
    };
  }

  if (next.phase === "vxlan" && vxlanInspected(next)) {
    return {
      ...next,
      phase: "vxlan-check",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The VTEP is live — nve1 carries VNI 10010 and 10020 to two remote peers. Last check: what does a VNI actually identify?", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseHypervisor(state: FabricExpressMissionState, selected: FabricHypervisorOption): FabricExpressMissionState {
  if (state.status === "complete" || state.phase !== "hypervisor") return state;

  return selected === FABRIC_EXPECTED.hypervisor
    ? recordChoice(
        state,
        "Correct. ESXi is a Type 1 (bare-metal) hypervisor — it installs directly on the hardware with no host OS in between, so it owns all CPU, memory, and I/O. Type 2 hypervisors run as applications on top of a host OS.",
        "success",
        { phase: "vm", selectedHypervisor: selected },
      )
    : recordChoice(
        state,
        selected === "type2"
          ? "VirtualBox is the classic Type 2 — it runs as an application on top of a host OS. ESXi installs straight onto the server hardware with nothing beneath it."
          : "A hosted hypervisor IS a Type 2 — it depends on a host OS. ESXi has no host OS: it is the operating system.",
        "error",
        { selectedHypervisor: selected },
      );
}

export function chooseVm(state: FabricExpressMissionState, selected: FabricVmOption): FabricExpressMissionState {
  if (state.status === "complete" || state.phase !== "vm") return state;

  return selected === FABRIC_EXPECTED.vm
    ? recordChoice(
        state,
        "Correct. Everything in the VM — vCPU, memory, vNIC — is virtual hardware backed by the hypervisor, which carves it out of the host's physical resources and schedules it fairly across VMs. The vNIC plugs into a vSwitch, not a physical port.",
        "success",
        { phase: "vswitch", selectedVm: selected },
      )
    : recordChoice(
        state,
        selected === "physical-risc"
          ? "The vNIC is not a physical adapter — it is virtual NIC hardware emulated by the hypervisor, and it connects into a vSwitch, not a physical switch port."
          : "The vmdk is a virtual disk file on the datastore, not a physical drive — the hypervisor presents it to the VM as a disk.",
        "error",
        { selectedVm: selected },
      );
}

export function chooseVswitch(state: FabricExpressMissionState, selected: FabricVswitchOption): FabricExpressMissionState {
  if (state.status === "complete" || state.phase !== "vswitch-check" || !vswitchInspected(state)) return state;

  return selected === FABRIC_EXPECTED.vswitch
    ? recordChoice(
        state,
        "Correct. Without an uplink, the vSwitch is a closed island: VMs can talk to each other, but no frame ever reaches the physical NIC — and a VM can only reach the physical network if the vSwitch has a connected uplink like vmnic0.",
        "success",
        { phase: "vxlan", selectedVswitch: selected },
      )
    : recordChoice(
        state,
        selected === "no-uplink"
          ? "The vSwitch here HAS an uplink — vmnic0 is Up. The question is what that uplink is for: without it, VM traffic would never leave the hypervisor."
          : "vmnic1 being Down is a red herring — the working uplink is vmnic0. The real point is that SOME uplink must carry VM frames to the physical network.",
        "error",
        { selectedVswitch: selected },
      );
}

export function chooseVxlan(state: FabricExpressMissionState, selected: FabricVxlanOption): FabricExpressMissionState {
  if (state.status === "complete" || state.phase !== "vxlan-check") return state;
  if (!vxlanInspected(state)) return state;

  return selected === FABRIC_EXPECTED.vxlan
    ? recordChoice(
        state,
        "Correct. A VNI is the VXLAN segment identifier — a 24-bit Layer 2 segment ID, like a VLAN in the overlay. The config maps VLAN 10 to VNI 10010 and VLAN 20 to VNI 10020, and the VTEP (nve1) wraps those frames in UDP so the segments can span the physical network.",
        "success",
        { phase: "complete", status: "complete", selectedVxlan: selected },
      )
    : recordChoice(
        state,
        selected === "vlan-number"
          ? "A VLAN is a local Layer 2 domain; a VNI is the overlay segment ID. Notice the config keeps them distinct: vlan 10 maps to vn-segment 10010 — the numbers deliberately differ."
          : "VRFs isolate routing tables — they are not what VNI 10010 identifies. The config shows VNI 10010 tied to a VLAN, which is a Layer 2 segment in the VXLAN overlay.",
        "error",
        { selectedVxlan: selected },
      );
}

const INVALID = "% Invalid input detected at '^' marker.";
