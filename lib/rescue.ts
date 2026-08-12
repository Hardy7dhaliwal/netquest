export type RescueStatus = "not_started" | "in_progress" | "complete";

export type RescueEvent = { message: string; tone: "info" | "success" | "error" };

export type RescueCliEntry = { input: string; output: string; prompt: string };

export type RescueExplainStep = {
  kind: "explain";
  title: string;
  body: string;
};

export type RescueCheckpointOption = {
  value: string;
  title: string;
  note?: string;
};

export type RescueCheckpointStep = {
  kind: "checkpoint";
  title: string;
  prompt: string;
  options: RescueCheckpointOption[];
  /** Value of the correct option. */
  correct: string;
  /** Shown after a correct answer (or reveal). */
  explain: string;
  /** Shown after a wrong answer. */
  wrongGuidance: string;
};

export type RescueCliStep = {
  kind: "cli";
  device: string;
  title: string;
  /** CLI prompt label shown in the console, e.g. "SW1(config-if)#". */
  prompt: string;
  /** The exact command the player must type (compared case-insensitively). */
  command: string;
  expectedOutput: string;
  wrongHint: string;
  explain: string;
};

export type RescueStep = RescueExplainStep | RescueCheckpointStep | RescueCliStep;

export type RescueDefinition = {
  id: string;
  /** Main mission this rescue belongs to, e.g. "ospf". */
  mission: string;
  /** Main-mission phases this rescue unblocks; empty means the whole mission. */
  phases: string[];
  /** When true, this is the fallback rescue for its mission when no phase matches. */
  isDefault: boolean;
  title: string;
  /** One-line goal shown at the top. */
  teaches: string;
  /** One-liner to apply back in the main mission, shown on completion. */
  tip: string;
  steps: RescueStep[];
};

export type RescueState = {
  status: RescueStatus;
  stepIndex: number;
  /** Wrong answers across the whole rescue. */
  attempts: number;
  /** Whether "show me the answer" was used on the current step. */
  revealed: boolean;
  /** Last checkpoint option picked (for feedback display). */
  checkpointAnswer: string | null;
  lastAnswerCorrect: boolean | null;
  cliHistory: RescueCliEntry[];
  eventLog: RescueEvent[];
};

export const INITIAL_RESCUE: RescueState = {
  status: "not_started",
  stepIndex: 0,
  attempts: 0,
  revealed: false,
  checkpointAnswer: null,
  lastAnswerCorrect: null,
  cliHistory: [],
  eventLog: [],
};

export function resetRescue(): RescueState {
  return { ...INITIAL_RESCUE, cliHistory: [], eventLog: [] };
}

export function startRescue(): RescueState {
  return {
    ...resetRescue(),
    status: "in_progress",
    eventLog: [{ message: "Rescue started. This short lesson gets you back to the mission.", tone: "info" }],
  };
}

function event(message: string, tone: RescueEvent["tone"] = "info"): RescueEvent {
  return { message, tone };
}

export function currentRescueStep(state: RescueState, def: RescueDefinition): RescueStep | null {
  return def.steps[state.stepIndex] ?? null;
}

/** Moves past the current step, clearing per-step feedback; completes when past the last step. */
function advanceToNext(state: RescueState, def: RescueDefinition, message: string, tone: RescueEvent["tone"]): RescueState {
  const stepIndex = state.stepIndex + 1;
  const next: RescueState = {
    ...state,
    stepIndex,
    revealed: false,
    checkpointAnswer: null,
    lastAnswerCorrect: null,
    eventLog: [...state.eventLog, event(message, tone)],
  };
  if (stepIndex >= def.steps.length) {
    return {
      ...next,
      status: "complete",
      eventLog: [...next.eventLog, event("Rescue complete — you are ready to finish the mission.", "success")],
    };
  }
  return next;
}

/**
 * Advances past the current step when it is satisfied:
 * - explain steps always advance (Continue button);
 * - checkpoint steps advance after the answer was revealed (correct answers advance in
 *   {@link answerRescueCheckpoint}).
 * CLI steps advance only by running the right command in {@link runRescueCommand}.
 */
export function advanceRescue(state: RescueState, def: RescueDefinition): RescueState {
  if (state.status === "complete") return state;
  const step = currentRescueStep(state, def);
  if (!step) return state;

  if (step.kind === "explain") {
    return advanceToNext(state, def, "Lesson step complete.", "info");
  }
  if (step.kind === "checkpoint" && state.lastAnswerCorrect) {
    return advanceToNext(state, def, "Checkpoint passed.", "success");
  }
  return state;
}

export function answerRescueCheckpoint(state: RescueState, def: RescueDefinition, value: string): RescueState {
  if (state.status === "complete") return state;
  const step = currentRescueStep(state, def);
  if (!step || step.kind !== "checkpoint") return state;

  if (value === step.correct) {
    return advanceToNext(state, def, `Correct — ${step.explain}`, "success");
  }
  return {
    ...state,
    attempts: state.attempts + 1,
    checkpointAnswer: value,
    lastAnswerCorrect: false,
    eventLog: [...state.eventLog, event(step.wrongGuidance, "error")],
  };
}

export function revealRescueAnswer(state: RescueState, def: RescueDefinition): RescueState {
  if (state.status === "complete" || state.revealed) return state;
  // The mercy reveal only opens after the player has made at least one attempt.
  if (state.attempts < 1) return state;
  const step = currentRescueStep(state, def);
  if (!step) return state;

  if (step.kind === "checkpoint") {
    return {
      ...state,
      revealed: true,
      checkpointAnswer: step.correct,
      lastAnswerCorrect: true,
      eventLog: [...state.eventLog, event(`Answer revealed: ${step.explain}`, "info")],
    };
  }
  if (step.kind === "cli") {
    return {
      ...state,
      revealed: true,
      eventLog: [...state.eventLog, event(`Try typing: ${step.command}`, "info")],
    };
  }
  return state;
}

export function runRescueCommand(state: RescueState, def: RescueDefinition, rawCommand: string): RescueState {
  if (state.status === "complete") return state;
  const step = currentRescueStep(state, def);
  if (!step || step.kind !== "cli") return state;

  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  if (!command) return state;

  const expected = step.command.trim().toLowerCase().replace(/\s+/g, " ");
  let output = "";
  let next: RescueState;

  if (command === "help" || command === "?") {
    output = `Try: ${step.command}`;
    next = { ...state, eventLog: [...state.eventLog, event("Help shown — the command you need is listed.", "info")] };
  } else if (command === expected) {
    output = step.expectedOutput;
    next = advanceToNext(state, def, `Correct — ${step.explain}`, "success");
  } else {
    output = step.wrongHint;
    next = {
      ...state,
      attempts: state.attempts + 1,
      eventLog: [...state.eventLog, event(step.wrongHint, "error")],
    };
  }

  return {
    ...next,
    cliHistory: [...state.cliHistory, { input: rawCommand, output, prompt: step.prompt }],
  };
}
