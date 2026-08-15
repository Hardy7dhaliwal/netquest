import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";

export type LockStatus = "not_started" | "in_progress" | "complete";
export type LockPhase = "local" | "aaa" | "iacl" | "copp" | "rest" | "design" | "complete";
export type LockCliMode = "user" | "privileged" | "config";
export type LockIaclOption = "permit-mgmt-deny" | "permit-all" | "only-bgp";
export type LockCoppOption = "copp-protects" | "copp-blocks-https" | "copp-replaces-acl";
export type LockRestOption = "api-key-https" | "api-plaintext" | "api-open";
export type LockDesignOption = "layered-defense" | "macsec-l3" | "trustsec-8021x";

export type LockEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type LockCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const LOCK_PHASES: Exclude<LockPhase, "complete">[] = ["local", "aaa", "iacl", "copp", "rest", "design"];

export type LockControlPlaneMissionState = {
  status: LockStatus;
  phase: LockPhase;
  cliMode: LockCliMode;
  cliHistory: LockCliEntry[];
  // local phase (R-BR)
  userCreated: boolean;
  vtyLocal: boolean;
  vtySsh: boolean;
  localVerified: boolean;
  // aaa phase (R-BR)
  aaaNewModel: boolean;
  radiusServerDefined: boolean;
  radiusServerSet: boolean;
  radiusKeySet: boolean;
  aaaLoginSet: boolean;
  aaaVerified: boolean;
  selectedIacl: LockIaclOption | null;
  selectedCopp: LockCoppOption | null;
  selectedRest: LockRestOption | null;
  selectedDesign: LockDesignOption | null;
  attempts: number;
  eventLog: LockEvent[];
};

export const LOCK_EXPECTED = {
  iacl: "permit-mgmt-deny",
  copp: "copp-protects",
  rest: "api-key-https",
  design: "layered-defense",
} as const;

export const INITIAL_LOCK_CONTROL_PLANE_MISSION: LockControlPlaneMissionState = {
  status: "not_started",
  phase: "local",
  cliMode: "user",
  cliHistory: [],
  userCreated: false,
  vtyLocal: false,
  vtySsh: false,
  localVerified: false,
  aaaNewModel: false,
  radiusServerDefined: false,
  radiusServerSet: false,
  radiusKeySet: false,
  aaaLoginSet: false,
  aaaVerified: false,
  selectedIacl: null,
  selectedCopp: null,
  selectedRest: null,
  selectedDesign: null,
  attempts: 0,
  eventLog: [],
};

export function lockPromptFor(mode: LockCliMode) {
  if (mode === "user") return "R-BR>";
  if (mode === "config") return "R-BR(config)#";
  return "R-BR#";
}

export function localDone(state: LockControlPlaneMissionState) {
  return state.userCreated && state.vtyLocal && state.vtySsh && state.localVerified;
}

export function aaaDone(state: LockControlPlaneMissionState) {
  return state.aaaNewModel && state.radiusServerDefined && state.radiusServerSet && state.radiusKeySet && state.aaaLoginSet && state.aaaVerified;
}

export function resetLockControlPlaneMission(): LockControlPlaneMissionState {
  return { ...INITIAL_LOCK_CONTROL_PLANE_MISSION, cliHistory: [], eventLog: [] };
}

export function startLockControlPlaneMission(): LockControlPlaneMissionState {
  return {
    ...resetLockControlPlaneMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. The branch router was hit: a guessed VTY password let someone in, and the control plane took the blast. Lock it down, layer by layer: local auth, AAA with RADIUS, an infrastructure ACL, CoPP on the control plane, API security — then the defense-in-depth design.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: LockControlPlaneMissionState,
  message: string,
  tone: LockEvent["tone"],
  updates: Partial<LockControlPlaneMissionState> = {},
): LockControlPlaneMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function vtyCheck(): string {
  return [
    "line vty 0 4",
    "  login local",
    "  transport input ssh",
    "  exec-timeout 5 0",
  ].join("\n");
}

function aaaServers(): string {
  return [
    "RADIUS: id 1, IP 10.1.1.10, auth_port 1812, acct_port 1813",
    "     Platform: Cisco IOS",
    "     NSC Key: c1scoRADIUS",
    "     Status: ALIVE",
    "     Timeout (in seconds): 2",
    "     Retries: 3",
    "     Authentication:",
    "         Dead: 0, Duration: 0s, 0 failures",
    "         Queried: 5, Responses: 5, 0 timeouts",
    "         Last response time: 2ms",
  ].join("\n");
}

export function runLockCommand(state: LockControlPlaneMissionState, rawCommand: string): LockControlPlaneMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "local" || state.phase === "aaa";
  if (!command || state.status === "complete" || !cliPhase) return state;

  const didDo = tryRunDo(state, rawCommand, lockPromptFor(state.cliMode), runLockCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "local"
        ? "Commands: enable, configure terminal, username admin secret C1scoBranch!, line vty 0 4, login local, transport input ssh, end, show running-config | include line vty, exit, help"
        : "Commands: enable, configure terminal, aaa new-model, radius server ISE, address ipv4 10.1.1.10, key c1scoRADIUS, aaa authentication login default group radius local, end, show aaa servers, exit, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.phase === "local" && state.cliMode === "config" && command === "username admin secret c1scobranch!") {
    output = state.userCreated ? "User admin already exists." : "Local user admin created with a secret (encrypted in the config).";
    next = { ...state, userCreated: true };
  } else if (state.phase === "local" && state.cliMode === "config" && command === "line vty 0 4") {
    output = "Entering line configuration mode — apply login local and transport input ssh here.";
    nextMode = "config";
  } else if (state.phase === "local" && state.cliMode === "config" && command === "login local") {
    output = state.vtyLocal ? "VTY lines already use login local." : "VTY lines now authenticate against the local database.";
    next = { ...state, vtyLocal: true };
  } else if (state.phase === "local" && state.cliMode === "config" && command === "transport input ssh") {
    output = state.vtySsh ? "VTY lines already accept SSH only." : "VTY lines now accept SSH only — Telnet is locked out.";
    next = { ...state, vtySsh: true };
  } else if (state.phase === "local" && state.cliMode === "privileged" && command === "show running-config | include line vty") {
    output = vtyCheck();
    next = { ...state, localVerified: true };
  } else if (state.phase === "local" && (command.startsWith("username") || command.startsWith("line ") || command === "login local" || command === "transport input ssh" || command.startsWith("show running-config"))) {
    output = state.cliMode === "config" ? "That is a show command — type end first, then run it from privileged EXEC." : "Type configure terminal first, then configure the username and VTY lines.";
  } else if (state.phase === "aaa" && state.cliMode === "config" && command === "aaa new-model") {
    output = state.aaaNewModel ? "AAA is already enabled." : "AAA enabled — authentication now follows AAA methods.";
    next = { ...state, aaaNewModel: true };
  } else if (state.phase === "aaa" && state.cliMode === "config" && command === "radius server ise") {
    output = state.radiusServerDefined ? "RADIUS server ISE already defined." : "RADIUS server ISE defined — set its address and key below.";
    next = { ...state, radiusServerDefined: true };
  } else if (state.phase === "aaa" && state.cliMode === "config" && command === "address ipv4 10.1.1.10") {
    output = state.radiusServerSet ? "RADIUS address already set." : "ISE reachable at 10.1.1.10 (auth 1812 / acct 1813).";
    next = { ...state, radiusServerSet: true };
  } else if (state.phase === "aaa" && state.cliMode === "config" && command === "key c1scoradius") {
    output = state.radiusKeySet ? "RADIUS key already set." : "RADIUS shared key configured for ISE.";
    next = { ...state, radiusKeySet: true };
  } else if (state.phase === "aaa" && state.cliMode === "config" && command === "aaa authentication login default group radius local") {
    output = state.aaaLoginSet ? "Login method already set." : "Login now tries RADIUS first, then falls back to local.";
    next = { ...state, aaaLoginSet: true };
  } else if (state.phase === "aaa" && state.cliMode === "privileged" && command === "show aaa servers") {
    if (!(state.aaaNewModel && state.radiusServerDefined && state.radiusServerSet && state.radiusKeySet && state.aaaLoginSet)) {
      output = "No AAA RADIUS server is configured yet — enable AAA, define the server with its key, and set the login method first.";
    } else {
      output = aaaServers();
      next = { ...state, aaaVerified: true };
    }
  } else if (state.phase === "aaa" && (command.startsWith("aaa") || command.startsWith("radius") || command === "address ipv4 10.1.1.10" || command === "key c1scoradius" || command === "show aaa servers")) {
    output = state.cliMode === "config" ? "That is a show command — type end first, then verify with show aaa servers." : "Type configure terminal first, then configure AAA.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: lockPromptFor(state.cliMode) }];

  if (next.phase === "local" && localDone(next)) {
    return {
      ...next,
      phase: "aaa",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Local auth is locked down: a secret-based user, login local on the VTY lines, and SSH only. One router is still one password database — next, centralize it with AAA + RADIUS.", tone: "success" },
      ],
    };
  }

  if (next.phase === "aaa" && aaaDone(next)) {
    return {
      ...next,
      phase: "iacl",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "AAA is live: ISE answers auth and acct on 1812/1813, and the branch falls back to local if RADIUS goes down. Device access is centralized — now protect the infrastructure itself.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseIacl(state: LockControlPlaneMissionState, selected: LockIaclOption): LockControlPlaneMissionState {
  if (state.status === "complete" || state.phase !== "iacl") return state;

  return selected === LOCK_EXPECTED.iacl
    ? recordChoice(
        state,
        "Correct. An infrastructure ACL (iACL) applied inbound on external interfaces permits ONLY the management and control traffic the router must accept — BGP/OSPF peers, SSH/NTP from the management net — then denies everything else aimed at the device. Its own transit traffic still flows normally.",
        "success",
        { phase: "copp", selectedIacl: selected },
      )
    : recordChoice(
        state,
        selected === "permit-all"
          ? "Permitting all inbound to the device is exactly what the iACL is meant to stop — the whole point is denying everything except the allowed management and control flows."
          : "An iACL filters control-plane access, not data-plane transit — BGP is just one of the flows to permit, not the whole story.",
        "error",
        { selectedIacl: selected },
      );
}

export function chooseCopp(state: LockControlPlaneMissionState, selected: LockCoppOption): LockControlPlaneMissionState {
  if (state.status === "complete" || state.phase !== "copp") return state;

  return selected === LOCK_EXPECTED.copp
    ? recordChoice(
        state,
        "Correct. CoPP polices traffic destined to the control plane: matched classes get a police rate, and everything that exceeds it is dropped before it can burn CPU. Management traffic (SSH, NTP, routing protocols) is admitted; floods aimed at the control plane are throttled.",
        "success",
        { phase: "rest", selectedCopp: selected },
      )
    : recordChoice(
        state,
        selected === "copp-blocks-https"
          ? "CoPP polices control-plane traffic — HTTPS management is a class you explicitly admit, not something CoPP blocks by default."
          : "CoPP is applied on the control-plane interface — it does not replace the iACL. The ACL filters who can reach the device; CoPP rates what the control plane must process.",
        "error",
        { selectedCopp: selected },
      );
}

export function chooseRest(state: LockControlPlaneMissionState, selected: LockRestOption): LockControlPlaneMissionState {
  if (state.status === "complete" || state.phase !== "rest") return state;

  return selected === LOCK_EXPECTED.rest
    ? recordChoice(
        state,
        "Correct. REST API security means TLS (HTTPS) everywhere, authenticating with API keys or tokens, authorizing by role, rate limiting, and validating input. A plaintext or wide-open API is an unauthenticated remote-control channel for the attacker.",
        "success",
        { phase: "design", selectedRest: selected },
      )
    : recordChoice(
        state,
        selected === "api-plaintext"
          ? "Plaintext API calls let anyone on the path read the credentials and replay them — TLS is the baseline for any REST API security story."
          : "An open API with no auth is exactly the hole you are here to close — API keys and HTTPS are the minimum.",
        "error",
        { selectedRest: selected },
      );
}

export function chooseDesign(state: LockControlPlaneMissionState, selected: LockDesignOption): LockControlPlaneMissionState {
  if (state.status === "complete" || state.phase !== "design") return state;

  return selected === LOCK_EXPECTED.design
    ? recordChoice(
        state,
        "Correct. Defense in depth: endpoint security (NAC/antivirus) keeps bad devices off, a next-generation firewall inspects application flows, TrustSec tags traffic with SGTs for policy enforcement, and MACsec encrypts links at Layer 2. Each layer covers the one below it — the plane is locked, not just one door.",
        "success",
        { phase: "complete", status: "complete", selectedDesign: selected },
      )
    : recordChoice(
        state,
        selected === "macsec-l3"
          ? "MACsec encrypts Layer 2 (the link) — it does not replace the L3 firewall. The layers work together: MACsec on links, NGFW at the edge, SGTs for policy."
          : "TrustSec enforces policy with SGT tags — it is not an 802.1X supplicant protocol. 802.1X authenticates ports; SGTs carry security classification.",
        "error",
        { selectedDesign: selected },
      );
}

const INVALID = "% Invalid input detected at '^' marker.";
