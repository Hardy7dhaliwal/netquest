import { iosHelpForMode } from "./ios-help";

export type SignalStatus = "not_started" | "in_progress" | "complete";
export type SignalPhase = "diagnose" | "flow" | "span" | "sla" | "controller" | "netconf" | "final-check" | "complete";
export type SignalCliMode = "user" | "privileged" | "config";
export type SignalFlowOption = "fnf-export" | "packet-capture" | "snmp-polling";
export type SignalControllerOption = "design-comply" | "assurance" | "ipsla-ctrl";
export type SignalNetconfOption = "restconf-yang" | "netconf-ssh-only" | "cli-only";

export type SignalEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type SignalCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const SIGNAL_PHASES: Exclude<SignalPhase, "complete">[] = ["diagnose", "flow", "span", "sla", "controller", "netconf", "final-check"];

export type SignalDetectiveMissionState = {
  status: SignalStatus;
  phase: SignalPhase;
  cliMode: SignalCliMode;
  cliHistory: SignalCliEntry[];
  // diagnose phase (R-CORE)
  pinged: boolean;
  traced: boolean;
  ifChecked: boolean;
  debugSeen: boolean;
  aclSeen: boolean;
  // span phase (R-CORE)
  spanConfigured: boolean;
  spanVerified: boolean;
  // sla phase (R-EDGE)
  slaConfigured: boolean;
  slaVerified: boolean;
  // netconf phase (R-CORE)
  netconfRead: boolean;
  selectedFlow: SignalFlowOption | null;
  selectedController: SignalControllerOption | null;
  selectedNetconf: SignalNetconfOption | null;
  attempts: number;
  eventLog: SignalEvent[];
};

export const SIGNAL_EXPECTED = {
  flow: "fnf-export",
  controller: "design-comply",
  netconf: "restconf-yang",
} as const;

export const INITIAL_SIGNAL_DETECTIVE_MISSION: SignalDetectiveMissionState = {
  status: "not_started",
  phase: "diagnose",
  cliMode: "user",
  cliHistory: [],
  pinged: false,
  traced: false,
  ifChecked: false,
  debugSeen: false,
  aclSeen: false,
  spanConfigured: false,
  spanVerified: false,
  slaConfigured: false,
  slaVerified: false,
  netconfRead: false,
  selectedFlow: null,
  selectedController: null,
  selectedNetconf: null,
  attempts: 0,
  eventLog: [],
};

export function signalPromptFor(mode: SignalCliMode) {
  if (mode === "user") return "R-CORE>";
  if (mode === "config") return "R-CORE(config)#";
  return "R-CORE#";
}

export function diagnoseDone(state: SignalDetectiveMissionState) {
  return state.pinged && state.traced && state.ifChecked && state.debugSeen && state.aclSeen;
}

export function spanDone(state: SignalDetectiveMissionState) {
  return state.spanConfigured && state.spanVerified;
}

export function slaDone(state: SignalDetectiveMissionState) {
  return state.slaConfigured && state.slaVerified;
}

export function resetSignalDetectiveMission(): SignalDetectiveMissionState {
  return { ...INITIAL_SIGNAL_DETECTIVE_MISSION, cliHistory: [], eventLog: [] };
}

export function startSignalDetectiveMission(): SignalDetectiveMissionState {
  return {
    ...resetSignalDetectiveMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. Users on the 10.20.0.0/24 floor say the finance app is crawling. You are the signal detective: collect the evidence on R-CORE, find what is eating the link, then set up telemetry so the next outage finds itself.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: SignalDetectiveMissionState,
  message: string,
  tone: SignalEvent["tone"],
  updates: Partial<SignalDetectiveMissionState> = {},
): SignalDetectiveMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function pingResult(): string {
  return [
    "Type escape sequence to abort.",
    "Sending 5, 100-byte ICMP Echos to 10.20.0.1, timeout is 2 seconds:",
    "!!!!!",
    "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms",
  ].join("\n");
}

function traceResult(): string {
  return [
    "Type escape sequence to abort.",
    "Tracing the route to 10.20.0.1",
    "VRF info: (vrf in name/id, vrf out name/id)",
    "  1 192.0.2.1 1 msec 1 msec 1 msec",
    "  2 10.20.0.1 2 msec 3 msec 2 msec",
  ].join("\n");
}

function ifErrors(): string {
  return [
    "GigabitEthernet0/1 is up, line protocol is up",
    "  Hardware is GigabitEthernet, address is 00:1c:58:aa:bb:cc",
    "  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec",
    "     reliability 255/255, txload 1/255, rxload 155/255",
    "  Input queue: 0/2000/0/0 (size/max/drops/flushes)",
    "  Input errors: 48213, CRC: 41277, frame: 0, overrun: 0",
    "  Output queue: 0/40 (size/max)",
  ].join("\n");
}

function debugPacket(): string {
  return [
    "IP: s=10.20.0.100 (GigabitEthernet0/1), d=203.0.113.66, len 60, proto UDP",
    "    src 10.20.0.100:59233, dst 203.0.113.66:9999",
    "    UDP: dropped by ACL 150",
    "IP: s=10.20.0.101 (GigabitEthernet0/1), d=203.0.113.66, len 60, proto UDP",
    "    src 10.20.0.101:51770, dst 203.0.113.66:9999",
    "    UDP: dropped by ACL 150",
  ].join("\n");
}

function flowConfig(): string {
  return [
    "flow record FN-RECORD",
    "  match ipv4 source address",
    "  match ipv4 destination address",
    "  collect counter bytes",
    "  collect counter packets",
    "flow exporter FN-EXPORTER",
    "  destination 203.0.113.50",
    "  transport udp 2055",
    "flow monitor FN-MONITOR",
    "  record FN-RECORD",
    "  exporter FN-EXPORTER",
    "interface gi0/1",
    "  ip flow monitor FN-MONITOR input",
  ].join("\n");
}

function monitorSession(): string {
  return [
    "Session 1",
    "---------",
    "Type                   : Local Session",
    "Source Ports           :",
    "    Both               : Gi0/1",
    "Destination Ports      : Gi0/2",
    "    Encapsulation      : Native (Default)",
    "    Ingress            : Disabled",
  ].join("\n");
}

function slaStats(): string {
  return [
    "IPSLAs Latest Operation Statistics",
    "",
    "IPSLA operation id: 10",
    "    Latest RTT: 3 milliseconds",
    "    Latest RTT (Last 10 mins): Min=1, Max=6, Avg=3",
    "    Number of successes: 98",
    "    Number of failures: 2",
    "    Operation time to complete: 1 ms",
  ].join("\n");
}

function netconfJson(): string {
  return [
    "GET /restconf/data/ietf-interfaces:interfaces/interface=GigabitEthernet0/1",
    "Accept: application/yang-data+json",
    "",
    "HTTP/1.1 200 OK",
    "Content-Type: application/yang-data+json",
    "",
    "{",
    "  \"ietf-interfaces:interface\": {",
    "    \"name\": \"GigabitEthernet0/1\",",
    "    \"description\": \"Core uplink to R-EDGE\",",
    "    \"type\": \"iana-if-type:ethernetCsmacd\",",
    "    \"enabled\": true",
    "  }",
    "}",
  ].join("\n");
}

export function runSignalCommand(state: SignalDetectiveMissionState, rawCommand: string): SignalDetectiveMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "diagnose" || state.phase === "span" || state.phase === "sla" || state.phase === "netconf";
  if (!command || state.status === "complete" || !cliPhase) return state;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "diagnose"
        ? "Commands: enable, ping 10.20.0.1, traceroute 10.20.0.1, show interface gi0/1, debug ip packet access-list 150, undebug all, exit, help"
        : state.phase === "span"
          ? "Commands: enable, configure terminal, monitor session 1 source interface gi0/1 both, monitor session 1 destination interface gi0/2, end, show monitor session 1, exit, help"
          : state.phase === "sla"
            ? "Commands: enable, configure terminal, ip sla 10, icmp-echo 203.0.113.1, frequency 60, ip sla schedule 10 life forever start-time now, end, show ip sla statistics, exit, help"
            : "Commands: enable, configure terminal, restconf, end, show restconf interface gigabitethernet0/1, exit, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.phase === "diagnose" && state.cliMode === "privileged" && command === "ping 10.20.0.1") {
    output = state.pinged ? "Already pinged — reachability is fine." : pingResult();
    next = { ...state, pinged: true };
  } else if (state.phase === "diagnose" && state.cliMode === "privileged" && command === "traceroute 10.20.0.1") {
    output = state.traced ? "Already traced the path." : traceResult();
    next = { ...state, traced: true };
  } else if (state.phase === "diagnose" && state.cliMode === "privileged" && command === "show interface gi0/1") {
    output = ifErrors();
    next = { ...state, ifChecked: true };
  } else if (state.phase === "diagnose" && state.cliMode === "privileged" && command === "debug ip packet access-list 150") {
    output = debugPacket();
    next = { ...state, debugSeen: true };
  } else if (state.phase === "diagnose" && state.cliMode === "privileged" && command === "undebug all") {
    output = "All possible debugging has been turned off";
  } else if (state.phase === "diagnose" && state.cliMode === "privileged" && command === "show ip access-lists 150") {
    output = "Extended IP access list 150\n    10 deny udp any any eq 9999 (48213 matches)";
    next = { ...state, aclSeen: true };
  } else if (state.phase === "diagnose" && (command.startsWith("ping") || command.startsWith("traceroute") || command.startsWith("show") || command.startsWith("debug") || command.startsWith("undebug"))) {
    output = "Type enable to enter privileged EXEC on R-CORE, then run the command.";
  } else if (state.phase === "span" && state.cliMode === "config" && command === "monitor session 1 source interface gi0/1 both") {
    output = "Session 1 source ports: Gi0/1 (both directions)";
    next = { ...state, spanConfigured: true };
  } else if (state.phase === "span" && state.cliMode === "config" && command === "monitor session 1 destination interface gi0/2") {
    output = "Session 1 destination port: Gi0/2";
    next = { ...state, spanConfigured: true };
  } else if (state.phase === "span" && state.cliMode === "privileged" && command === "show monitor session 1") {
    if (!state.spanConfigured) {
      output = "Session 1 does not exist — configure the source and destination ports first.";
    } else {
      output = monitorSession();
      next = { ...state, spanVerified: true };
    }
  } else if (state.phase === "span" && (command.startsWith("monitor session") || command === "show monitor session 1")) {
    output = state.cliMode === "config" ? "That is a show command — type end first, then show monitor session 1." : "Type configure terminal first, then add the monitor session commands.";
  } else if (state.phase === "sla" && state.cliMode === "config" && command === "ip sla 10") {
    output = "IPSLA operation 10 configured — define its probe below.";
  } else if (state.phase === "sla" && state.cliMode === "config" && command === "icmp-echo 203.0.113.1") {
    output = "Probe 10 sends ICMP echo to 203.0.113.1.";
    next = { ...state, slaConfigured: true };
  } else if (state.phase === "sla" && state.cliMode === "config" && command === "frequency 60") {
    output = "Probe 10 runs every 60 seconds.";
    next = { ...state, slaConfigured: true };
  } else if (state.phase === "sla" && state.cliMode === "config" && command === "ip sla schedule 10 life forever start-time now") {
    output = "Probe 10 scheduled — running forever, starting now.";
    next = { ...state, slaConfigured: true };
  } else if (state.phase === "sla" && state.cliMode === "privileged" && command === "show ip sla statistics") {
    if (!state.slaConfigured) {
      output = "No active IPSLA operations — define and schedule the probe first.";
    } else {
      output = slaStats();
      next = { ...state, slaVerified: true };
    }
  } else if (state.phase === "sla" && (command.startsWith("ip sla") || command === "icmp-echo 203.0.113.1" || command === "frequency 60" || command === "show ip sla statistics")) {
    output = state.cliMode === "config" ? "That is a show command — type end first, then show ip sla statistics." : "Type configure terminal first, then define the probe under ip sla 10.";
  } else if (state.phase === "netconf" && state.cliMode === "config" && command === "restconf") {
    output = "RESTCONF enabled on HTTPS (port 443).";
  } else if (state.phase === "netconf" && state.cliMode === "privileged" && command === "show restconf") {
    output = "RESTCONF service is enabled (HTTPS, port 443).";
  } else if (state.phase === "netconf" && state.cliMode === "privileged" && command === "show restconf interface gigabitethernet0/1") {
    output = netconfJson();
    next = { ...state, netconfRead: true };
  } else if (state.phase === "netconf" && (command.startsWith("restconf") || command.startsWith("show restconf"))) {
    output = state.cliMode === "config" ? "Type end first, then run the RESTCONF GET from privileged EXEC." : "Type configure terminal first to enable the restconf service, then GET the interface.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: signalPromptFor(state.cliMode) }];

  if (next.phase === "diagnose" && diagnoseDone(next)) {
    return {
      ...next,
      phase: "flow",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Case cracked: the link is healthy, but ACL 150 is silently dropping UDP/9999 — the finance app's traffic (48,213 hits). Now read the telemetry so the next outage finds itself.", tone: "success" },
      ],
    };
  }

  if (next.phase === "span" && spanDone(next)) {
    return {
      ...next,
      phase: "sla",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "SPAN session 1 is live — a copy of gi0/1 now feeds the analyzer. Next: measure the path to the app server so thresholds catch the next slowdown.", tone: "success" },
      ],
    };
  }

  if (next.phase === "sla" && slaDone(next)) {
    return {
      ...next,
      phase: "controller",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "IP SLA probe 10 is measuring RTT to the app server every 60 seconds — the baseline is 3 ms. Now the controller that turns all this into one workflow.", tone: "success" },
      ],
    };
  }

  if (next.phase === "netconf" && next.netconfRead) {
    return {
      ...next,
      phase: "final-check",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The interface answers over RESTCONF — YANG-modeled JSON over HTTPS. Last check: what makes RESTCONF different from the older ways?", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseFlow(state: SignalDetectiveMissionState, selected: SignalFlowOption): SignalDetectiveMissionState {
  if (state.status === "complete" || state.phase !== "flow") return state;

  return selected === SIGNAL_EXPECTED.flow
    ? recordChoice(
        state,
        "Correct. Flexible NetFlow samples traffic on gi0/1 and exports flow records (counters for bytes/packets) to the collector 203.0.113.50 over UDP 2055. It is an accounting/telemetry tool — it never copies packets, and nothing here polls devices with SNMP.",
        "success",
        { phase: "span", selectedFlow: selected },
      )
    : recordChoice(
        state,
        selected === "packet-capture"
          ? "Flexible NetFlow counts flows — it does not copy packets. Capturing full packets is SPAN's job (up next)."
          : "SNMP polling pulls counters with get requests; Flexible NetFlow pushes exported flow records to a collector.",
        "error",
        { selectedFlow: selected },
      );
}

export function chooseController(state: SignalDetectiveMissionState, selected: SignalControllerOption): SignalDetectiveMissionState {
  if (state.status === "complete" || state.phase !== "controller") return state;

  return selected === SIGNAL_EXPECTED.controller
    ? recordChoice(
        state,
        "Correct. Cisco Catalyst Center's (formerly DNA Center) Assurance module is the monitoring/health dashboard; the workflows that push settings — design templates, provisioning, and compliance checks against the golden config — are the configuration and compliance pieces of the platform.",
        "success",
        { phase: "netconf", selectedController: selected },
      )
    : recordChoice(
        state,
        selected === "assurance"
          ? "Assurance is Catalyst Center's monitoring side — health scores and insights. Configuration and compliance checks are the workflows that push and validate device settings."
          : "IP SLA runs on the routers you just configured — it is not a Catalyst Center workflow. The design/provision/compliance flow is what pushes and validates configuration.",
        "error",
        { selectedController: selected },
      );
}

export function chooseNetconf(state: SignalDetectiveMissionState, selected: SignalNetconfOption): SignalDetectiveMissionState {
  if (state.status === "complete" || state.phase !== "final-check") return state;

  return selected === SIGNAL_EXPECTED.netconf
    ? recordChoice(
        state,
        "Correct. RESTCONF is a RESTful HTTPS API (port 443) that exchanges YANG-modeled data as JSON or XML — programmatic, structured, and human-readable. NETCONF is the older sibling over SSH/830; plain CLI is neither.",
        "success",
        { phase: "complete", status: "complete", selectedNetconf: selected },
      )
    : recordChoice(
        state,
        selected === "netconf-ssh-only"
          ? "NETCONF is the SSH/830 protocol — but this GET ran over RESTCONF/HTTPS. Both speak YANG, but RESTCONF is the RESTful HTTP one."
          : "The GET response was JSON over HTTPS — that is not the CLI. RESTCONF is the programmatic interface you just used.",
        "error",
        { selectedNetconf: selected },
      );
}

const INVALID = "% Invalid input detected at '^' marker.";
