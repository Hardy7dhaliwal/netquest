export type SdwanStatus = "not_started" | "in_progress" | "complete";
export type SdwanPhase = "planes" | "omp" | "tlocs" | "tlocs-check" | "benefit" | "complete";
export type SdwanCliMode = "user" | "privileged";
export type SdwanPlanesOption = "control-omp" | "data-vsmart" | "mgmt-vbond";
export type SdwanOmpOption = "omp-tloc-attr" | "full-table" | "transit-traffic";
export type SdwanTlocsOption = "tlocs-forward" | "tlocs-routes" | "bfd-replaces-omp";
export type SdwanBenefitOption = "benefit-transport" | "limit-complexity" | "limit-no-overlay";

export type SdwanEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type SdwanCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const SDWAN_PHASES: Exclude<SdwanPhase, "complete">[] = ["planes", "omp", "tlocs", "tlocs-check", "benefit"];

export type SdwanMissionState = {
  status: SdwanStatus;
  phase: SdwanPhase;
  cliMode: SdwanCliMode;
  cliHistory: SdwanCliEntry[];
  // tlocs phase (vEdge inspection)
  ompTlocsSeen: boolean;
  bfdSeen: boolean;
  controlSeen: boolean;
  selectedPlanes: SdwanPlanesOption | null;
  selectedOmp: SdwanOmpOption | null;
  selectedTlocs: SdwanTlocsOption | null;
  selectedBenefit: SdwanBenefitOption | null;
  attempts: number;
  eventLog: SdwanEvent[];
};

export const SDWAN_EXPECTED = {
  planes: "control-omp",
  omp: "omp-tloc-attr",
  tlocs: "tlocs-forward",
  benefit: "benefit-transport",
} as const;

export const INITIAL_SDWAN_MISSION: SdwanMissionState = {
  status: "not_started",
  phase: "planes",
  cliMode: "user",
  cliHistory: [],
  ompTlocsSeen: false,
  bfdSeen: false,
  controlSeen: false,
  selectedPlanes: null,
  selectedOmp: null,
  selectedTlocs: null,
  selectedBenefit: null,
  attempts: 0,
  eventLog: [],
};

export function sdwanPromptFor(mode: SdwanCliMode) {
  if (mode === "user") return "vEdge>";
  return "vEdge#";
}

export function tlocsInspected(state: SdwanMissionState) {
  return state.ompTlocsSeen && state.bfdSeen && state.controlSeen;
}

export function resetSdwanMission(): SdwanMissionState {
  return { ...INITIAL_SDWAN_MISSION, cliHistory: [], eventLog: [] };
}

export function startSdwanMission(): SdwanMissionState {
  return {
    ...resetSdwanMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. The branch joins a Catalyst SD-WAN fabric: controllers in the cloud, vEdge routers on the floor. (Current branding: vManage is now SD-WAN Manager, vBond is the SD-WAN Validator — the classic names still show up on the CLI.) Map the planes, read what OMP carries, then verify the secure control connections on the vEdge itself.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: SdwanMissionState,
  message: string,
  tone: SdwanEvent["tone"],
  updates: Partial<SdwanMissionState> = {},
): SdwanMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function ompTlocs(): string {
  return [
    "ADDRESS FAMILY  TLOC IP      COLOR          ENCAP  FROM PEER  STATUS   KEY  PUBLIC IP       PUBLIC PORT  ...  BFD STATUS",
    "ipv4            10.70.70.1   biz-internet   ipsec  0.0.0.0    C,Red,R  1    198.51.100.17   4501         ...  up",
    "ipv4            10.1.0.5     gold           ipsec  0.0.0.0    C,Red,R  2    203.0.113.225   4501         ...  up",
  ].join("\n");
}

function bfdSessions(): string {
  return [
    "SOURCE SYSTEM IP  REMOTE TLOC SITE ID  STATE  SOURCE TLOC COLOR  REMOTE TLOC COLOR  DST PUBLIC IP   ENCAP  DETECT MULTIPLIER  UPTIME",
    "10.1.0.5          10                   up     gold               blue               203.0.113.225    ipsec  7                  2w3d",
    "10.1.0.6          20                   up     biz-internet       red                198.51.100.17    ipsec  7                  2w3d",
  ].join("\n");
}

function controlConnections(): string {
  return [
    "PEER         PEER     PEER        PEER   SITE  DOMAIN  PEER PRIVATE IP  PEER PUBLIC IP   LOCAL COLOR  STATE",
    "TYPE         PROT     SYSTEM IP   ID     ID    ID",
    "vsmart       dtls     10.1.0.3    3      1     203.0.113.13        203.0.113.13      gold         up",
    "vmanage      dtls     10.1.0.1    1      0     203.0.113.14        203.0.113.14      gold         up",
    "vbond        dtls     -           0      0     203.0.113.12        203.0.113.12      mpls         connect",
  ].join("\n");
}

export function runSdwanCommand(state: SdwanMissionState, rawCommand: string): SdwanMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  if (!command || state.status === "complete" || state.phase !== "tlocs") return state;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "help" || command === "?") {
    output = "Commands: enable, show omp tlocs, show bfd sessions, show control connections, exit, help";
  } else if (command === "exit" || command === "end") {
    nextMode = "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && command === "show omp tlocs") {
    output = ompTlocs();
    next = { ...state, ompTlocsSeen: true };
  } else if (state.cliMode === "privileged" && command === "show bfd sessions") {
    output = bfdSessions();
    next = { ...state, bfdSeen: true };
  } else if (state.cliMode === "privileged" && command === "show control connections") {
    output = controlConnections();
    next = { ...state, controlSeen: true };
  } else if (command.startsWith("show ")) {
    output = state.cliMode === "user" ? "Type enable to enter privileged EXEC on the vEdge, then run the show command." : "Run show commands from privileged EXEC — type exit first if you are in user mode.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: sdwanPromptFor(state.cliMode) }];

  if (next.phase === "tlocs" && tlocsInspected(next)) {
    return {
      ...next,
      phase: "tlocs-check",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The vEdge has live DTLS control connections to vSmart and vManage, and BFD is up on both WAN transports. Last check on the data plane: what actually moves the packets?", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function choosePlanes(state: SdwanMissionState, selected: SdwanPlanesOption): SdwanMissionState {
  if (state.status === "complete" || state.phase !== "planes") return state;

  return selected === SDWAN_EXPECTED.planes
    ? recordChoice(
        state,
        "Correct. OMP (Overlay Management Protocol) runs between vSmart and the vEdge routers — that is the control plane. vSmart advertises routes (prefixes with their TLOC), and the vEdges install them. vManage is management/UI/APIs; vBond does orchestration (authentication + address resolution).",
        "success",
        { phase: "omp", selectedPlanes: selected },
      )
    : recordChoice(
        state,
        selected === "data-vsmart"
          ? "vSmart is a controller — it reflects routes and pushes policy. Actual packet forwarding happens on the vEdge data plane, which uses the OMP routes vSmart sent it."
          : "vBond is the orchestrator: it authenticates new devices and tells them which vManage and vSmart to reach. It does not manage the fabric day-to-day — that is vManage.",
        "error",
        { selectedPlanes: selected },
      );
}

export function chooseOmp(state: SdwanMissionState, selected: SdwanOmpOption): SdwanMissionState {
  if (state.status === "complete" || state.phase !== "omp") return state;

  return selected === SDWAN_EXPECTED.omp
    ? recordChoice(
        state,
        "Correct. An OMP route is the prefix plus the TLOC (and attributes like service, preference, and path) — the control-plane info a vEdge needs to install and forward. OMP does not carry the full routing table, and it runs over a secure DTLS/TLS channel, not in-band with user traffic.",
        "success",
        { phase: "tlocs", selectedOmp: selected },
      )
    : recordChoice(
        state,
        selected === "full-table"
          ? "The full routing table never crosses OMP. OMP carries routes as prefix + TLOC + attributes — vSmart reflects them like a route reflector, and each vEdge installs what it needs."
          : "OMP is control-plane signaling, not forwarding. Data-plane packets are GRE/IPsec encapsulated and steered per-prefix — OMP routes decide the path; they are not the packets themselves.",
        "error",
        { selectedOmp: selected },
      );
}

export function chooseTlocs(state: SdwanMissionState, selected: SdwanTlocsOption): SdwanMissionState {
  if (state.status === "complete" || state.phase !== "tlocs-check" || !tlocsInspected(state)) return state;

  return selected === SDWAN_EXPECTED.tlocs
    ? recordChoice(
        state,
        "Correct. A TLOC is the interface-level identifier — system IP, color, and encapsulation — and it is what the data plane forwards over. OMP routes point to TLOCs, and BFD (which you saw up on both transports) is the liveliness check that lets a vEdge fail over when a TLOC path dies.",
        "success",
        { phase: "benefit", selectedTlocs: selected },
      )
    : recordChoice(
        state,
        selected === "tlocs-routes"
          ? "Routes and TLOCs are different objects: OMP routes are prefixes with attributes, while a TLOC is the tunnel endpoint the data plane uses to forward. Routes reference TLOCs — they do not replace them."
          : "BFD monitors TLOC liveliness and triggers failover — it does not replace OMP. OMP still builds and maintains the routes; BFD just tells the vEdge when a path is gone.",
        "error",
        { selectedTlocs: selected },
      );
}

export function chooseBenefit(state: SdwanMissionState, selected: SdwanBenefitOption): SdwanMissionState {
  if (state.status === "complete" || state.phase !== "benefit") return state;

  return selected === SDWAN_EXPECTED.benefit
    ? recordChoice(
        state,
        "Correct. The headline benefit is transport independence: any WAN (MPLS, internet, LTE) joins the overlay, OMP + TLOCs pick the best path per prefix, and centralized policy shapes everything. The tradeoff is the extra layer: controllers to run, subscriptions, and overlay complexity on top of the existing network.",
        "success",
        { phase: "complete", status: "complete", selectedBenefit: selected },
      )
    : recordChoice(
        state,
        selected === "limit-complexity"
          ? "Complexity IS a real limitation of SD-WAN — controllers, subscriptions, and overlay operations add a layer. It is not a benefit; the benefit is the transport independence and centralized control it buys."
          : "The overlay is not a limitation to avoid — it is the point. SD-WAN's limitations are operational: cost, controller dependency, and the operational complexity of running an overlay.",
        "error",
        { selectedBenefit: selected },
      );
}

const INVALID = "% Invalid input detected at '^' marker.";
