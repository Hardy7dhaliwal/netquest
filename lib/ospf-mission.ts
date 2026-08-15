import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";

export type OspfStatus = "not_started" | "in_progress" | "complete";
export type OspfPhase = "evidence" | "cause" | "config" | "verify" | "summarize" | "filter" | "complete";
export type OspfCliMode = "user" | "privileged" | "config" | "config-router";
export type OspfDevice = "R1" | "R2";
export type OspfEvidenceOption = "stuck-adjacency" | "full-converged" | "process-down";
export type OspfCauseOption = "area-mismatch" | "router-id-conflict" | "process-id-diff";

export type OspfEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type OspfCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const OSPF_PHASES: Exclude<OspfPhase, "complete">[] = ["evidence", "cause", "config", "verify", "summarize", "filter"];

export type OspfMissionState = {
  status: OspfStatus;
  phase: OspfPhase;
  cliMode: OspfCliMode;
  cliHistory: OspfCliEntry[];
  selectedEvidence: OspfEvidenceOption | null;
  selectedCause: OspfCauseOption | null;
  areaFixed: boolean;
  areaVerified: boolean;
  summarySet: boolean;
  filterSet: boolean;
  attempts: number;
  eventLog: OspfEvent[];
};

export const OSPF_EXPECTED = {
  evidence: "stuck-adjacency",
  cause: "area-mismatch",
} as const;

export const INITIAL_OSPF_MISSION: OspfMissionState = {
  status: "not_started",
  phase: "evidence",
  cliMode: "user",
  cliHistory: [],
  selectedEvidence: null,
  selectedCause: null,
  areaFixed: false,
  areaVerified: false,
  summarySet: false,
  filterSet: false,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";

/** Which router the single console is attached to for the current phase. */
export function ospfDeviceFor(phase: OspfPhase): OspfDevice {
  return phase === "verify" ? "R1" : "R2";
}

export function ospfPromptFor(mode: OspfCliMode, device: OspfDevice) {
  if (mode === "user") return `${device}>`;
  if (mode === "privileged") return `${device}#`;
  if (mode === "config") return `${device}(config)#`;
  return `${device}(config-router)#`;
}

export function resetOspfMission(): OspfMissionState {
  return { ...INITIAL_OSPF_MISSION, cliHistory: [], eventLog: [] };
}

export function startOspfMission(): OspfMissionState {
  return {
    ...resetOspfMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. R2 never reaches FULL. Read the neighbor table.", tone: "info" }],
  };
}

function recordChoice(
  state: OspfMissionState,
  message: string,
  tone: OspfEvent["tone"],
  updates: Partial<OspfMissionState> = {},
): OspfMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function neighborTable(): string {
  return [
    "Neighbor ID     Pri   State           Dead Time   Address         Interface",
    "10.0.2.2          1   FULL/  -       00:00:35    10.0.2.2        GigabitEthernet0/1",
  ].join("\n");
}

export function runOspfCommand(state: OspfMissionState, rawCommand: string): OspfMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "config" || state.phase === "verify" || state.phase === "summarize" || state.phase === "filter";
  if (!command || state.status === "complete" || !cliPhase) return state;

  const device = ospfDeviceFor(state.phase);

  const didDo = tryRunDo(state, rawCommand, ospfPromptFor(state.cliMode, device), runOspfCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "config"
        ? "Commands: enable, configure terminal, router ospf 1, network 10.0.2.0 0.0.0.255 area 0, end, exit, help"
        : state.phase === "verify"
          ? "Commands: enable, show ip ospf neighbor, help"
          : state.phase === "summarize"
            ? "Commands: enable, configure terminal, router ospf 1, area 1 range 172.16.0.0 255.255.252.0, end, exit, help"
            : "Commands: enable, configure terminal, router ospf 1, ip prefix-list LabDeny seq 5 deny 192.168.50.0/24, ip prefix-list LabDeny seq 10 permit 0.0.0.0/0 le 32, area 1 filter-list prefix LabDeny out, end, exit, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config-router" ? "config" : state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.cliMode === "config" && command === "router ospf 1") {
    nextMode = "config-router";
  } else if (state.phase === "config" && state.cliMode === "config-router" && command === "network 10.0.2.0 0.0.0.255 area 0") {
    output = state.areaFixed ? "Network statement already applied." : "Network statement applied — 10.0.2.0/24 now belongs to area 0.";
    next = { ...state, areaFixed: true };
  } else if (state.phase === "verify" && state.cliMode === "privileged" && command === "show ip ospf neighbor") {
    output = neighborTable();
    next = { ...state, areaVerified: true };
  } else if (state.phase === "verify" && command === "show ip ospf neighbor") {
    output = "Type enable to enter privileged EXEC, then verify with show ip ospf neighbor.";
  } else if (state.phase === "summarize" && state.cliMode === "config-router" && command === "area 1 range 172.16.0.0 255.255.252.0") {
    output = state.summarySet ? "Summary already installed." : "Route summary for area 1 installed — 24 /30 routes collapse into one /22.";
    next = { ...state, summarySet: true };
  } else if (state.phase === "filter" && (state.cliMode === "config" || state.cliMode === "config-router") && command === "ip prefix-list labdeny seq 5 deny 192.168.50.0/24") {
    output = "Prefix-list LabDeny created — the lab prefix 192.168.50.0/24 is denied.";
  } else if (state.phase === "filter" && (state.cliMode === "config" || state.cliMode === "config-router") && command === "ip prefix-list labdeny seq 10 permit 0.0.0.0/0 le 32") {
    output = "Prefix-list LabDeny completed — everything else is permitted.";
  } else if (state.phase === "filter" && state.cliMode === "config-router" && command === "area 1 filter-list prefix labdeny out") {
    output = state.filterSet ? "Filter already applied." : "Type-3 LSA filter applied at the ABR edge — the lab prefix can no longer leave area 1.";
    next = { ...state, filterSet: true };
  } else if (command.startsWith("router ospf") && state.cliMode !== "config") {
    output = "Enter configuration mode first: configure terminal, then router ospf 1.";
  } else if ((command.startsWith("network") || command.startsWith("area")) && state.cliMode !== "config-router") {
    output = "These are router configuration commands — enter router ospf 1 first (configure terminal, then router ospf 1).";
  } else if (command.startsWith("ip prefix-list") && state.cliMode !== "config" && state.cliMode !== "config-router") {
    output = "ip prefix-list is a configuration command — enter configuration mode first (configure terminal).";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: ospfPromptFor(state.cliMode, device) }];

  if (next.phase === "config" && next.areaFixed) {
    return {
      ...next,
      phase: "verify",
      cliMode: "user", // The console moves to R1 to prove the adjacency.
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "R2's link now sits in area 0 — the adjacency can form. Prove it from R1: the core router.", tone: "success" },
      ],
    };
  }

  if (next.phase === "verify" && next.areaVerified) {
    return {
      ...next,
      phase: "summarize",
      cliMode: "user", // Fresh console back on R2 for the next drill.
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "R2 shows FULL/ - — the adjacency is established and routes flow. Next: R1's table is flooding with 24 /30 routes — summarize area 1.", tone: "success" },
      ],
    };
  }

  if (next.phase === "summarize" && next.summarySet) {
    return {
      ...next,
      phase: "filter",
      cliMode: "user", // Fresh console for the final drill.
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "One /22 summary now crosses into area 0. Last step: compliance — keep the lab prefix out of area 0.", tone: "success" },
      ],
    };
  }

  if (next.phase === "filter" && next.filterSet) {
    return {
      ...next,
      phase: "complete",
      status: "complete",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The Type-3 LSA for 192.168.50.0/24 dies at the ABR edge — area 0 never learns the lab prefix.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseEvidence(state: OspfMissionState, selectedEvidence: OspfEvidenceOption): OspfMissionState {
  if (state.status === "complete" || state.phase !== "evidence") return state;

  return selectedEvidence === OSPF_EXPECTED.evidence
    ? recordChoice(
        state,
        "Correct. EXSTART (not FULL) plus the mismatch-area log means the routers see each other but cannot agree on the link.",
        "success",
        { phase: "cause", selectedEvidence },
      )
    : recordChoice(
        state,
        selectedEvidence === "full-converged"
          ? "EXSTART is not FULL — the adjacency is stuck, so the routers are not converged."
          : "The neighbor entry proves OSPF process 1 is running; the problem is the failed adjacency.",
        "error",
        { selectedEvidence },
      );
}

export function chooseCause(state: OspfMissionState, selectedCause: OspfCauseOption): OspfMissionState {
  if (state.status === "complete" || state.phase !== "cause") return state;

  return selectedCause === OSPF_EXPECTED.cause
    ? recordChoice(
        state,
        "Correct. Both ends of a segment must share the same area — R2's link belongs in area 0 because it touches the backbone. (Process IDs are local and never need to match.) Now type the fix.",
        "success",
        { phase: "config", selectedCause },
      )
    : recordChoice(
        state,
        selectedCause === "router-id-conflict"
          ? "Router IDs are unique and fine here — the fault is where R2's link sits in the area topology."
          : "Process IDs are locally significant and never need to match between routers — the real issue is the area.",
        "error",
        { selectedCause },
      );
}
