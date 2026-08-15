import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";

export type EdgeServicesStatus = "not_started" | "in_progress" | "complete";
export type EdgeServicesPhase = "qos" | "ntp" | "nat-config" | "nat-drill" | "multicast" | "complete";
export type EdgeServicesCliMode = "user" | "privileged" | "config" | "config-if";
export type EdgeServicesQosOption = "voice-ef" | "policy-marks" | "policy-shapes";
export type EdgeServicesNtpOption = "source-lo" | "steps-clock" | "ptp-config";
export type EdgeServicesMulticastOption = "rpf-check" | "spm-flood" | "igmpv3-any";
export type EdgeServicesMulticastDrillOption = "msdp-peers" | "bidir-flood" | "ssm-many";

export type EdgeServicesEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type EdgeServicesCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const EDGE_SERVICES_PHASES: Exclude<EdgeServicesPhase, "complete">[] = ["qos", "ntp", "nat-config", "nat-drill", "multicast"];

export type EdgeServicesMissionState = {
  status: EdgeServicesStatus;
  phase: EdgeServicesPhase;
  cliMode: EdgeServicesCliMode;
  cliHistory: EdgeServicesCliEntry[];
  natInsideSet: boolean;
  natOutsideSet: boolean;
  natAclSet: boolean;
  natOverloadSet: boolean;
  natVerified: boolean;
  natDrillVerified: boolean;
  selectedQos: EdgeServicesQosOption | null;
  selectedNtp: EdgeServicesNtpOption | null;
  selectedMulticast: EdgeServicesMulticastOption | null;
  selectedMulticastDrill: EdgeServicesMulticastDrillOption | null;
  attempts: number;
  eventLog: EdgeServicesEvent[];
};

export const EDGE_SERVICES_EXPECTED = {
  qos: "voice-ef",
  ntp: "source-lo",
  multicast: "rpf-check",
  multicastDrill: "msdp-peers",
} as const;

export const INITIAL_EDGE_SERVICES_MISSION: EdgeServicesMissionState = {
  status: "not_started",
  phase: "qos",
  cliMode: "user",
  cliHistory: [],
  natInsideSet: false,
  natOutsideSet: false,
  natAclSet: false,
  natOverloadSet: false,
  natVerified: false,
  natDrillVerified: false,
  selectedQos: null,
  selectedNtp: null,
  selectedMulticast: null,
  selectedMulticastDrill: null,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";

export function edgeServicesPromptFor(mode: EdgeServicesCliMode) {
  if (mode === "user") return "R-EDGE>";
  if (mode === "privileged") return "R-EDGE#";
  if (mode === "config") return "R-EDGE(config)#";
  return "R-EDGE(config-if)#";
}

export function natConfigured(state: EdgeServicesMissionState) {
  return state.natInsideSet && state.natOutsideSet && state.natAclSet && state.natOverloadSet;
}

export function resetEdgeServicesMission(): EdgeServicesMissionState {
  return { ...INITIAL_EDGE_SERVICES_MISSION, cliHistory: [], eventLog: [] };
}

export function startEdgeServicesMission(): EdgeServicesMissionState {
  return {
    ...resetEdgeServicesMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. The branch edge goes live today: interpret the QoS policy and clock config, then build PAT so 10.0.1.x hosts can reach the internet — and prove it with the translation table.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: EdgeServicesMissionState,
  message: string,
  tone: EdgeServicesEvent["tone"],
  updates: Partial<EdgeServicesMissionState> = {},
): EdgeServicesMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function natStatistics(): string {
  return [
    "Total active translations: 4 (1 static, 3 dynamic; 3 extended)",
    "Peak translations: 6",
    "Outside interfaces: GigabitEthernet0/1",
    "Inside interfaces: GigabitEthernet0/0",
    "Hits: 142  Misses: 0",
  ].join("\n");
}

function natTranslations(): string {
  return [
    "Pro Inside global      Inside local       Outside local    Outside global",
    "tcp 203.0.113.5:52110  10.0.1.10:52110    198.51.100.8:80  198.51.100.8:80",
    "tcp 203.0.113.5:52114  10.0.1.11:52114    198.51.100.8:80  198.51.100.8:80",
    "udp 203.0.113.5:40312  10.0.1.12:40312    198.51.100.53:53 198.51.100.53:53",
    "--- 203.0.113.5        10.0.1.20          ---              ---",
    "Total active translations: 4",
  ].join("\n");
}

export function runEdgeServicesCommand(state: EdgeServicesMissionState, rawCommand: string): EdgeServicesMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "nat-config" || state.phase === "nat-drill";
  if (!command || state.status === "complete" || !cliPhase) return state;

  const didDo = tryRunDo(state, rawCommand, edgeServicesPromptFor(state.cliMode), runEdgeServicesCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "nat-config"
        ? "Commands: enable, configure terminal, interface gi0/0, ip nat inside, interface gi0/1, ip nat outside, access-list 1 permit 10.0.1.0 0.0.0.255, ip nat inside source list 1 interface gi0/1 overload, show ip nat statistics, end, exit, help"
        : "Commands: enable, show ip nat translations, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config-if" ? "config" : state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.phase === "nat-config" && state.cliMode === "config" && (command === "interface gi0/0" || command === "interface gi0/1")) {
    nextMode = "config-if";
  } else if (state.phase === "nat-config" && state.cliMode === "config-if" && (command === "ip nat inside" || command === "ip nat outside")) {
    const isInside = command === "ip nat inside";
    output = isInside
      ? (state.natInsideSet ? "Inside already marked on Gi0/0." : "Gi0/0 marked as the NAT inside interface.")
      : state.natOutsideSet
        ? "Outside already marked on Gi0/1."
        : "Gi0/1 marked as the NAT outside interface.";
    next = isInside ? { ...state, natInsideSet: true } : { ...state, natOutsideSet: true };
  } else if (state.phase === "nat-config" && state.cliMode === "config" && command === "access-list 1 permit 10.0.1.0 0.0.0.255") {
    output = state.natAclSet ? "ACL 1 already permits 10.0.1.0/24." : "ACL 1 permits the LAN subnet 10.0.1.0/24 — the traffic NAT will translate.";
    next = { ...state, natAclSet: true };
  } else if (state.phase === "nat-config" && state.cliMode === "config" && command === "ip nat inside source list 1 interface gi0/1 overload") {
    output = state.natOverloadSet
      ? "PAT already enabled — inside source list 1 overloads interface Gi0/1."
      : "PAT enabled — LAN flows will share 203.0.113.5 using overloaded ports.";
    next = { ...state, natOverloadSet: true };
  } else if (state.phase === "nat-config" && state.cliMode === "privileged" && command === "show ip nat statistics") {
    if (!natConfigured(state)) {
      output = "NAT is not active.\nMark inside/outside interfaces, permit the LAN with an ACL, and enable the overload rule first.";
    } else {
      output = natStatistics();
      next = { ...state, natVerified: true };
    }
  } else if (state.phase === "nat-config" && command === "show ip nat statistics") {
    output = "Type end to return to privileged EXEC, then verify with show ip nat statistics.";
  } else if (state.phase === "nat-config" && command.startsWith("access-list")) {
    output = state.cliMode === "config-if"
      ? "access-list is a global configuration command — type exit to return to global config, then add ACL 1."
      : "Type configure terminal first: access-list is a global configuration command.";
  } else if (state.phase === "nat-config" && command.startsWith("ip nat")) {
    output = state.cliMode === "config-if"
      ? "ip nat inside/outside belongs on an interface — you are already on one. exit back to global config for the ACL and overload rule."
      : "Mark the interfaces first: interface gi0/0 then ip nat inside, interface gi0/1 then ip nat outside.";
  } else if (state.phase === "nat-drill" && state.cliMode === "privileged" && command === "show ip nat translations") {
    output = natTranslations();
    next = { ...state, natDrillVerified: true };
  } else if (state.phase === "nat-drill" && command === "show ip nat translations") {
    output = "Type enable to enter privileged EXEC, then read the translations with show ip nat translations.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: edgeServicesPromptFor(state.cliMode) }];

  if (next.phase === "nat-config" && natConfigured(next) && next.natVerified) {
    return {
      ...next,
      phase: "nat-drill",
      cliMode: "user", // Fresh console for the payoff drill, like the failover switch.
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "NAT is live — LAN flows are translating to 203.0.113.5. Host-A is mid-session on the web right now; read the translation table to watch PAT work.", tone: "success" },
      ],
    };
  }

  if (next.phase === "nat-drill" && next.natDrillVerified) {
    return {
      ...next,
      phase: "multicast",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "PAT is proven: many LAN hosts share one public address through overloaded ports. One last check — how does multicast stay loop-free?", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseQos(state: EdgeServicesMissionState, selectedQos: EdgeServicesQosOption): EdgeServicesMissionState {
  if (state.status === "complete" || state.phase !== "qos") return state;

  return selectedQos === EDGE_SERVICES_EXPECTED.qos
    ? recordChoice(
        state,
        "Correct. The class-map classifies by matching DSCP EF; in the policy-map, priority 1000 gives voice strict-priority (LLQ) treatment. Nothing here marks or shapes.",
        "success",
        { phase: "ntp", selectedQos },
      )
    : recordChoice(
        state,
        selectedQos === "policy-marks"
          ? "class-map VOICE matches DSCP EF — it never sets it. Marking would need a set dscp command inside the policy."
          : "bandwidth 20000 guarantees a share on class-default; it is not shaping. Shaping uses shape average on the policy.",
        "error",
        { selectedQos },
      );
}

export function chooseNtp(state: EdgeServicesMissionState, selectedNtp: EdgeServicesNtpOption): EdgeServicesMissionState {
  if (state.status === "complete" || state.phase !== "ntp") return state;

  return selectedNtp === EDGE_SERVICES_EXPECTED.ntp
    ? recordChoice(
        state,
        "Correct. ntp source Loopback0 pins the source address for all NTP packets, so sync survives WAN interface flapping — and prefer only influences which server is chosen.",
        "success",
        { phase: "nat-config", selectedNtp },
      )
    : recordChoice(
        state,
        selectedNtp === "steps-clock"
          ? "NTP slews the clock gradually — it never steps it on a normal sync. prefer just weights the server selection."
          : "That is an NTP configuration, not PTP. PTP (IEEE 1588) uses boundary and transparent clocks with hardware timestamps — none of that appears here.",
        "error",
        { selectedNtp },
      );
}

export function chooseMulticast(state: EdgeServicesMissionState, selectedMulticast: EdgeServicesMulticastOption): EdgeServicesMissionState {
  if (state.status === "complete" || state.phase !== "multicast") return state;

  return selectedMulticast === EDGE_SERVICES_EXPECTED.multicast
    ? recordChoice(
        state,
        "Correct. The RPF check is multicast's loop guard: a packet is forwarded only when it arrives on the interface that leads back toward the source. One more — which protocol peers RPs so separate PIM-SM domains can share sources?",
        "success",
        { selectedMulticast },
      )
    : recordChoice(
        state,
        selectedMulticast === "spm-flood"
          ? "PIM sparse mode builds shared trees with explicit joins — it is dense mode that floods groups everywhere."
          : "IGMPv2 joins are any-source, but IGMPv3 adds source-specific (S,G) joins with include/exclude lists — that is its whole point.",
        "error",
        { selectedMulticast },
      );
}

export function chooseMulticastDrill(state: EdgeServicesMissionState, selectedMulticastDrill: EdgeServicesMulticastDrillOption): EdgeServicesMissionState {
  if (state.status === "complete" || state.phase !== "multicast" || state.selectedMulticast !== EDGE_SERVICES_EXPECTED.multicast) return state;

  return selectedMulticastDrill === EDGE_SERVICES_EXPECTED.multicastDrill
    ? recordChoice(
        state,
        "Correct. MSDP lets separate PIM-SM domains exchange source information: each domain's RP peers with the others (TCP 639), so one domain's sources become reachable in another. Contrast that with SSM — source-specific (S,G) trees for one-to-many delivery via IGMPv3 joins — and bidir PIM, which serves dense many-to-many groups with a single shared tree through the RP.",
        "success",
        { phase: "complete", status: "complete", selectedMulticastDrill },
      )
    : recordChoice(
        state,
        selectedMulticastDrill === "bidir-flood"
          ? "Flooding is dense mode's style. Bidir PIM builds ONE shared tree through the RP for many-to-many groups — no per-source trees, which is why it scales."
          : "SSM is the opposite of broadcast-style delivery: it is one-to-many and source-specific — hosts join (S,G) with IGMPv3. The protocol that peers RPs across separate domains is MSDP.",
        "error",
        { selectedMulticastDrill },
      );
}
