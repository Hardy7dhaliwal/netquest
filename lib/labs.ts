import { seededRng } from "./boss";
import { iosHelpForMode } from "./ios-help";

/**
 * Hands-on labs (PRD "learn and pass" — realistic labs).
 *
 * Each lab template follows the real troubleshooting loop the exam tests:
 *   inspect  — read the device state with show commands
 *   diagnose — pick the fault from the evidence (with plausible distractors)
 *   configure— type the fix (alternate valid commands accepted)
 *   verify   — confirm the fix with show output
 *
 * Every template ships multiple VARIANTS that change the addressing, the
 * interface names, the symptom details, and the distractor set — so memorizing
 * one solution path is not enough. The engine is deterministic: the same
 * template + variant always produces the same steps and outputs. Simulator
 * limits are labeled per lab, with a recommendation to practice on
 * CML / EVE-NG / Cisco DevNet sandbox for real-device behavior.
 */

export type LabStepKind = "inspect" | "diagnose" | "configure" | "verify";

export type LabDiagnoseOption = { value: string; title: string; note?: string };

export type LabStep = {
  kind: LabStepKind;
  title: string;
  prompt: string;
  /** For inspect/verify: accepted show commands (alternate phrasings OK), or a variant-aware function. */
  commands?: string[] | ((variant: LabVariant) => string[]);
  /** Shown when an inspect/verify command runs (may depend on the variant). */
  output?: (variant: LabVariant) => string;
  /** For diagnose: the candidate explanations, one of which is correct. */
  options?: LabDiagnoseOption[];
  correct?: string;
  /** For configure: accepted fix commands (alternate valid commands), variant-aware. */
  acceptedCommands?: string[] | ((variant: LabVariant) => string[]);
  /** What the configure step confirms when applied (may depend on the variant). */
  appliedOutput?: (variant: LabVariant) => string;
  wrongHint: string;
  explain: string;
};

export type LabVariant = {
  id: string;
  label: string;
  /** The symptom the learner faces. */
  symptom: string;
  /** Addressing context (differs per variant). */
  addressing: string;
  /** Interface names (differs per variant). */
  interfaces: string;
  /** Wrong-but-plausible fix commands (distractors). */
  distractors: string[];
  /** Optional concrete values the variant's outputs interpolate. */
  values?: Record<string, string>;
};

export type LabTemplate = {
  id: string;
  title: string;
  objectiveIds: string[];
  skill: "configure" | "troubleshoot";
  /** Honest simulator limits + where to practice for real-device behavior. */
  simulatorNote: string;
  scenario: string;
  variants: LabVariant[];
  steps: LabStep[];
};

export type LabState = {
  templateId: string;
  variantId: string;
  stepIndex: number;
  status: "not_started" | "in_progress" | "complete";
  attempts: number;
  /** Clean (no wrong attempts) — the evidence for Independent mastery. */
  clean: boolean;
  cliHistory: { input: string; output: string; prompt: string }[];
  eventLog: { message: string; tone: "info" | "success" | "error" }[];
  lastAnswerCorrect: boolean | null;
  checkpointAnswer: string | null;
};

export const INITIAL_LAB: LabState = {
  templateId: "",
  variantId: "",
  stepIndex: 0,
  status: "not_started",
  attempts: 0,
  clean: true,
  cliHistory: [],
  eventLog: [],
  lastAnswerCorrect: null,
  checkpointAnswer: null,
};

export function startLab(template: LabTemplate, variantId: string): LabState {
  return {
    ...INITIAL_LAB,
    templateId: template.id,
    variantId,
    status: "in_progress",
    eventLog: [{ message: `Lab started: ${template.title} (variant ${variantId}). Read the topology, then inspect.`, tone: "info" }],
  };
}

function event(message: string, tone: LabState["eventLog"][number]["tone"]): LabState["eventLog"][number] {
  return { message, tone };
}

/** The variant of a lab by id (deterministic — variants are authored, not random). */
export function getLabVariant(template: LabTemplate, variantId: string): LabVariant {
  return template.variants.find((variant) => variant.id === variantId) ?? template.variants[0];
}

/** Pick a variant deterministically from a seed — the 'randomization' of a lab run. */
export function pickVariant(template: LabTemplate, seed: string): LabVariant {
  if (template.variants.length === 0) throw new Error(`Lab ${template.id} has no variants`);
  const rng = seededRng(`${template.id}:${seed}`);
  const index = Math.floor(rng() * template.variants.length);
  return template.variants[index];
}

function advance(state: LabState, template: LabTemplate, message: string, tone: LabState["eventLog"][number]["tone"]): LabState {
  const stepIndex = state.stepIndex + 1;
  const next: LabState = {
    ...state,
    stepIndex,
    lastAnswerCorrect: null,
    checkpointAnswer: null,
    eventLog: [...state.eventLog, event(message, tone)],
  };
  if (stepIndex >= template.steps.length) {
    return { ...next, status: "complete", eventLog: [...next.eventLog, event("Lab complete — fix applied and verified.", "success")] };
  }
  return next;
}

/**
 * Run a command against the current step. Inspect and verify steps accept any
 * of their alternate commands and advance on success; configure steps accept
 * any alternate fix and reject distractor commands with targeted feedback.
 * Any wrong command marks the run non-clean (it used hints/wrong attempts).
 */
export function runLabCommand(state: LabState, template: LabTemplate, rawCommand: string): LabState {
  if (state.status === "complete") return state;
  const step = template.steps[state.stepIndex];
  if (!step) return state;
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  if (!command) return state;

  const variant = getLabVariant(template, state.variantId);

  if (command === "?") {
    const mode = step.kind === "configure" ? "config" : "privileged";
    return {
      ...state,
      clean: false,
      cliHistory: [...state.cliHistory, { input: rawCommand, output: iosHelpForMode(mode), prompt: step.kind === "configure" ? "R1(config)#" : "R1#" }],
    };
  }
  if (command === "help") {
    const commands = typeof step.commands === "function" ? step.commands(variant) : (step.commands ?? []);
    const accepted = typeof step.acceptedCommands === "function" ? step.acceptedCommands(variant) : (step.acceptedCommands ?? []);
    const hint = commands.length ? commands[0] : accepted.length ? `e.g. ${accepted[0]}` : "Look at the prompt — which command inspects this?";
    return { ...state, clean: false, cliHistory: [...state.cliHistory, { input: rawCommand, output: `Try: ${hint}`, prompt: "R1#" }] };
  }

  if (step.kind === "inspect" || step.kind === "verify") {
    const commands = typeof step.commands === "function" ? step.commands(variant) : (step.commands ?? []);
    const match = commands.find((candidate) => candidate.trim().toLowerCase().replace(/\s+/g, " ") === command);
    if (match) {
      const next = advance(state, template, step.kind === "verify" ? "Verification output shown — confirm the fix." : "Inspection output shown.", "info");
      return {
        ...next,
        cliHistory: [...state.cliHistory, { input: rawCommand, output: step.output?.(variant) ?? "", prompt: "R1#" }],
      };
    }
    return {
      ...state,
      attempts: state.attempts + 1,
      clean: false,
      cliHistory: [...state.cliHistory, { input: rawCommand, output: step.wrongHint, prompt: "R1#" }],
      eventLog: [...state.eventLog, event(step.wrongHint, "error")],
    };
  }

  if (step.kind === "configure") {
    const accepted = typeof step.acceptedCommands === "function" ? step.acceptedCommands(variant) : (step.acceptedCommands ?? []);
    const match = accepted.find((candidate) => candidate.trim().toLowerCase().replace(/\s+/g, " ") === command);
    if (match) {
      const next = advance(state, template, `Fix applied — ${step.explain}`, "success");
      return {
        ...next,
        cliHistory: [...state.cliHistory, { input: rawCommand, output: step.appliedOutput?.(variant) ?? "", prompt: "R1(config)#" }],
      };
    }
    const distractor = variant.distractors.find((candidate) => candidate.trim().toLowerCase().replace(/\s+/g, " ") === command);
    return {
      ...state,
      attempts: state.attempts + 1,
      clean: false,
      cliHistory: [...state.cliHistory, { input: rawCommand, output: distractor ? `${distractor} — ${step.wrongHint}` : step.wrongHint, prompt: "R1(config)#" }],
      eventLog: [...state.eventLog, event(distractor ? `${distractor} — ${step.wrongHint}` : step.wrongHint, "error")],
    };
  }

  return state;
}

/** Answer a diagnose (checkpoint) step; wrong answers log the misconception. */
export function answerLabDiagnose(state: LabState, template: LabTemplate, value: string): LabState {
  if (state.status === "complete") return state;
  const step = template.steps[state.stepIndex];
  if (!step || step.kind !== "diagnose") return state;
  if (value === step.correct) {
    return advance(state, template, `Correct diagnosis — ${step.explain}`, "success");
  }
  return {
    ...state,
    attempts: state.attempts + 1,
    clean: false,
    checkpointAnswer: value,
    lastAnswerCorrect: false,
    eventLog: [...state.eventLog, event(step.wrongHint, "error")],
  };
}

/** Reveal the current step's answer after a failed attempt (mercy). */
export function revealLabAnswer(state: LabState, template: LabTemplate): LabState {
  if (state.status === "complete" || state.attempts < 1) return state;
  const step = template.steps[state.stepIndex];
  if (!step) return state;
  if (step.kind === "diagnose" && step.correct) {
    return {
      ...state,
      clean: false,
      checkpointAnswer: step.correct,
      lastAnswerCorrect: true,
      eventLog: [...state.eventLog, event(`Answer revealed: ${step.explain}`, "info")],
    };
  }
  if (step.kind === "configure") {
    const accepted = typeof step.acceptedCommands === "function" ? step.acceptedCommands(getLabVariant(template, state.variantId)) : (step.acceptedCommands ?? []);
    if (accepted.length) {
      return {
        ...state,
        clean: false,
        eventLog: [...state.eventLog, event(`Try typing: ${accepted[0]}`, "info")],
      };
    }
  }
  if ((step.kind === "inspect" || step.kind === "verify")) {
    const commands = typeof step.commands === "function" ? step.commands(getLabVariant(template, state.variantId)) : (step.commands ?? []);
    if (commands.length) {
      return {
        ...state,
        clean: false,
        eventLog: [...state.eventLog, event(`Try typing: ${commands[0]}`, "info")],
      };
    }
  }
  return state;
}

/**
 * Continue past a diagnose step whose answer was revealed (mirrors the rescue
 * engine: a correct answer or a reveal sets lastAnswerCorrect, then the player
 * advances explicitly). A revealed step is never counted as a clean run.
 */
export function advanceLab(state: LabState, template: LabTemplate): LabState {
  if (state.status === "complete") return state;
  const step = template.steps[state.stepIndex];
  if (!step || step.kind !== "diagnose" || state.lastAnswerCorrect !== true) return state;
  return advance(state, template, "Diagnosis confirmed — moving on.", "info");
}
