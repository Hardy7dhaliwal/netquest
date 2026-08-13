import { MASTERY_BANDS, bandForAttempts, quizContribution } from "./mastery";
import type { EncorObjective } from "./encor-catalog";

/**
 * Accurate mastery model (PRD "learn and pass" — mastery per assessment type).
 *
 * The legacy headline `MasteryMap` gives one number per objective. This engine
 * tracks mastery *by assessment type* — recall, output interpretation,
 * configuration, troubleshooting, and timed performance — plus the evidence a
 * band should be built on:
 *
 *   - cleanRuns: successful completions with zero wrong attempts (no hints)
 *   - variants:  the distinct lab/question variants the learner practiced
 *
 * Band gates (the "learning correctness" rules):
 *   - "Independent" is only earned after ≥2 clean runs across ≥2 distinct
 *     variants of the objective's primary skill (repeated no-hint success).
 *   - "Under Pressure" is only earned by passing a timed, mixed-variant
 *     assessment at a minimum accuracy threshold — never by a mission.
 */

export type SkillKind = "recall" | "interpret" | "configure" | "troubleshoot" | "timed";

export type SkillScores = Record<SkillKind, number>;

export type ObjectiveSkillState = {
  /** Score (0-100 band value) per assessment type. */
  scores: SkillScores;
  /** Successful completions with zero wrong attempts across all variants. */
  cleanRuns: number;
  /** Distinct variant ids the learner has practiced. */
  variants: string[];
  /** Best timed-assessment percentage achieved. */
  bestTimedPct: number;
  /** Epoch ms of the last passed timed assessment. */
  lastTimedAt: number | null;
};

export type SkillMap = Record<string, ObjectiveSkillState>;

export const SKILL_KINDS: SkillKind[] = ["recall", "interpret", "configure", "troubleshoot", "timed"];

export const INDEPENDENT_CLEAN_RUNS = 2;
export const INDEPENDENT_MIN_VARIANTS = 2;
/** A timed assessment must hit this accuracy to award Under Pressure (95). */
export const UNDER_PRESSURE_ACCURACY = 0.8;
/** A timed result is "recent" for readiness purposes within this window. */
export const TIMED_RECENCY_MS = 30 * 24 * 60 * 60 * 1000;

export function blankSkills(): SkillScores {
  return { recall: 0, interpret: 0, configure: 0, troubleshoot: 0, timed: 0 };
}

export function blankObjectiveState(): ObjectiveSkillState {
  return { scores: blankSkills(), cleanRuns: 0, variants: [], bestTimedPct: 0, lastTimedAt: null };
}

export function objectiveState(skills: SkillMap, objectiveId: string): ObjectiveSkillState {
  return skills[objectiveId] ?? blankObjectiveState();
}

/** The assessment type a blueprint objective's interaction maps to. */
export function primarySkill(interaction: EncorObjective["interaction"]): SkillKind {
  switch (interaction) {
    case "configure":
    case "code":
      return "configure";
    case "troubleshoot":
      return "troubleshoot";
    case "inspect":
    case "predict":
    case "interpret":
      return "interpret";
  }
}

/** The skill a quiz tests: recall for fact questions, interpret otherwise. */
export function quizSkill(questionKind: "recall" | "interpret"): SkillKind {
  return questionKind === "recall" ? "recall" : "interpret";
}

function withVariant(state: ObjectiveSkillState, variantId: string | null): ObjectiveSkillState {
  if (!variantId) return state;
  return state.variants.includes(variantId) ? state : { ...state, variants: [...state.variants, variantId] };
}

function raise(state: ObjectiveSkillState, kind: SkillKind, score: number, variantId: string | null): ObjectiveSkillState {
  const next = withVariant(state, variantId);
  return { ...next, scores: { ...next.scores, [kind]: Math.max(next.scores[kind], score) } };
}

/**
 * Record a mission-style completion of an objective's primary skill.
 * A clean run (≤1 attempt) counts toward the Independent gate.
 */
export function recordMissionSkill(
  skills: SkillMap,
  objectives: EncorObjective[],
  attempts: number,
  variantId: string | null = null,
): SkillMap {
  const next: SkillMap = { ...skills };
  for (const objective of objectives) {
    const state = objectiveState(next, objective.id);
    const clean = attempts <= 1;
    const scored = raise(state, primarySkill(objective.interaction), bandForAttempts(attempts), variantId);
    next[objective.id] = clean
      ? { ...scored, cleanRuns: scored.cleanRuns + 1 }
      : scored;
  }
  return next;
}

/** Record a quiz performance against recall or interpretation. */
export function recordQuizSkill(
  skills: SkillMap,
  objectives: EncorObjective[],
  questionKind: "recall" | "interpret",
  correct: number,
  total: number,
): SkillMap {
  const next: SkillMap = { ...skills };
  const score = quizContribution(correct, total);
  for (const objective of objectives) {
    const state = objectiveState(next, objective.id);
    next[objective.id] = raise(state, quizSkill(questionKind), score, null);
  }
  return next;
}

/**
 * Record a hands-on lab completion (configuration or troubleshooting).
 * Lab runs carry a variant id, so repeated no-hint practice across variants
 * is what unlocks Independent.
 */
export function recordLabSkill(
  skills: SkillMap,
  objectives: EncorObjective[],
  kind: "configure" | "troubleshoot",
  clean: boolean,
  variantId: string,
): SkillMap {
  const next: SkillMap = { ...skills };
  for (const objective of objectives) {
    const state = objectiveState(next, objective.id);
    const score = clean ? MASTERY_BANDS.independent : MASTERY_BANDS.guided;
    const scored = raise(state, kind, score, variantId);
    next[objective.id] = clean
      ? { ...scored, cleanRuns: scored.cleanRuns + 1 }
      : scored;
  }
  return next;
}

/**
 * Record a timed, mixed-variant assessment (boss battle or mock exam).
 * Only a pass at the accuracy threshold earns the Under Pressure band (95).
 */
export function recordTimedSkill(
  skills: SkillMap,
  objectives: EncorObjective[],
  accuracy: number,
  passed: boolean,
  now: number = Date.now(),
): SkillMap {
  const next: SkillMap = { ...skills };
  for (const objective of objectives) {
    const state = objectiveState(next, objective.id);
    const timed = passed && accuracy >= UNDER_PRESSURE_ACCURACY ? MASTERY_BANDS.underPressure : state.scores.timed;
    next[objective.id] = {
      ...state,
      scores: { ...state.scores, timed },
      bestTimedPct: Math.max(state.bestTimedPct, Math.round(accuracy * 100)),
      lastTimedAt: passed ? Math.max(state.lastTimedAt ?? 0, now) : state.lastTimedAt,
    };
  }
  return next;
}

/** Whether an objective's primary skill has reached Independent with the required evidence. */
export function isIndependent(skills: SkillMap, objective: EncorObjective): boolean {
  const state = objectiveState(skills, objective.id);
  const primary = primarySkill(objective.interaction);
  return (
    state.scores[primary] >= MASTERY_BANDS.independent &&
    state.cleanRuns >= INDEPENDENT_CLEAN_RUNS &&
    state.variants.length >= INDEPENDENT_MIN_VARIANTS
  );
}

/** Whether an objective has earned the Under Pressure band via a timed pass. */
export function isUnderPressure(skills: SkillMap, objectiveId: string): boolean {
  return objectiveState(skills, objectiveId).scores.timed >= MASTERY_BANDS.underPressure;
}

/** Whether a timed success is recent enough to count toward exam readiness. */
export function hasRecentTimedSuccess(skills: SkillMap, objectiveId: string, now: number = Date.now()): boolean {
  const at = objectiveState(skills, objectiveId).lastTimedAt;
  return at !== null && now - at <= TIMED_RECENCY_MS;
}

/** Mean of a skill kind across every objective (0-100). */
export function skillAverage(skills: SkillMap, kind: SkillKind): number {
  const scores = Object.values(skills)
    .map((state) => state.scores[kind])
    .filter((score) => score > 0);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

/** Every objective below a given band on its primary skill, weakest first. */
export function weakObjectives(skills: SkillMap, objectives: EncorObjective[], threshold: number): EncorObjective[] {
  return objectives
    .filter((objective) => objectiveState(skills, objective.id).scores[primarySkill(objective.interaction)] < threshold)
    .sort(
      (a, b) =>
        objectiveState(skills, a.id).scores[primarySkill(a.interaction)] -
        objectiveState(skills, b.id).scores[primarySkill(b.interaction)],
    );
}
