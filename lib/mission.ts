export type CliMode = "exec" | "privileged" | "config" | "interface";
export type MissionStatus = "not_started" | "in_progress" | "complete";
export type PingResult = "success" | "failed" | null;
export type PacketStatus = "idle" | "blocked" | "success";

export type CliEntry = { input: string; output: string; prompt: string };
export type MissionEvent = { message: string; tone: "info" | "success" | "error" };

export type MissionState = {
  status: MissionStatus;
  cliMode: CliMode;
  cliHistory: CliEntry[];
  trunkAllowedVlans: number[];
  lastPingResult: PingResult;
  packetStatus: PacketStatus;
  eventLog: MissionEvent[];
  inspectedVlans: boolean;
  inspectedTrunk: boolean;
  identifiedBlock: boolean;
};

export const INITIAL_MISSION: MissionState = {
  status: "not_started",
  cliMode: "exec",
  cliHistory: [],
  trunkAllowedVlans: [10],
  lastPingResult: null,
  packetStatus: "idle",
  eventLog: [],
  inspectedVlans: false,
  inspectedTrunk: false,
  identifiedBlock: false,
};

const INVALID = "% Invalid input detected at '^' marker.";
const PROMPTS: Record<CliMode, string> = {
  exec: "SW1>",
  privileged: "SW1#",
  config: "SW1(config)#",
  interface: "SW1(config-if)#",
};

export function promptFor(mode: CliMode) {
  return PROMPTS[mode];
}

export function resetMission(): MissionState {
  return {
    ...INITIAL_MISSION,
    eventLog: [],
    cliHistory: [],
    trunkAllowedVlans: [...INITIAL_MISSION.trunkAllowedVlans],
  };
}

export function startMission(): MissionState {
  return {
    ...resetMission(),
    status: "in_progress",
    eventLog: [event("Mission started.")],
  };
}

function event(message: string, tone: MissionEvent["tone"] = "info"): MissionEvent {
  return { message, tone };
}

function showVlan(state: MissionState) {
  return [
    "VLAN Name                             Status    Ports",
    "---- -------------------------------- --------- -------------------------------",
    "10   MANAGEMENT                        active    Gi0/1",
    "20   SALES                             active    Gi0/2",
  ].join("\n");
}

function showTrunk(state: MissionState) {
  return [
    "Port        Mode         Encapsulation  Status        Native vlan",
    "Gi0/1       on           802.1q         trunking      1",
    "",
    `Port        Vlans allowed on trunk`,
    `Gi0/1       ${state.trunkAllowedVlans.join(", ")}`,
  ].join("\n");
}

function showRunningConfig(state: MissionState) {
  return [
    "Building configuration...",
    "!",
    "interface GigabitEthernet0/1",
    " switchport mode trunk",
    ` switchport trunk allowed vlan ${state.trunkAllowedVlans.join(",")}`,
    "!",
  ].join("\n");
}

export function sendPing(state: MissionState): MissionState {
  const allowed = state.trunkAllowedVlans.includes(20);
  const result: PingResult = allowed ? "success" : "failed";
  const packetStatus: PacketStatus = allowed ? "success" : "blocked";
  const nextEvents = [
    ...state.eventLog,
    event("Ping attempted: PC-Sales → 10.20.0.1"),
    event(
      allowed
        ? "Ping succeeded: VLAN 20 crossed the SW1–SW2 trunk."
        : "Ping failed: VLAN 20 is not allowed on the SW1–SW2 trunk.",
      allowed ? "success" : "error",
    ),
  ];

  return {
    ...state,
    lastPingResult: result,
    packetStatus,
    status: allowed ? "complete" : state.status,
    eventLog: allowed
      ? [...nextEvents, event("Mission completed. +150 XP earned.", "success")]
      : nextEvents,
  };
}

export function runCommand(state: MissionState, rawCommand: string): MissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  if (!command) return state;

  let next = state;
  let output = "";
  let nextMode = state.cliMode;
  let nextEvents = state.eventLog;

  if (command === "help" || command === "?") {
    output = "Commands: enable, configure terminal, interface g0/1, show vlan brief, show interfaces trunk, show running-config, ping 10.20.0.1, exit, end";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "interface" ? "config" : state.cliMode === "config" ? "privileged" : "exec";
  } else if (state.cliMode === "exec" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
  } else if (state.cliMode === "privileged" && command === "show vlan brief") {
    output = showVlan(state);
    nextEvents = [...state.eventLog, event("User inspected VLAN state.")];
    next = { ...state, inspectedVlans: true };
  } else if (state.cliMode === "privileged" && command === "show interfaces trunk") {
    output = showTrunk(state);
    nextEvents = [...state.eventLog, event("User inspected trunk state.")];
    next = { ...state, inspectedTrunk: true, identifiedBlock: !state.trunkAllowedVlans.includes(20) };
  } else if (state.cliMode === "privileged" && command === "show running-config") {
    output = showRunningConfig(state);
  } else if (state.cliMode === "privileged" && command === "ping 10.20.0.1") {
    next = sendPing(state);
    nextEvents = next.eventLog;
    next = { ...next, identifiedBlock: next.identifiedBlock || next.lastPingResult === "failed" };
    output = next.lastPingResult === "success"
      ? "!!!!!\nSuccess rate is 100 percent (5/5)"
      : ".....\nSuccess rate is 0 percent (0/5)\nVLAN 20 is not allowed on the trunk.";
  } else if (state.cliMode === "config" && command === "interface g0/1") {
    nextMode = "interface";
  } else if (state.cliMode === "interface" && command === "switchport trunk allowed vlan add 20") {
    if (!state.trunkAllowedVlans.includes(20)) {
      nextEvents = [...state.eventLog, event("VLAN 20 added to the SW1–SW2 trunk.", "success")];
    }
    next = { ...state, trunkAllowedVlans: [...new Set([...state.trunkAllowedVlans, 20])] };
    output = "VLAN 20 added to the allowed VLAN list.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: promptFor(state.cliMode) }];
  return {
    ...next,
    status: next.status === "not_started" ? "in_progress" : next.status,
    cliMode: nextMode,
    cliHistory: [...history],
    eventLog: nextEvents,
  };
}
