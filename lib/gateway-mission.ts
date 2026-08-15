import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";
import { normalizeIosCommand } from "./ios-abbrev";

export type GatewayStatus = "not_started" | "in_progress" | "complete";
export type GatewayPhase = "design" | "ha" | "hsrp-config" | "failover" | "vrrp" | "complete";
export type GatewayCliMode = "user" | "privileged" | "config" | "config-if";
export type GatewayDevice = "GW1" | "GW2";
export type GatewayDesignOption = "collapsed-core-pair" | "three-tier-single" | "flat-single";
export type GatewayHaOption = "fhrp" | "stp" | "ecmp";
export type GatewayVrrpOption = "virtual-mac" | "same-mac" | "vrrp-no-preempt";

export type GatewayEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type GatewayCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const GATEWAY_PHASES: Exclude<GatewayPhase, "complete">[] = ["design", "ha", "hsrp-config", "failover", "vrrp"];

export type GatewayMissionState = {
  status: GatewayStatus;
  phase: GatewayPhase;
  /** Which router the single console is attached to (GW2 after the failover). */
  device: GatewayDevice;
  cliMode: GatewayCliMode;
  cliHistory: GatewayCliEntry[];
  standbyIpSet: boolean;
  standbyPrioritySet: boolean;
  standbyPreemptSet: boolean;
  hsrpVerified: boolean;
  gw1ShutDown: boolean;
  gw2Active: boolean;
  selectedDesign: GatewayDesignOption | null;
  selectedHa: GatewayHaOption | null;
  selectedVrrp: GatewayVrrpOption | null;
  attempts: number;
  eventLog: GatewayEvent[];
};

export const GATEWAY_EXPECTED = {
  design: "collapsed-core-pair",
  ha: "fhrp",
  vrrp: "virtual-mac",
} as const;

export const INITIAL_GATEWAY_MISSION: GatewayMissionState = {
  status: "not_started",
  phase: "design",
  device: "GW1",
  cliMode: "user",
  cliHistory: [],
  standbyIpSet: false,
  standbyPrioritySet: false,
  standbyPreemptSet: false,
  hsrpVerified: false,
  gw1ShutDown: false,
  gw2Active: false,
  selectedDesign: null,
  selectedHa: null,
  selectedVrrp: null,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";

export function gatewayPromptFor(mode: GatewayCliMode, device: GatewayDevice) {
  if (mode === "user") return `${device}>`;
  if (mode === "privileged") return `${device}#`;
  if (mode === "config") return `${device}(config)#`;
  return `${device}(config-if)#`;
}

export function hsrpConfigured(state: GatewayMissionState) {
  return state.standbyIpSet && state.standbyPrioritySet && state.standbyPreemptSet;
}

export function resetGatewayMission(): GatewayMissionState {
  return { ...INITIAL_GATEWAY_MISSION, cliHistory: [], eventLog: [] };
}

export function startGatewayMission(): GatewayMissionState {
  return {
    ...resetGatewayMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. Give the campus a gateway that cannot die: configure HSRP on the distribution pair, then prove the failover.", tone: "info" }],
  };
}

function recordChoice(
  state: GatewayMissionState,
  message: string,
  tone: GatewayEvent["tone"],
  updates: Partial<GatewayMissionState> = {},
): GatewayMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function standbySummary(state: GatewayMissionState, device: GatewayDevice): string {
  const onGw1 = device === "GW1";
  const active = onGw1 ? !state.gw1ShutDown : state.gw1ShutDown;
  const changes = onGw1 ? "2" : "3";
  const priorityLine = onGw1 ? "Priority 110 (configured 110)" : "Priority 100 (default 100)";
  const preemptLine = onGw1 ? "Preemption enabled" : "Preemption enabled";
  return [
    "GigabitEthernet0/1 - Group 1",
    `  State is ${active ? "Active" : "Standby"}`,
    `    ${changes} state changes, last state change ${onGw1 ? "01:02:14" : "00:00:08"}`,
    "  Virtual IP address is 10.30.0.1",
    "  Active virtual MAC address is 0000.0c07.ac01",
    "  Hello time 3 sec, hold time 10 sec",
    `  ${priorityLine}`,
    `  ${preemptLine}`,
  ].join("\n");
}

export function runGatewayCommand(state: GatewayMissionState, rawCommand: string): GatewayMissionState {
  const command = normalizeIosCommand(rawCommand);
  const cliPhase = state.phase === "hsrp-config" || state.phase === "failover";
  if (!command || state.status === "complete" || !cliPhase) return state;

  const didDo = tryRunDo(state, rawCommand, gatewayPromptFor(state.cliMode, state.device), runGatewayCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "hsrp-config"
        ? "Commands: enable, configure terminal, interface gi0/1, standby 1 ip 10.30.0.1, standby 1 priority 110, standby 1 preempt, show standby, end, exit, help"
        : state.device === "GW1"
          ? "Commands: show standby, configure terminal, interface gi0/1, shutdown, end, exit, help"
          : "Commands: enable, show standby, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config-if" ? "config" : state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.cliMode === "config" && command === "interface gi0/1") {
    nextMode = "config-if";
  } else if (state.phase === "hsrp-config" && state.cliMode === "config-if") {
    if (command === "standby 1 ip 10.30.0.1") {
      output = state.standbyIpSet ? "Virtual IP 10.30.0.1 already configured for group 1." : "HSRP group 1 virtual IP set to 10.30.0.1.";
      next = { ...state, standbyIpSet: true };
    } else if (command === "standby 1 priority 110") {
      output = state.standbyPrioritySet ? "Priority 110 already configured." : "Priority set to 110 — GW1 will be preferred for group 1.";
      next = { ...state, standbyPrioritySet: true };
    } else if (command === "standby 1 preempt") {
      output = state.standbyPreemptSet ? "Preemption already enabled." : "Preemption enabled — GW1 reclaims Active if it returns.";
      next = { ...state, standbyPreemptSet: true };
    } else if (command.startsWith("standby")) {
      output = "That standby command is not quite right — use the exact group commands: standby 1 ip 10.30.0.1, standby 1 priority 110, standby 1 preempt.";
    } else {
      output = INVALID;
    }
  } else if (state.phase === "hsrp-config" && state.cliMode === "privileged" && command === "show standby") {
    if (!hsrpConfigured(state)) {
      output = "Group 1 is not running.\nConfigure the virtual IP, priority, and preempt on Gi0/1 first.";
    } else {
      output = standbySummary(state, state.device);
      next = { ...state, hsrpVerified: true };
    }
  } else if (state.phase === "hsrp-config" && command === "show standby") {
    output = "Type end to return to privileged EXEC, then verify with show standby.";
  } else if (state.phase === "failover" && state.device === "GW1" && state.cliMode === "config-if" && command === "shutdown") {
    output = "Interface GigabitEthernet0/1 is administratively down — HSRP group 1 will fail over.";
    nextMode = "user"; // The console detaches from GW1 and attaches to GW2's.
    next = { ...state, gw1ShutDown: true, device: "GW2" };
  } else if (state.phase === "failover" && state.device === "GW1" && state.cliMode === "privileged" && command === "show standby") {
    output = standbySummary(state, "GW1");
  } else if (state.phase === "failover" && state.device === "GW1" && command === "show standby") {
    output = "Type end to return to privileged EXEC, then verify with show standby.";
  } else if (state.phase === "failover" && state.device === "GW2" && state.cliMode === "privileged" && command === "show standby") {
    output = standbySummary(state, "GW2");
    next = { ...state, gw2Active: true };
  } else if (state.phase === "failover" && state.device === "GW2" && command === "show standby") {
    output = "Type enable to enter privileged EXEC, then verify with show standby.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: gatewayPromptFor(state.cliMode, state.device) }];

  if (next.phase === "hsrp-config" && hsrpConfigured(next) && next.hsrpVerified) {
    return {
      ...next,
      phase: "failover",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "HSRP group 1 is up — GW1 is Active with priority 110, GW2 is Standby. Now the failover drill: take GW1 down and watch GW2 take over.", tone: "success" },
      ],
    };
  }

  if (next.phase === "failover" && next.gw2Active) {
    return {
      ...next,
      phase: "vrrp",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "GW2 is Active — the virtual gateway survived the failure. One last check: how does VRRP differ from HSRP?", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseDesign(state: GatewayMissionState, selectedDesign: GatewayDesignOption): GatewayMissionState {
  if (state.status === "complete" || state.phase !== "design") return state;

  return selectedDesign === GATEWAY_EXPECTED.design
    ? recordChoice(
        state,
        "Correct. A collapsed-core distribution pair running an FHRP gives access-layer hosts a redundant first hop — the two-tier answer for this campus.",
        "success",
        { phase: "ha", selectedDesign },
      )
    : recordChoice(
        state,
        selectedDesign === "three-tier-single"
          ? "A three-tier design still puts the gateway on a single core device here — the distribution pair is the redundant answer."
          : "A single flat switch has no redundancy at all — hosts would lose their gateway the moment it fails.",
        "error",
        { selectedDesign },
      );
}

export function chooseHa(state: GatewayMissionState, selectedHa: GatewayHaOption): GatewayMissionState {
  if (state.status === "complete" || state.phase !== "ha") return state;

  return selectedHa === GATEWAY_EXPECTED.ha
    ? recordChoice(
        state,
        "Correct. An FHRP (HSRP/VRRP/GLBP) shares a virtual IP between two gateways, so hosts keep one default route while the pair covers for each other.",
        "success",
        { phase: "hsrp-config", selectedHa },
      )
    : recordChoice(
        state,
        selectedHa === "stp"
          ? "STP prevents Layer 2 loops — it never provides gateway redundancy."
          : "ECMP is a routing-table tool for routers; end hosts send to a single default gateway.",
        "error",
        { selectedHa },
      );
}

export function chooseVrrp(state: GatewayMissionState, selectedVrrp: GatewayVrrpOption): GatewayMissionState {
  if (state.status === "complete" || state.phase !== "vrrp") return state;

  return selectedVrrp === GATEWAY_EXPECTED.vrrp
    ? recordChoice(
        state,
        "Correct. HSRP uses the well-known virtual MAC 0000.0c07.acXX; VRRP's master uses its own real MAC, so neighbor ARP caches change on failover.",
        "success",
        { phase: "complete", status: "complete", selectedVrrp },
      )
    : recordChoice(
        state,
        selectedVrrp === "same-mac"
          ? "The virtual MACs differ — HSRP's is 0000.0c07.acXX, while VRRP uses the active router's real MAC."
          : "VRRP preempts by default; it is HSRP that needs the preempt command.",
        "error",
        { selectedVrrp },
      );
}
