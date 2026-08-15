import { iosHelpForMode } from "./ios-help";
import { normalizeIosCommand } from "./ios-abbrev";

export type CampusStatus = "not_started" | "in_progress" | "complete";
export type CampusPhase = "roles" | "lisp" | "lisp-check" | "interop" | "complete";
export type CampusCliMode = "user" | "privileged";
export type CampusRolesOption = "edge-border" | "edge-hosts" | "cp-lisp";
export type CampusLispOption = "eid-rloc" | "rloc-route" | "lisp-bgp";
export type CampusInteropOption = "border-fusion" | "vxlan-only" | "no-access";

export type CampusEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type CampusCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const CAMPUS_PHASES: Exclude<CampusPhase, "complete">[] = ["roles", "lisp", "lisp-check", "interop"];

export type CampusFabricMissionState = {
  status: CampusStatus;
  phase: CampusPhase;
  cliMode: CampusCliMode;
  cliHistory: CampusCliEntry[];
  // lisp phase (control plane node inspection)
  sessionSeen: boolean;
  mapCacheSeen: boolean;
  siteSeen: boolean;
  selectedRoles: CampusRolesOption | null;
  selectedLisp: CampusLispOption | null;
  selectedInterop: CampusInteropOption | null;
  attempts: number;
  eventLog: CampusEvent[];
};

export const CAMPUS_EXPECTED = {
  roles: "cp-lisp",
  lisp: "eid-rloc",
  interop: "border-fusion",
} as const;

export const INITIAL_CAMPUS_FABRIC_MISSION: CampusFabricMissionState = {
  status: "not_started",
  phase: "roles",
  cliMode: "user",
  cliHistory: [],
  sessionSeen: false,
  mapCacheSeen: false,
  siteSeen: false,
  selectedRoles: null,
  selectedLisp: null,
  selectedInterop: null,
  attempts: 0,
  eventLog: [],
};

export function campusPromptFor(mode: CampusCliMode) {
  if (mode === "user") return "CP-1>";
  return "CP-1#";
}

export function lispInspected(state: CampusFabricMissionState) {
  return state.sessionSeen && state.mapCacheSeen && state.siteSeen;
}

export function resetCampusFabricMission(): CampusFabricMissionState {
  return { ...INITIAL_CAMPUS_FABRIC_MISSION, cliHistory: [], eventLog: [] };
}

export function startCampusFabricMission(): CampusFabricMissionState {
  return {
    ...resetCampusFabricMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. The new campus runs an SD-Access fabric: edge and border nodes under a LISP control plane, with a legacy network that still needs to talk to it. Map the roles, inspect the EID-to-RLOC database, then predict how the two worlds meet.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: CampusFabricMissionState,
  message: string,
  tone: CampusEvent["tone"],
  updates: Partial<CampusFabricMissionState> = {},
): CampusFabricMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function lispSession(): string {
  return [
    "Peer Address     State   Up/Down Time",
    "192.0.2.10      UP      3w2d",
    "192.0.2.20      UP      3w2d",
  ].join("\n");
}

function mapCache(): string {
  return [
    "EID Prefix             Uptime     Locator (RLOC)     Priority/Weight  State",
    "10.10.10.0/24          3w2d       192.0.2.10          1/100            up",
    "10.10.20.0/24          3w2d       192.0.2.20          1/100            up",
  ].join("\n");
}

function lispSite(): string {
  return [
    "Site Name             EID Prefix       RLOC             Auth  State",
    "Building-1            10.10.10.0/24    192.0.2.10       yes   registered",
    "Building-2            10.10.20.0/24    192.0.2.20       yes   registered",
  ].join("\n");
}

export function runCampusCommand(state: CampusFabricMissionState, rawCommand: string): CampusFabricMissionState {
  const command = normalizeIosCommand(rawCommand);
  if (!command || state.status === "complete" || state.phase !== "lisp") return state;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output = "Commands: enable, show lisp session, show lisp map-cache, show lisp site, exit, help";
  } else if (command === "exit" || command === "end") {
    nextMode = "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && command === "show lisp session") {
    output = lispSession();
    next = { ...state, sessionSeen: true };
  } else if (state.cliMode === "privileged" && command === "show lisp map-cache") {
    output = mapCache();
    next = { ...state, mapCacheSeen: true };
  } else if (state.cliMode === "privileged" && command === "show lisp site") {
    output = lispSite();
    next = { ...state, siteSeen: true };
  } else if (command.startsWith("show ")) {
    output = state.cliMode === "user" ? "Type enable to enter privileged EXEC on CP-1, then run the show command." : "Run show commands from privileged EXEC — type exit first if you are in user mode.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: campusPromptFor(state.cliMode) }];

  if (next.phase === "lisp" && lispInspected(next)) {
    return {
      ...next,
      phase: "lisp-check",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The control plane is healthy: two building EID prefixes registered, each mapped to its edge-node RLOC. One check on how LISP actually maps the fabric — then the legacy question.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseRoles(state: CampusFabricMissionState, selected: CampusRolesOption): CampusFabricMissionState {
  if (state.status === "complete" || state.phase !== "roles") return state;

  return selected === CAMPUS_EXPECTED.roles
    ? recordChoice(
        state,
        "Correct. The control plane node runs the LISP map-server and map-resolver and holds the EID-to-RLOC database — the fabric's DNS for endpoints. Edge nodes register their hosts and encapsulate; border nodes connect the fabric outward.",
        "success",
        { phase: "lisp", selectedRoles: selected },
      )
    : recordChoice(
        state,
        selected === "edge-hosts"
          ? "Edge nodes register and forward for their hosts — but they do not hold the fabric-wide mapping database. That lives in the control plane node (LISP map-server/map-resolver)."
          : "Both edge and border nodes are data-plane switches. The plane that answers 'where is this EID?' for the whole fabric is the control plane node running LISP.",
        "error",
        { selectedRoles: selected },
      );
}

export function chooseLisp(state: CampusFabricMissionState, selected: CampusLispOption): CampusFabricMissionState {
  if (state.status === "complete" || state.phase !== "lisp-check" || !lispInspected(state)) return state;

  return selected === CAMPUS_EXPECTED.lisp
    ? recordChoice(
        state,
        "Correct. In LISP, endpoints are EIDs (10.10.10.0/24) and fabric switches are RLOCs (192.0.2.10). The map-cache you read is exactly that binding: an EID prefix resolved to the RLOC that can reach it — the information an edge node needs to encapsulate and forward.",
        "success",
        { phase: "interop", selectedLisp: selected },
      )
    : recordChoice(
        state,
        selected === "rloc-route"
          ? "The map-cache binds EIDs to RLOCs — it is not a routing table. RLOCs are the tunnel endpoints; the EID is the host prefix being reached."
          : "LISP is the fabric's control plane (EID-to-RLOC mapping); BGP/OSPF carry routes in the underlay and at the border, but they are not what the map-cache shows.",
        "error",
        { selectedLisp: selected },
      );
}

export function chooseInterop(state: CampusFabricMissionState, selected: CampusInteropOption): CampusFabricMissionState {
  if (state.status === "complete" || state.phase !== "interop") return state;

  return selected === CAMPUS_EXPECTED.interop
    ? recordChoice(
        state,
        "Correct. A legacy host cannot query LISP, so the fabric meets the old world at the border node: it advertises fabric prefixes outward (BGP/OSPF) and ingests external routes, with the fusion router providing shared services and route leaking. The fabric host's path goes legacy → border node → edge node — the EID resolution happens inside the fabric.",
        "success",
        { phase: "complete", status: "complete", selectedInterop: selected },
      )
    : recordChoice(
        state,
        selected === "vxlan-only"
          ? "VXLAN carries the frames INSIDE the fabric (the encapsulation between nodes). A legacy host never runs VXLAN — the translation happens at the border node, which advertises the fabric's prefixes into the legacy routing world."
          : "Legacy hosts absolutely reach fabric hosts — through the border node. The border advertises fabric prefixes outward and ingests external routes, with the fusion router for shared services.",
        "error",
        { selectedInterop: selected },
      );
}

const INVALID = "% Invalid input detected at '^' marker.";
