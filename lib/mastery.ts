import {
  ENCOR_DOMAINS,
  ENCOR_MISSION_ARCS,
  getPlayableObjectiveIds,
  type EncorObjective,
} from "./encor-catalog";

/**
 * Mastery engine (PRD §11 + encor-curriculum "Mastery and Exam Coverage Rules").
 * Mastery is tracked per objective, not per mission: completing a mission raises
 * every objective it teaches to a band derived from wrong attempts — best result
 * wins, so a clean rerun can improve a score but a rough one never lowers it.
 */
export type MasteryMap = Record<string, number>;

export const MASTERY_BANDS = {
  introduced: 25,
  recognized: 50,
  guided: 70,
  independent: 85,
  underPressure: 95,
} as const;

/** A mission run's wrong-attempt count maps to a mastery band (0 = clean run). */
export function bandForAttempts(attempts: number): number {
  if (attempts <= 1) return MASTERY_BANDS.independent;
  if (attempts <= 3) return MASTERY_BANDS.guided;
  if (attempts <= 6) return MASTERY_BANDS.recognized;
  return MASTERY_BANDS.introduced;
}

export function bandLabel(score: number): string {
  if (score >= MASTERY_BANDS.independent) return "Independent";
  if (score >= MASTERY_BANDS.guided) return "Guided";
  if (score >= MASTERY_BANDS.recognized) return "Recognized";
  if (score > 0) return "Introduced";
  return "Unseen";
}

export function objectiveScore(mastery: MasteryMap, objectiveId: string): number {
  return mastery[objectiveId] ?? 0;
}

/** Raise every taught objective to the attempts band; keep the best result. */
export function recordMissionResult(mastery: MasteryMap, objectiveIds: string[], attempts: number): MasteryMap {
  const band = bandForAttempts(attempts);
  const next = { ...mastery };
  for (const id of objectiveIds) {
    next[id] = Math.max(next[id] ?? 0, band);
  }
  return next;
}

/** A quiz performance maps to a mild mastery contribution (below mission bands). */
export function quizContribution(correct: number, total: number): number {
  if (total <= 0) return 0;
  const fraction = correct / total;
  if (fraction >= 1) return MASTERY_BANDS.guided;
  if (fraction >= 0.5) return MASTERY_BANDS.recognized;
  return MASTERY_BANDS.introduced;
}

/** Raise every quizzed objective to the quiz contribution; keep the best result. */
export function recordQuizResult(mastery: MasteryMap, objectiveIds: string[], correct: number, total: number): MasteryMap {
  const band = quizContribution(correct, total);
  const next = { ...mastery };
  for (const id of objectiveIds) {
    next[id] = Math.max(next[id] ?? 0, band);
  }
  return next;
}

/** Playable objectives the player has not yet reached Guided (70). */
export function getWeakObjectives(mastery: MasteryMap): EncorObjective[] {
  const playable = getPlayableObjectiveIds();
  return ENCOR_DOMAINS.flatMap((domain) => domain.objectives).filter(
    (objective) => playable.has(objective.id) && objectiveScore(mastery, objective.id) < MASTERY_BANDS.guided,
  );
}

export type Recommendation =
  | { kind: "unseen"; arcId: string; arcTitle: string; objective: EncorObjective }
  | { kind: "review"; arcId: string; arcTitle: string; weakObjectives: EncorObjective[] }
  | { kind: "ready"; message: string };

/** Next best activity: an unplayed arc first, then the arc holding the weakest objective. */
export function recommendNext(mastery: MasteryMap): Recommendation {
  const playableArcs = ENCOR_MISSION_ARCS.filter((arc) => arc.status === "available" || arc.status === "complete");
  const allObjectives = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);

  for (const arc of playableArcs) {
    const unseenId = arc.objectiveIds.find((id) => !(id in mastery));
    if (unseenId) {
      const objective = allObjectives.find((o) => o.id === unseenId)!;
      return { kind: "unseen", arcId: arc.id, arcTitle: arc.title, objective };
    }
  }

  const weak = getWeakObjectives(mastery).sort(
    (a, b) => objectiveScore(mastery, a.id) - objectiveScore(mastery, b.id),
  );
  if (weak.length > 0) {
    const arc = playableArcs.find((candidate) => candidate.objectiveIds.includes(weak[0].id))!;
    const weakObjectives = weak.filter((objective) => arc.objectiveIds.includes(objective.id));
    return { kind: "review", arcId: arc.id, arcTitle: arc.title, weakObjectives };
  }

  return {
    kind: "ready",
    message:
      "Every playable objective is at Guided or better. Replay a mission with zero wrong attempts to reach Independent — new modes like the daily challenge are on the way.",
  };
}

/** Per-domain average mastery for exam-readiness reporting. */
export function getMasterySummary(mastery: MasteryMap) {
  return ENCOR_DOMAINS.map((domain) => {
    const scores = domain.objectives.map((objective) => objectiveScore(mastery, objective.id));
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1));
    return { domain, average };
  });
}
