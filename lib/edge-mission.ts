export type EdgeStatus = "not_started" | "in_progress" | "complete";
export type EdgePhase = "igp" | "convergence" | "bgp-state" | "bgp-fix" | "pbr" | "local" | "complete";
export type EdgeCliMode = "user" | "privileged" | "config" | "config-router";
export type EdgeIgpOption = "hybrid-vs-linkstate" | "classes-reversed" | "both-linkstate";
export type EdgeConvergenceOption = "fs-vs-spf" | "holddown" | "lsa-flood";
export type EdgeBgpStateOption = "not-established" | "established" | "low-localpref";
export type EdgePbrOption = "overrides-lookup" | "changes-table" | "local-only";
export type EdgeLocalOption = "local-policy" | "outbound-policy" | "default-route";

export type EdgeEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type EdgeCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const EDGE_PHASES: Exclude<EdgePhase, "complete">[] = ["igp", "convergence", "bgp-state", "bgp-fix", "pbr", "local"];

export type EdgeMissionState = {
  status: EdgeStatus;
  phase: EdgePhase;
  cliMode: EdgeCliMode;
  cliHistory: EdgeCliEntry[];
  bgpConfigured: boolean;
  bgpVerified: boolean;
  selectedIgp: EdgeIgpOption | null;
  selectedConvergence: EdgeConvergenceOption | null;
  selectedBgpState: EdgeBgpStateOption | null;
  selectedPbr: EdgePbrOption | null;
  selectedLocal: EdgeLocalOption | null;
  attempts: number;
  eventLog: EdgeEvent[];
};

export const EDGE_EXPECTED = {
  igp: "hybrid-vs-linkstate",
  convergence: "fs-vs-spf",
  bgpState: "not-established",
  pbr: "overrides-lookup",
  local: "local-policy",
} as const;

export const INITIAL_EDGE_MISSION: EdgeMissionState = {
  status: "not_started",
  phase: "igp",
  cliMode: "user",
  cliHistory: [],
  bgpConfigured: false,
  bgpVerified: false,
  selectedIgp: null,
  selectedConvergence: null,
  selectedBgpState: null,
  selectedPbr: null,
  selectedLocal: null,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";
const EDGE_PROMPTS: Record<EdgeCliMode, string> = {
  user: "R-EDGE>",
  privileged: "R-EDGE#",
  config: "R-EDGE(config)#",
  "config-router": "R-EDGE(config-router)#",
};

export function edgePromptFor(mode: EdgeCliMode) {
  return EDGE_PROMPTS[mode];
}

export function resetEdgeMission(): EdgeMissionState {
  return {
    ...INITIAL_EDGE_MISSION,
    eventLog: [],
    cliHistory: [],
  };
}

export function startEdgeMission(): EdgeMissionState {
  return {
    ...resetEdgeMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. The edge router gets to have opinions — choose the right ones.", tone: "info" }],
  };
}

function recordChoice(
  state: EdgeMissionState,
  message: string,
  tone: EdgeEvent["tone"],
  updates: Partial<EdgeMissionState> = {},
): EdgeMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function bgpSummary(state: EdgeMissionState): string {
  const established = state.bgpConfigured;
  return [
    "BGP router identifier 198.51.100.1, local AS number 65100",
    "Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd",
    established
      ? "203.0.113.2     4 65001     15      16        3    0    0 00:02:11        4"
      : "203.0.113.2     4 65001      0       0        1    0    0 never    Active",
  ].join("\n");
}

export function runEdgeCommand(state: EdgeMissionState, rawCommand: string): EdgeMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  if (!command || state.status === "complete" || state.phase !== "bgp-fix") return state;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "help" || command === "?") {
    output = "Commands: enable, configure terminal, router bgp 65100, neighbor 203.0.113.2 ebgp-multihop 2, show ip bgp summary, exit, end, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config-router" ? "config" : state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.cliMode === "config" && command === "router bgp 65100") {
    nextMode = "config-router";
  } else if (state.cliMode === "config-router" && command === "neighbor 203.0.113.2 ebgp-multihop 2") {
    if (!state.bgpConfigured) {
      output = "eBGP multihop enabled for neighbor 203.0.113.2 (max hops 2).";
    }
    next = { ...state, bgpConfigured: true };
  } else if (state.cliMode === "privileged" && command === "show ip bgp summary") {
    output = bgpSummary(state);
    if (state.bgpConfigured) {
      next = { ...state, bgpVerified: true };
    }
  } else if (command.startsWith("neighbor") && state.cliMode !== "config-router") {
    output = "Enter BGP router configuration first: configure terminal, then router bgp 65100.";
  } else if (command === "show ip bgp summary" && state.cliMode !== "privileged") {
    output = "Type end to return to privileged EXEC, then verify with show ip bgp summary.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: edgePromptFor(state.cliMode) }];

  if (next.bgpConfigured && next.bgpVerified) {
    return {
      ...next,
      phase: "pbr",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "eBGP session Established with 203.0.113.2 — configured and verified. Next: PBR at the edge.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseIgp(state: EdgeMissionState, selectedIgp: EdgeIgpOption): EdgeMissionState {
  if (state.status === "complete" || state.phase !== "igp") return state;

  return selectedIgp === EDGE_EXPECTED.igp
    ? recordChoice(
        state,
        "Correct. EIGRP uses DUAL with a composite metric (bandwidth, delay, load, reliability); OSPF is link-state and derives its metric as cost.",
        "success",
        { phase: "convergence", selectedIgp },
      )
    : recordChoice(
        state,
        selectedIgp === "classes-reversed"
          ? "Reversed: OSPF is the link-state SPF protocol, while EIGRP is the advanced distance-vector hybrid."
          : "LSA flooding and SPF belong to OSPF — EIGRP sends bounded, partial updates instead.",
        "error",
        { selectedIgp },
      );
}

export function chooseConvergence(state: EdgeMissionState, selectedConvergence: EdgeConvergenceOption): EdgeMissionState {
  if (state.status === "complete" || state.phase !== "convergence") return state;

  return selectedConvergence === EDGE_EXPECTED.convergence
    ? recordChoice(
        state,
        "Correct. EIGRP's DUAL can fall to a feasible successor for near-instant local convergence; OSPF recalculates via SPF after a topology change.",
        "success",
        { phase: "bgp-state", selectedConvergence },
      )
    : recordChoice(
        state,
        selectedConvergence === "holddown"
          ? "Holddown timers belong to classic distance-vector protocols — OSPF converges with SPF, not holddown."
          : "LSA flooding is OSPF behavior. EIGRP sends only bounded, partial updates triggered by changes.",
        "error",
        { selectedConvergence },
      );
}

export function chooseBgpState(state: EdgeMissionState, selectedBgpState: EdgeBgpStateOption): EdgeMissionState {
  if (state.status === "complete" || state.phase !== "bgp-state") return state;

  return selectedBgpState === EDGE_EXPECTED.bgpState
    ? recordChoice(
        state,
        "Correct. Active means BGP is still trying to open the session — only Established carries prefixes. Now configure the fix.",
        "success",
        { phase: "bgp-fix", selectedBgpState },
      )
    : recordChoice(
        state,
        selectedBgpState === "established"
          ? "An established session shows an uptime and received prefixes — Active is a retrying, failed state."
          : "Local preference shapes best-path selection, not the TCP session state.",
        "error",
        { selectedBgpState },
      );
}

export function choosePbr(state: EdgeMissionState, selectedPbr: EdgePbrOption): EdgeMissionState {
  if (state.status === "complete" || state.phase !== "pbr") return state;

  return selectedPbr === EDGE_EXPECTED.pbr
    ? recordChoice(
        state,
        "Correct. PBR applies before the destination-based lookup and sends matched traffic to the configured next-hop, leaving the routing table untouched.",
        "success",
        { phase: "local", selectedPbr },
      )
    : recordChoice(
        state,
        selectedPbr === "changes-table"
          ? "PBR does not touch the routing table — it intercepts matched traffic at the interface and redirects it."
          : "An interface policy affects traffic transiting the interface; locally sourced traffic needs ip local policy instead.",
        "error",
        { selectedPbr },
      );
}

export function chooseLocal(state: EdgeMissionState, selectedLocal: EdgeLocalOption): EdgeMissionState {
  if (state.status === "complete" || state.phase !== "local") return state;

  return selectedLocal === EDGE_EXPECTED.local
    ? recordChoice(
        state,
        "Correct. ip local policy applies PBR to locally generated traffic; interface policies only catch transit traffic.",
        "success",
        { phase: "complete", status: "complete", selectedLocal },
      )
    : recordChoice(
        state,
        selectedLocal === "outbound-policy"
          ? "PBR is evaluated as traffic arrives — there is no outbound interface policy. Local traffic specifically needs ip local policy."
          : "That adds a default route — it cannot match and redirect specific flows the way the route-map does.",
        "error",
        { selectedLocal },
      );
}
