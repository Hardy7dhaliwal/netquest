import { iosHelpForMode } from "./ios-help";

export type StpStatus = "not_started" | "in_progress" | "complete";
export type StpPhase = "root_election" | "bpdu_guard" | "root_guard" | "mst_concept" | "complete";
export type SwitchId = "SW1" | "SW2";
export type StpCliMode = "user" | "privileged" | "config" | "config-if";
export type StpProtocol = "rstp" | "pvst" | "mst";

export type StpEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type StpCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const STP_PHASES: Exclude<StpPhase, "complete">[] = ["root_election", "bpdu_guard", "root_guard", "mst_concept"];

export type StpMissionState = {
  status: StpStatus;
  phase: StpPhase;
  cliMode: StpCliMode;
  cliHistory: StpCliEntry[];
  selectedRoot: SwitchId | null;
  expectedRoot: SwitchId;
  blockedPort: string;
  bpduGuardSet: boolean;
  bpduGuardVerified: boolean;
  rootGuardSet: boolean;
  rootGuardVerified: boolean;
  selectedProtocol: StpProtocol | null;
  attempts: number;
  eventLog: StpEvent[];
};

export const INITIAL_STP_MISSION: StpMissionState = {
  status: "not_started",
  phase: "root_election",
  cliMode: "user",
  cliHistory: [],
  selectedRoot: null,
  expectedRoot: "SW2",
  blockedPort: "SW1 Gi0/2",
  bpduGuardSet: false,
  bpduGuardVerified: false,
  rootGuardSet: false,
  rootGuardVerified: false,
  selectedProtocol: null,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";

export function stpPromptFor(mode: StpCliMode) {
  if (mode === "user") return "SW1>";
  if (mode === "privileged") return "SW1#";
  if (mode === "config") return "SW1(config)#";
  return "SW1(config-if)#";
}

export function resetStpMission(): StpMissionState {
  return { ...INITIAL_STP_MISSION, cliHistory: [], eventLog: [] };
}

export function startStpMission(): StpMissionState {
  return {
    ...resetStpMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. Predict the STP root bridge.", tone: "info" }],
  };
}

function recordChoice(
  state: StpMissionState,
  message: string,
  tone: StpEvent["tone"],
  updates: Partial<StpMissionState> = {},
): StpMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function interfaceSummary(port: string, guardLine: string): string {
  const num = port === "Gi0/5" ? "5" : "2";
  return [
    `Port ${num} (GigabitEthernet0/${num}) of VLAN0010 is designated forwarding`,
    `   Port path cost 100, Port priority 128, Port Identifier 128.${num}.`,
    "   Designated root has priority 32768, address 0000.0c00.0002",
    "   Designated bridge has priority 32768, address 0000.0c00.0002",
    `   Designated port id is 128.${num}, designated path cost 100`,
    "   Timers: message 2 sec, forward 4 sec, hold 2 sec",
    "   Number of transitions to forwarding state: 1",
    `   ${guardLine}`,
  ].join("\n");
}

export function runStpCommand(state: StpMissionState, rawCommand: string): StpMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "bpdu_guard" || state.phase === "root_guard";
  if (!command || state.status === "complete" || !cliPhase) return state;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "bpdu_guard"
        ? "Commands: enable, configure terminal, interface gi0/5, spanning-tree bpduguard enable, show spanning-tree interface gi0/5, end, exit, help"
        : "Commands: enable, configure terminal, interface gi0/2, spanning-tree guard root, show spanning-tree interface gi0/2, end, exit, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config-if" ? "config" : state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.phase === "bpdu_guard" && state.cliMode === "config" && command === "interface gi0/5") {
    nextMode = "config-if";
  } else if (state.phase === "root_guard" && state.cliMode === "config" && command === "interface gi0/2") {
    nextMode = "config-if";
  } else if (state.phase === "bpdu_guard" && state.cliMode === "config-if" && command === "spanning-tree bpduguard enable") {
    output = state.bpduGuardSet ? "BPDU Guard already enabled on Gi0/5." : "BPDU Guard enabled — Gi0/5 will err-disable on any unexpected BPDU.";
    next = { ...state, bpduGuardSet: true };
  } else if (state.phase === "root_guard" && state.cliMode === "config-if" && command === "spanning-tree guard root") {
    output = state.rootGuardSet ? "Root Guard already enabled on Gi0/2." : "Root Guard enabled — Gi0/2 will ignore superior BPDUs.";
    next = { ...state, rootGuardSet: true };
  } else if (state.phase === "bpdu_guard" && state.cliMode === "privileged" && command === "show spanning-tree interface gi0/5") {
    if (!state.bpduGuardSet) {
      output = "Bpdu guard is disabled.\nEnable it on Gi0/5 first: configure terminal, interface gi0/5, spanning-tree bpduguard enable.";
    } else {
      output = interfaceSummary("Gi0/5", "Bpdu guard is enabled");
      next = { ...state, bpduGuardVerified: true };
    }
  } else if (state.phase === "root_guard" && state.cliMode === "privileged" && command === "show spanning-tree interface gi0/2") {
    if (!state.rootGuardSet) {
      output = "Root guard is disabled.\nEnable it on Gi0/2 first: configure terminal, interface gi0/2, spanning-tree guard root.";
    } else {
      output = interfaceSummary("Gi0/2", "Root guard is enabled");
      next = { ...state, rootGuardVerified: true };
    }
  } else if (command.startsWith("show spanning-tree interface") && state.cliMode !== "privileged") {
    output = "Type end to return to privileged EXEC, then verify with show spanning-tree interface.";
  } else if (command.startsWith("spanning-tree") && state.cliMode !== "config-if") {
    output = "Enter the interface first: configure terminal, then interface gi0/x from global config.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: stpPromptFor(state.cliMode) }];

  if (next.phase === "bpdu_guard" && next.bpduGuardSet && next.bpduGuardVerified) {
    return {
      ...next,
      phase: "root_guard",
      cliMode: "user", // Fresh console for the next guard drill.
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "BPDU Guard is live on the edge port — rogue switches get err-disabled instantly. Next: protect the designated uplink with Root Guard.", tone: "success" },
      ],
    };
  }

  if (next.phase === "root_guard" && next.rootGuardSet && next.rootGuardVerified) {
    return {
      ...next,
      phase: "mst_concept",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Root Guard is live on the uplink — superior BPDUs are ignored, the root cannot be hijacked. One last design decision.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseRoot(state: StpMissionState, selectedRoot: SwitchId): StpMissionState {
  if (state.status === "complete" || state.phase !== "root_election") return state;

  return selectedRoot === state.expectedRoot
    ? recordChoice(
        state,
        "Correct. SW2 wins root bridge election with the lower bridge ID; now harden the edge port against rogue BPDUs.",
        "success",
        { phase: "bpdu_guard", selectedRoot },
      )
    : recordChoice(
        state,
        "Not quite. Compare bridge IDs first: the lowest bridge ID becomes the root.",
        "error",
        { selectedRoot },
      );
}

export function chooseProtocol(state: StpMissionState, selectedProtocol: StpProtocol): StpMissionState {
  if (state.status === "complete" || state.phase !== "mst_concept") return state;

  return selectedProtocol === "mst"
    ? recordChoice(
        state,
        "Correct. MST maps many VLANs to a small number of spanning-tree instances, reducing control-plane overhead.",
        "success",
        { phase: "complete", status: "complete", selectedProtocol },
      )
    : recordChoice(
        state,
        "That protocol does not solve the many-VLAN overhead scenario. Choose MST to group VLANs into instances.",
        "error",
        { selectedProtocol },
      );
}
