import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";
import { normalizeIosCommand } from "./ios-abbrev";

export type ShowAndPingStatus = "not_started" | "in_progress" | "complete";
export type ShowAndPingStep = "enable" | "show-vlan" | "show-trunk" | "show-running" | "ping" | "complete";
export type CliMode = "exec" | "privileged" | "config";

export type ShowAndPingEntry = { input: string; output: string; prompt: string };
export type ShowAndPingEvent = { message: string; tone: "info" | "success" | "error" };

export type ShowAndPingMissionState = {
  status: ShowAndPingStatus;
  step: ShowAndPingStep;
  cliMode: CliMode;
  cliHistory: ShowAndPingEntry[];
  eventLog: ShowAndPingEvent[];
  attempts: number;
};

export const SHOW_PING_STEPS: Exclude<ShowAndPingStep, "complete">[] = ["enable", "show-vlan", "show-trunk", "show-running", "ping"];

export const SHOW_PING_PROMPTS: Record<CliMode, string> = {
  exec: "SW1>",
  privileged: "SW1#",
  config: "SW1(config)#",
};

export function showPingPromptFor(mode: CliMode) {
  return SHOW_PING_PROMPTS[mode];
}

export const INITIAL_SHOW_AND_PING_MISSION: ShowAndPingMissionState = {
  status: "not_started",
  step: "enable",
  cliMode: "exec",
  cliHistory: [],
  eventLog: [],
  attempts: 0,
};

export function resetShowAndPingMission(): ShowAndPingMissionState {
  return { ...INITIAL_SHOW_AND_PING_MISSION, cliHistory: [], eventLog: [] };
}

export function startShowAndPingMission(): ShowAndPingMissionState {
  return {
    ...resetShowAndPingMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. A healthy network — your job is simply to look at it.", tone: "info" }],
  };
}

function event(message: string, tone: ShowAndPingEvent["tone"] = "info"): ShowAndPingEvent {
  return { message, tone };
}

function advance(state: ShowAndPingMissionState, nextStep: ShowAndPingStep, message: string): ShowAndPingMissionState {
  return {
    ...state,
    step: nextStep,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, event(message, "success")],
  };
}

function showVlan(): string {
  return [
    "VLAN Name                             Status    Ports",
    "---- -------------------------------- --------- -------------------------------",
    "10   MANAGEMENT                        active    Gi0/1",
    "20   SALES                             active    Gi0/2",
  ].join("\n");
}

function showTrunk(): string {
  return [
    "Port        Mode         Encapsulation  Status        Native vlan",
    "Gi0/1       on           802.1q         trunking      1",
    "",
    "Port        Vlans allowed on trunk",
    "Gi0/1       10, 20",
  ].join("\n");
}

function showRunningConfig(): string {
  return [
    "Building configuration...",
    "!",
    "hostname SW1",
    "!",
    "interface GigabitEthernet0/1",
    " switchport mode trunk",
    " switchport trunk allowed vlan 10,20",
    "!",
    "interface GigabitEthernet0/2",
    " switchport access vlan 20",
    " switchport mode access",
    "!",
  ].join("\n");
}

export function runShowAndPingCommand(state: ShowAndPingMissionState, rawCommand: string): ShowAndPingMissionState {
  const command = normalizeIosCommand(rawCommand);
  if (!command || state.status === "complete") return state;

  const didDo = tryRunDo(state, rawCommand, showPingPromptFor(state.cliMode), runShowAndPingCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next: ShowAndPingMissionState = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output = state.cliMode === "privileged"
      ? [
          "Commands available in privileged EXEC mode:",
          "  show vlan brief        — list VLANs and their ports",
          "  show interfaces trunk  — inspect the inter-switch trunk",
          "  show running-config    — read the live configuration",
          "  ping 10.20.0.1         — test the path to the gateway",
          "  help                   — show this list",
        ].join("\n")
      : [
          "Commands available in user EXEC mode:",
          "  enable                 — enter privileged EXEC mode",
          "  help                   — show this list",
        ].join("\n");
  } else if (state.cliMode === "exec" && command === "enable") {
    nextMode = "privileged";
    output = "Privileged EXEC is now active.";
    if (state.step === "enable") {
      next = advance(state, "show-vlan", "You are in privileged EXEC — the home of every show command.");
    }
  } else if (state.cliMode === "privileged" && command === "show vlan brief") {
    output = showVlan();
    if (state.step === "show-vlan") {
      next = advance(state, "show-trunk", "show vlan brief lists the VLANs and which ports belong to each — here, VLAN 20 SALES lives on Gi0/2.");
    }
  } else if (state.cliMode === "privileged" && command === "show interfaces trunk") {
    output = showTrunk();
    if (state.step === "show-trunk") {
      next = advance(state, "show-running", "show interfaces trunk shows the inter-switch link and the VLANs allowed to cross it (10, 20).");
    }
  } else if (state.cliMode === "privileged" && command === "show running-config") {
    output = showRunningConfig();
    if (state.step === "show-running") {
      next = advance(state, "ping", "show running-config shows the live configuration — the source of truth for what the switch is doing.");
    }
  } else if (state.cliMode === "privileged" && command === "ping 10.20.0.1") {
    output = "!!!!!\nSuccess rate is 100 percent (5/5)";
    if (state.step === "ping") {
      next = advance(state, "complete", "ping sent five test packets and all five came back — 100% means the path works end to end. Show & Ping complete!");
      next = { ...next, status: "complete" };
    }
  } else if (state.cliMode === "exec" && (command.startsWith("show") || command.startsWith("ping"))) {
    output = "Type enable first — that command runs in privileged EXEC mode.";
  } else {
    output = "% That command isn't recognized here. Type help to see what's available.";
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: showPingPromptFor(state.cliMode) }];
  return {
    ...next,
    cliMode: nextMode,
    cliHistory: history,
  };
}
