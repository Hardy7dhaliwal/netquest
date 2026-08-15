import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";

export type EcStatus = "not_started" | "in_progress" | "complete";
export type EcPhase = "evidence" | "cause" | "config" | "verify" | "complete";
export type EcCliMode = "user" | "privileged" | "config" | "config-if";
export type EvidenceOption = "missing-link" | "healthy-bundle" | "no-lacp";
export type CauseOption = "passive-passive" | "group-mismatch" | "access-mode";

export type EcEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type EcCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const EC_PHASES: Exclude<EcPhase, "complete">[] = ["evidence", "cause", "config", "verify"];

export type EcMissionState = {
  status: EcStatus;
  phase: EcPhase;
  cliMode: EcCliMode;
  cliHistory: EcCliEntry[];
  selectedEvidence: EvidenceOption | null;
  selectedCause: CauseOption | null;
  ecConfigured: boolean;
  ecVerified: boolean;
  attempts: number;
  eventLog: EcEvent[];
};

export const EC_EXPECTED = {
  evidence: "missing-link",
  cause: "passive-passive",
} as const;

export const INITIAL_EC_MISSION: EcMissionState = {
  status: "not_started",
  phase: "evidence",
  cliMode: "user",
  cliHistory: [],
  selectedEvidence: null,
  selectedCause: null,
  ecConfigured: false,
  ecVerified: false,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";

export function ecPromptFor(mode: EcCliMode) {
  if (mode === "user") return "SW1>";
  if (mode === "privileged") return "SW1#";
  if (mode === "config") return "SW1(config)#";
  return "SW1(config-if)#";
}

export function resetEcMission(): EcMissionState {
  return { ...INITIAL_EC_MISSION, cliHistory: [], eventLog: [] };
}

export function startEcMission(): EcMissionState {
  return {
    ...resetEcMission(),
    status: "in_progress",
    eventLog: [{ message: "Mission started. Read the channel summary and find the missing link.", tone: "info" }],
  };
}

function recordChoice(
  state: EcMissionState,
  message: string,
  tone: EcEvent["tone"],
  updates: Partial<EcMissionState> = {},
): EcMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function channelSummary(bundled: boolean): string {
  const ports = bundled ? "Gi0/1(P)   Gi0/2(P)" : "Gi0/1(P)   Gi0/2";
  return [
    "Flags:  D - down        P - bundled in port-channel",
    "        I - stand-alone s - suspended",
    "        U - in use      f - failed to allocate aggregator",
    "",
    "Number of channel-groups in use: 1",
    "Number of aggregators:           1",
    "",
    "Group  Port-channel  Protocol    Ports",
    "------+-------------+-----------+-----------------------------------------------",
    `1      Po1(SU)         LACP      ${ports}`,
  ].join("\n");
}

export function runEcCommand(state: EcMissionState, rawCommand: string): EcMissionState {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const cliPhase = state.phase === "config" || state.phase === "verify";
  if (!command || state.status === "complete" || !cliPhase) return state;

  const didDo = tryRunDo(state, rawCommand, ecPromptFor(state.cliMode), runEcCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "config"
        ? "Commands: enable, configure terminal, interface gi0/2, channel-group 1 mode active, show etherchannel summary, end, exit, help"
        : "Commands: enable, show etherchannel summary, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode = state.cliMode === "config-if" ? "config" : state.cliMode === "config" ? "privileged" : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.phase === "config" && state.cliMode === "config" && command === "interface gi0/2") {
    nextMode = "config-if";
  } else if (state.phase === "config" && state.cliMode === "config-if" && command === "channel-group 1 mode active") {
    output = state.ecConfigured ? "LACP already active on Gi0/2." : "LACP negotiation started — the passive neighbor will now respond, and Gi0/2 joins Po1.";
    next = { ...state, ecConfigured: true };
  } else if (state.phase === "config" && state.cliMode === "privileged" && command === "show etherchannel summary") {
    // The config phase advances on the channel-group command itself, so an
    // interim read can only ever show the still-broken bundle.
    output = channelSummary(false);
  } else if (state.phase === "config" && command === "show etherchannel summary") {
    output = "Type end to return to privileged EXEC, then check with show etherchannel summary.";
  } else if (state.phase === "config" && command.startsWith("channel-group")) {
    output = "Enter the interface first: configure terminal, then interface gi0/2 from global config.";
  } else if (state.phase === "verify" && state.cliMode === "privileged" && command === "show etherchannel summary") {
    output = channelSummary(true);
    next = { ...state, ecVerified: true };
  } else if (state.phase === "verify" && command === "show etherchannel summary") {
    output = "Type enable to enter privileged EXEC, then verify with show etherchannel summary.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: ecPromptFor(state.cliMode) }];

  if (next.phase === "config" && next.ecConfigured) {
    return {
      ...next,
      phase: "verify",
      cliMode: "user", // Fresh console for the proof drill.
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Gi0/2 is now LACP active — the bundle is forming. Prove it: read the summary from a fresh console.", tone: "success" },
      ],
    };
  }

  if (next.phase === "verify" && next.ecVerified) {
    return {
      ...next,
      phase: "complete",
      status: "complete",
      cliMode: nextMode,
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Both members show (P) under Port-Channel 1 (SU) — the 2 Gbps bundle is whole.", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseEvidence(state: EcMissionState, selectedEvidence: EvidenceOption): EcMissionState {
  if (state.status === "complete" || state.phase !== "evidence") return state;

  return selectedEvidence === EC_EXPECTED.evidence
    ? recordChoice(
        state,
        "Correct. Port-Channel 1 lists only Gi0/1; Gi0/2 is absent, so the bundle is incomplete.",
        "success",
        { phase: "cause", selectedEvidence },
      )
    : recordChoice(
        state,
        "Check the summary again: Gi0/2 does not appear under Port-Channel 1, so it never joined the bundle.",
        "error",
        { selectedEvidence },
      );
}

export function chooseCause(state: EcMissionState, selectedCause: CauseOption): EcMissionState {
  if (state.status === "complete" || state.phase !== "cause") return state;

  return selectedCause === EC_EXPECTED.cause
    ? recordChoice(
        state,
        "Correct. With LACP passive on both ends, neither side sends LACP PDUs, so the link can never bundle. Now type the fix.",
        "success",
        { phase: "config", selectedCause },
      )
    : recordChoice(
        state,
        selectedCause === "group-mismatch"
          ? "Both ends are channel-group 1, so the group numbers match. Look at the LACP modes instead."
          : "Trunk versus access mode is not the blocker here; the two LACP modes are.",
        "error",
        { selectedCause },
      );
}
