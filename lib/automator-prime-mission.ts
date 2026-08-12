export type AutomatorStatus = "not_started" | "in_progress" | "complete";
export type AutomatorPhase = "python" | "json" | "yang" | "apis" | "rest" | "eem" | "agent" | "complete";
export type AutomatorCliMode = "user" | "privileged" | "config" | "repl";
export type AutomatorYangOption = "data-model-tree" | "scripting-language" | "yaml-cli";
export type AutomatorApisOption = "rest-xsrf" | "soap-xml" | "snmp-get";
export type AutomatorRestOption = "created" | "not-found" | "server-error";
export type AutomatorAgentOption = "agentless-ssh" | "agentless-install" | "agent-no-software";

export type AutomatorEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type AutomatorCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const AUTOMATOR_PHASES: Exclude<AutomatorPhase, "complete">[] = ["python", "json", "yang", "apis", "rest", "eem", "agent"];

export type AutomatorPrimeMissionState = {
  status: AutomatorStatus;
  phase: AutomatorPhase;
  cliMode: AutomatorCliMode;
  cliHistory: AutomatorCliEntry[];
  // python phase (workstation)
  pyImport: boolean;
  pyGet: boolean;
  pyRead: boolean;
  // json phase (workstation)
  jsonEnv: boolean;
  jsonDevice: boolean;
  // eem phase (R-CORE)
  eemApplet: boolean;
  eemEvent: boolean;
  eemAction1: boolean;
  eemAction2: boolean;
  eemVerified: boolean;
  selectedYang: AutomatorYangOption | null;
  selectedApis: AutomatorApisOption | null;
  selectedRest: AutomatorRestOption | null;
  selectedAgent: AutomatorAgentOption | null;
  attempts: number;
  eventLog: AutomatorEvent[];
};

export const AUTOMATOR_EXPECTED = {
  yang: "data-model-tree",
  apis: "rest-xsrf",
  rest: "created",
  agent: "agentless-ssh",
} as const;

/** Exact strings players must type — Python and JSON are whitespace-insensitive,
 * so both sides are stripped of ALL whitespace before comparison. */
const strip = (s: string) => s.toLowerCase().replace(/\s+/g, "");

const PY_IMPORT = strip("import requests");
const PY_GET = strip(`r = requests.get("https://198.51.100.10/restconf/data/interfaces", auth=("admin", "c1scobranch!"), verify=false)`);
const PY_READ = strip(`print(r.status_code, r.json()["ietf-interfaces:interfaces"]["interface"][0]["name"])`);
const JSON_ENV = strip(`{"ietf-interfaces:interfaces": {"interface": [{"name": "loopback100", "type": "ianaift:softwareloopback", "enabled": true}]}}`);
const JSON_DEVICE = strip(`{"name": "br-1", "description": "branch router", "siteid": "site-42", "devicetype": "vedge-cloud"}`);
const EEM_APPLET = "event manager applet save-config";
const EEM_EVENT = `event syslog pattern "config_i"`;
const EEM_ACTION_1 = `action 1.0 cli command "enable"`;
const EEM_ACTION_2 = `action 2.0 cli command "write memory"`;
const EEM_VERIFY_CMD = "show running-config | include event manager applet";

export const INITIAL_AUTOMATOR_PRIME_MISSION: AutomatorPrimeMissionState = {
  status: "not_started",
  phase: "python",
  cliMode: "repl",
  cliHistory: [],
  pyImport: false,
  pyGet: false,
  pyRead: false,
  jsonEnv: false,
  jsonDevice: false,
  eemApplet: false,
  eemEvent: false,
  eemAction1: false,
  eemAction2: false,
  eemVerified: false,
  selectedYang: null,
  selectedApis: null,
  selectedRest: null,
  selectedAgent: null,
  attempts: 0,
  eventLog: [],
};

export function automatorPromptFor(phase: AutomatorPhase, mode: AutomatorCliMode) {
  if (phase === "python") return ">>>";
  if (phase === "json") return "json> ";
  if (mode === "user") return "R-CORE>";
  if (mode === "config") return "R-CORE(config)#";
  return "R-CORE#";
}

export function pythonDone(state: AutomatorPrimeMissionState) {
  return state.pyImport && state.pyGet && state.pyRead;
}

export function jsonDone(state: AutomatorPrimeMissionState) {
  return state.jsonEnv && state.jsonDevice;
}

export function eemDone(state: AutomatorPrimeMissionState) {
  return state.eemApplet && state.eemEvent && state.eemAction1 && state.eemAction2 && state.eemVerified;
}

export function resetAutomatorPrimeMission(): AutomatorPrimeMissionState {
  return { ...INITIAL_AUTOMATOR_PRIME_MISSION, cliHistory: [], eventLog: [] };
}

export function startAutomatorPrimeMission(): AutomatorPrimeMissionState {
  return {
    ...resetAutomatorPrimeMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. The operations team is going full automation: you write the Python probe, craft the JSON payloads, understand the YANG model behind them, call the SD-WAN Manager (formerly vManage) API, read the response, build the EEM applet that saves configs on change — then pick the orchestration model for the fleet.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: AutomatorPrimeMissionState,
  message: string,
  tone: AutomatorEvent["tone"],
  updates: Partial<AutomatorPrimeMissionState> = {},
): AutomatorPrimeMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

const PYTHON_HELP = "Type the three-line probe: import requests, then the requests.get(...) call against /restconf/data/interfaces, then the print(...) that reads the first interface name. Type help to see the commands again.";
const JSON_HELP = "Type the two JSON documents to construct: the ietf-interfaces envelope for Loopback100, then the SD-WAN Manager device payload for BR-1. Type help to see the commands again.";
const EEM_HELP = "Commands: enable, configure terminal, event manager applet save-config, event syslog pattern \"CONFIG_I\", action 1.0 cli command \"enable\", action 2.0 cli command \"write memory\", end, show running-config | include event manager applet, exit, help";

export function runAutomatorCommand(state: AutomatorPrimeMissionState, rawCommand: string): AutomatorPrimeMissionState {
  const trimmed = rawCommand.trim().toLowerCase();
  const codePhase = state.phase === "python" || state.phase === "json";
  const cliPhase = codePhase || state.phase === "eem";
  if (!trimmed || state.status === "complete" || !cliPhase) return state;
  // Python and JSON ignore whitespace — strip ALL of it so any spacing or line
  // breaks a player uses still match. IOS commands keep single-space runs.
  const command = codePhase ? strip(rawCommand) : trimmed.replace(/\s+/g, " ");

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "help" || command === "?") {
    output = state.phase === "python" ? PYTHON_HELP : state.phase === "json" ? JSON_HELP : EEM_HELP;
  } else if (state.phase === "python" && state.cliMode === "repl" && command === PY_IMPORT) {
    output = state.pyImport ? "requests is already imported." : "requests loaded — the HTTP client for RESTCONF.";
    next = { ...state, pyImport: true };
  } else if (state.phase === "python" && state.cliMode === "repl" && command === PY_GET) {
    output = state.pyGet ? "GET already sent." : "GET https://198.51.100.10/restconf/data/interfaces — 200 OK, 2 interfaces returned. (verify=False is a lab shortcut — production points verify at a trusted CA bundle.)";
    next = { ...state, pyGet: true };
  } else if (state.phase === "python" && state.cliMode === "repl" && command === PY_READ) {
    output = state.pyRead ? "Already read." : "200 Gi0/1 — the first interface in the returned data.";
    next = { ...state, pyRead: true };
  } else if (state.phase === "json" && state.cliMode === "repl" && command === JSON_ENV) {
    output = state.jsonEnv ? "Already valid." : "Valid JSON — the RESTCONF PUT body for the interfaces data store, matching ietf-interfaces.";
    next = { ...state, jsonEnv: true };
  } else if (state.phase === "json" && state.cliMode === "repl" && command === JSON_DEVICE) {
    output = state.jsonDevice ? "Already valid." : "Valid JSON — SD-WAN Manager device payload accepted.";
    next = { ...state, jsonDevice: true };
  } else if (state.phase === "python" || state.phase === "json") {
    output = INVALID;
  } else if (state.phase === "eem") {
    if (command === "end") {
      nextMode = "privileged";
    } else if (command === "exit") {
      nextMode = state.cliMode === "config" ? "privileged" : "user";
    } else if (state.cliMode === "user" && command === "enable") {
      nextMode = "privileged";
    } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
      nextMode = "config";
      output = "Enter configuration commands, one per line. End with CNTL/Z.";
    } else if (state.cliMode === "config" && command === EEM_APPLET) {
      output = state.eemApplet ? "Applet save-config already defined." : "Applet save-config defined — add its event and actions.";
      next = { ...state, eemApplet: true };
    } else if (state.cliMode === "config" && command === EEM_EVENT) {
      output = state.eemEvent ? "Event already set." : "Applet triggers on CONFIG_I syslog messages — config changes.";
      next = { ...state, eemEvent: true };
    } else if (state.cliMode === "config" && command === EEM_ACTION_1) {
      output = state.eemAction1 ? "Action 1.0 already set." : "Action 1.0: enters privileged EXEC when the applet fires.";
      next = { ...state, eemAction1: true };
    } else if (state.cliMode === "config" && command === EEM_ACTION_2) {
      output = state.eemAction2 ? "Action 2.0 already set." : "Action 2.0: saves the running configuration.";
      next = { ...state, eemAction2: true };
    } else if (state.cliMode === "privileged" && command === EEM_VERIFY_CMD) {
      if (!(state.eemApplet && state.eemEvent && state.eemAction1 && state.eemAction2)) {
        output = "No complete EEM applet is configured yet — define the applet, its event, and both actions first.";
      } else {
        output = [
          "event manager applet save-config",
          " event syslog pattern \"CONFIG_I\"",
          " action 1.0 cli command \"enable\"",
          " action 2.0 cli command \"write memory\"",
        ].join("\n");
        next = { ...state, eemVerified: true };
      }
    } else if (command.startsWith("event") || command.startsWith("action") || command.startsWith("show running-config")) {
      output = state.cliMode === "config" ? "That is a show command — type end first, then verify from privileged EXEC." : "Type configure terminal first, then define the applet under global config.";
    } else {
      output = INVALID;
    }
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: automatorPromptFor(state.phase, state.cliMode) }];

  if (next.phase === "python" && pythonDone(next)) {
    return {
      ...next,
      phase: "json",
      cliMode: "repl",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The probe works: one Python script, one RESTCONF GET, and the device answered 200 Gi0/1. Now build the payloads the automation will push.", tone: "success" },
      ],
    };
  }

  if (next.phase === "json" && jsonDone(next)) {
    return {
      ...next,
      phase: "yang",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Both JSON documents are valid. But why did the first one need ietf-interfaces:interfaces exactly? Because every payload is validated against a YANG model — time to understand the data model.", tone: "success" },
      ],
    };
  }

  if (next.phase === "eem" && eemDone(next)) {
    return {
      ...next,
      phase: "agent",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The applet is live: any CONFIG_I syslog triggers a config save, automatically. One box done — the final question is how to orchestrate the whole fleet.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseYang(state: AutomatorPrimeMissionState, selected: AutomatorYangOption): AutomatorPrimeMissionState {
  if (state.status === "complete" || state.phase !== "yang") return state;

  return selected === AUTOMATOR_EXPECTED.yang
    ? recordChoice(
        state,
        "Correct. YANG models network data as a tree: modules contain containers, lists, leaves, and leaf-lists. Every RESTCONF payload you send is validated against a YANG model — that is why the JSON had to match ietf-interfaces exactly.",
        "success",
        { phase: "apis", selectedYang: selected },
      )
    : recordChoice(
        state,
        selected === "scripting-language"
          ? "YANG describes data, it does not execute it — no scripts, no logic, no control flow. It is a data modeling language."
          : "YANG is not a CLI or YAML format — it describes the SHAPE of configuration and state data, independent of the encoding (JSON/XML).",
        "error",
        { selectedYang: selected },
      );
}

export function chooseApis(state: AutomatorPrimeMissionState, selected: AutomatorApisOption): AutomatorPrimeMissionState {
  if (state.status === "complete" || state.phase !== "apis") return state;

  return selected === AUTOMATOR_EXPECTED.apis
    ? recordChoice(
        state,
        "Correct. Cisco Catalyst Center (formerly DNA Center) and SD-WAN Manager (formerly vManage) expose REST APIs — /dataservice/ on SD-WAN Manager, with an X-XSRF-TOKEN header for session security, exchanging JSON over HTTPS. The controller does the heavy lifting; your script just calls endpoints.",
        "success",
        { phase: "rest", selectedApis: selected },
      )
    : recordChoice(
        state,
        selected === "soap-xml"
          ? "These are REST APIs, not SOAP web services — the SD-WAN Manager /dataservice/ endpoints exchange JSON, not SOAP XML envelopes."
          : "The device does not push SNMP traps to your script — you call the controller's REST API with a GET/PUT and JSON payloads.",
        "error",
        { selectedApis: selected },
      );
}

export function chooseRest(state: AutomatorPrimeMissionState, selected: AutomatorRestOption): AutomatorPrimeMissionState {
  if (state.status === "complete" || state.phase !== "rest") return state;

  return selected === AUTOMATOR_EXPECTED.rest
    ? recordChoice(
        state,
        "Correct. 201 Created means the PUT actually created the resource. The status code tells you the outcome before you even read the payload: 2xx success, 4xx your request was wrong, 5xx the server failed.",
        "success",
        { phase: "eem", cliMode: "user", selectedRest: selected },
      )
    : recordChoice(
        state,
        selected === "not-found"
          ? "404 would mean the URL or resource does not exist — but the call succeeded and created Loopback100. That is 201."
          : "500 is a server-side failure — the request was fine. A successful create returns 201 Created.",
        "error",
        { selectedRest: selected },
      );
}

export function chooseAgent(state: AutomatorPrimeMissionState, selected: AutomatorAgentOption): AutomatorPrimeMissionState {
  if (state.status === "complete" || state.phase !== "agent") return state;

  return selected === AUTOMATOR_EXPECTED.agent
    ? recordChoice(
        state,
        "Correct. Agentless orchestration (Ansible, for example) drives devices over SSH/WinRM with nothing installed on the target. Agent-based tools install software on every managed device and collect data locally. No agent to install means faster onboarding — and nothing to patch on the box.",
        "success",
        { phase: "complete", status: "complete", selectedAgent: selected },
      )
    : recordChoice(
        state,
        selected === "agentless-install"
          ? "Backwards: agentless tools need NOTHING on the target — they connect over SSH/WinRM. Installing software is the agent-based model."
          : "Agent-based tools DO need software on each managed device — that software is the agent, collecting and executing locally.",
        "error",
        { selectedAgent: selected },
      );
}

const INVALID = "% Invalid input detected at '^' marker.";
