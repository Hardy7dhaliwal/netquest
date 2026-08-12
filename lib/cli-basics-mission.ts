export type CliBasicsStatus = "not_started" | "in_progress" | "complete";
export type CliBasicsStep = "help" | "enable" | "configure" | "end" | "show-version" | "complete";
export type CliMode = "exec" | "privileged" | "config";

export type CliBasicsEntry = { input: string; output: string; prompt: string };
export type CliBasicsEvent = { message: string; tone: "info" | "success" | "error" };

export type CliBasicsMissionState = {
  status: CliBasicsStatus;
  step: CliBasicsStep;
  cliMode: CliMode;
  cliHistory: CliBasicsEntry[];
  eventLog: CliBasicsEvent[];
  attempts: number;
};

export const CLI_BASICS_STEPS: Exclude<CliBasicsStep, "complete">[] = ["help", "enable", "configure", "end", "show-version"];

export const CLI_BASICS_PROMPTS: Record<CliMode, string> = {
  exec: "SW1>",
  privileged: "SW1#",
  config: "SW1(config)#",
};

export function cliBasicsPromptFor(mode: CliMode) {
  return CLI_BASICS_PROMPTS[mode];
}

export const INITIAL_CLI_BASICS_MISSION: CliBasicsMissionState = {
  status: "not_started",
  step: "help",
  cliMode: "exec",
  cliHistory: [],
  eventLog: [],
  attempts: 0,
};

export function resetCliBasicsMission(): CliBasicsMissionState {
  return { ...INITIAL_CLI_BASICS_MISSION, cliHistory: [], eventLog: [] };
}

export function startCliBasicsMission(): CliBasicsMissionState {
  return {
    ...resetCliBasicsMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. Follow the guide to learn your first console commands.", tone: "info" }],
  };
}

function event(message: string, tone: CliBasicsEvent["tone"] = "info"): CliBasicsEvent {
  return { message, tone };
}

function advance(state: CliBasicsMissionState, nextStep: CliBasicsStep, message: string, tone: CliBasicsEvent["tone"]): CliBasicsMissionState {
  return {
    ...state,
    step: nextStep,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, event(message, tone)],
  };
}

function helpOutput(mode: CliMode): string {
  if (mode === "exec") {
    return [
      "Commands available in user EXEC mode:",
      "  enable   — enter privileged EXEC mode (#)",
      "  help     — show this list",
      "  exit     — leave the console session",
    ].join("\n");
  }
  if (mode === "privileged") {
    return [
      "Commands available in privileged EXEC mode:",
      "  show version         — display device and IOS information",
      "  configure terminal   — enter global configuration mode",
      "  end                  — return to privileged EXEC",
      "  exit                 — return to user EXEC",
      "  help                 — show this list",
    ].join("\n");
  }
  return [
    "Commands available in global configuration mode:",
    "  end      — return to privileged EXEC",
    "  exit     — return to privileged EXEC",
    "  help     — show this list",
  ].join("\n");
}

export function runCliBasicsCommand(state: CliBasicsMissionState, rawCommand: string): CliBasicsMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  if (!command || state.status === "complete") return state;

  let output = "";
  let nextMode = state.cliMode;
  let next: CliBasicsMissionState = state;

  if (command === "help" || command === "?") {
    output = helpOutput(state.cliMode);
    if (state.step === "help") {
      next = advance(state, "enable", "You ran help — the switch just listed what it can do. Every CLI starts here.", "success");
    }
  } else if (command === "exit") {
    nextMode = state.cliMode === "config" ? "privileged" : state.cliMode === "privileged" ? "exec" : "exec";
    output = state.cliMode === "exec" ? "User EXEC is the lowest mode — there is nowhere else to go." : "Returned to " + (nextMode === "privileged" ? "privileged EXEC." : "user EXEC.");
  } else if (state.cliMode === "exec" && command === "enable") {
    nextMode = "privileged";
    output = "Privileged EXEC is now active. The prompt changed from > to #.";
    if (state.step === "enable") {
      next = advance(state, "configure", "Privileged EXEC unlocked — most real commands (show, configure) need this mode.", "success");
    }
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
    if (state.step === "configure") {
      next = advance(state, "end", "You are in global configuration mode — the place where changes are made.", "success");
    }
  } else if (state.cliMode === "config" && command === "end") {
    nextMode = "privileged";
    output = "SW1#";
    if (state.step === "end") {
      next = advance(state, "show-version", "end jumped straight back to privileged EXEC — exit only moves back one mode at a time.", "success");
    }
  } else if (state.cliMode === "privileged" && command === "show version") {
    output = [
      "Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.2(4)E3, RELEASE SOFTWARE",
      "System uptime is 6 hours, 42 minutes",
      "System image file is flash:c2960-lanbasek9-mz.152-4.E3.bin",
      "cisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory",
    ].join("\n");
    if (state.step === "show-version") {
      next = advance(state, "complete", "You read the switch identity — model, IOS version, uptime. Console basics complete!", "success");
      next = { ...next, status: "complete" };
    }
  } else if (command.startsWith("show")) {
    output = "Type enable first — show commands run in privileged EXEC mode.";
  } else {
    output = "% That command isn't recognized here. Type help to see what this switch understands.";
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: cliBasicsPromptFor(state.cliMode) }];
  return {
    ...next,
    cliMode: nextMode,
    cliHistory: history,
  };
}
