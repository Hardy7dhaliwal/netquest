import { ENCOR_DOMAINS, ENCOR_MISSION_ARCS, type EncorObjective } from "./encor-catalog";
import { DAY_MS, nextCardState } from "./flashcards";
import { seededRng } from "./boss";
import { LAB_TEMPLATES } from "./lab-templates";
import type { LabVariant } from "./labs";
import { getArcQuiz } from "./quiz";
import { MASTERY_BANDS } from "./mastery";
import { objectiveState, primarySkill, type SkillMap } from "./skills";

/**
 * Adaptive review (PRD §4 — spaced repetition that targets weak subskills).
 *
 * Every review session is rebuilt from the player's WEAKEST objectives: an
 * objective is in scope when its primary-skill score is below Guided AND it is
 * due (never scheduled, or its SM-2-lite interval has elapsed). Each in-scope
 * objective contributes:
 *
 *   - a fresh recall/interpret question from its arc's quiz bank (never re-serving
 *     ids recorded in `reviewSeen`), and
 *   - a hands-on lab with a specific variant when a lab covers the objective
 *     (preferring variants the player has not completed).
 *
 * The queue is deterministic per (state, seed). Results are recorded through
 * {@link applyReviewResult}, which runs the same SM-2-lite scheduler as the
 * flashcards: correct answers stretch the interval, misses reset to due-now.
 */

export type ReviewSchedule = {
  ease: number;
  /** Review interval in days; 0 means due again now. */
  interval: number;
  /** Epoch ms when the objective is next due. */
  due: number;
};

export type ReviewQuestionItem = {
  id: string;
  kind: "question";
  objectiveId: string;
  objectiveLabel: string;
  domain: string;
  arcId: string;
  /** The assessment type the question trains (drives skill recording). */
  questionKind: "recall" | "interpret";
  questionId: string;
  prompt: string;
  options: { value: string; title: string; note?: string }[];
  correct: string;
  explain: string;
  wrongGuidance: string;
};

export type ReviewLabItem = {
  id: string;
  kind: "lab";
  objectiveId: string;
  objectiveLabel: string;
  domain: string;
  labId: string;
  labTitle: string;
  variantId: string;
  variantLabel: string;
  symptom: string;
  simulatorNote: string;
};

export type ReviewItem = ReviewQuestionItem | ReviewLabItem;

export type ReviewQueue = {
  items: ReviewItem[];
  /** Objectives the queue targets (weakest first). */
  targetedObjectives: string[];
};

/** Objectives a single session may target (queue cap keeps a session focused). */
export const REVIEW_MAX_OBJECTIVES = 4;
export const REVIEW_MAX_ITEMS = 8;
/** A weak objective must be below this primary-skill band to enter the queue. */
export const REVIEW_WEAK_BELOW = MASTERY_BANDS.guided;

/** All playable objectives with a score below Guided, plus their score. */
function belowGuided(skills: SkillMap): { objective: EncorObjective; score: number }[] {
  const playable = new Set(ENCOR_MISSION_ARCS.flatMap((arc) => arc.objectiveIds));
  return ENCOR_DOMAINS.flatMap((domain) => domain.objectives)
    .filter((objective) => playable.has(objective.id))
    .map((objective) => ({ objective, score: objectiveState(skills, objective.id).scores[primarySkill(objective.interaction)] }))
    .filter((entry) => entry.score < REVIEW_WEAK_BELOW)
    .sort((a, b) => a.score - b.score || a.objective.id.localeCompare(b.objective.id));
}

/** Objectives in scope for this session: weak AND due (or never scheduled). */
export function dueReviewObjectives(
  skills: SkillMap,
  schedules: Record<string, ReviewSchedule>,
  now: number = Date.now(),
): EncorObjective[] {
  return belowGuided(skills)
    .filter(({ objective }) => {
      const schedule = schedules[objective.id];
      return !schedule || schedule.due <= now;
    })
    .slice(0, REVIEW_MAX_OBJECTIVES)
    .map((entry) => entry.objective);
}

/** The first playable arc teaching an objective (deterministic catalog order). */
export function arcForObjective(objectiveId: string): string | null {
  return ENCOR_MISSION_ARCS.find((arc) => arc.objectiveIds.includes(objectiveId))?.id ?? null;
}

function domainTitle(objectiveId: string): string {
  return ENCOR_DOMAINS.find((domain) => domain.objectives.some((objective) => objective.id === objectiveId))?.title ?? "";
}

/** The assessment type the objective's interaction trains (recall vs interpret questions). */
export function questionKindFor(objective: EncorObjective): "recall" | "interpret" {
  return objective.interaction === "inspect" || objective.interaction === "predict" || objective.interaction === "interpret"
    ? "interpret"
    : "recall";
}

/** Whether a lab template covers the objective. */
export function labsForObjective(objectiveId: string) {
  return LAB_TEMPLATES.filter((template) => template.objectiveIds.includes(objectiveId));
}

/** A variant for a lab, preferring ones the player has not completed (seeded). */
export function pickReviewVariant(
  labId: string,
  variants: LabVariant[],
  labResults: Record<string, { variantIds: string[] }>,
  rng: () => number,
): LabVariant {
  const completed = new Set(labResults[labId]?.variantIds ?? []);
  const fresh = variants.filter((variant) => !completed.has(variant.id));
  const pool = fresh.length > 0 ? fresh : variants;
  return pool[Math.floor(rng() * pool.length)];
}

/** A fresh question from an objective's arc bank (falling back when exhausted). */
export function pickReviewQuestion(
  arcId: string,
  objectiveId: string,
  reviewSeen: Record<string, string[]>,
  alreadyQueued: Set<string>,
  rng: () => number,
) {
  const pool = getArcQuiz(arcId);
  const seen = new Set(reviewSeen[objectiveId] ?? []);
  const fresh = pool.filter((question) => !seen.has(question.id) && !alreadyQueued.has(question.id));
  const source = fresh.length > 0 ? fresh : pool.filter((question) => !alreadyQueued.has(question.id));
  return source.length > 0 ? source[Math.floor(rng() * source.length)] : null;
}

/**
 * Build the review queue for a session. Deterministic for the same inputs:
 * the same skills/schedules/reviewSeen/labResults and seed always yield the
 * same items. Weakest objective first; each contributes a question and, when a
 * lab covers it, a lab item — until the item cap is reached.
 */
export function buildReviewQueue(input: {
  skills: SkillMap;
  schedules: Record<string, ReviewSchedule>;
  reviewSeen: Record<string, string[]>;
  labResults: Record<string, { variantIds: string[] }>;
  seed: string;
  now?: number;
  maxItems?: number;
}): ReviewQueue {
  const rng = seededRng(input.seed);
  const maxItems = input.maxItems ?? REVIEW_MAX_ITEMS;
  const items: ReviewItem[] = [];
  const alreadyQueued = new Set<string>();
  const targetedObjectives: string[] = [];

  for (const objective of dueReviewObjectives(input.skills, input.schedules, input.now)) {
    if (items.length >= maxItems) break;
    targetedObjectives.push(objective.id);
    const domain = domainTitle(objective.id);
    const objectiveLabel = objective.label;

    // Hands-on lab variant (when the objective has a lab).
    if (items.length < maxItems) {
      const lab = labsForObjective(objective.id)[0];
      if (lab) {
        const variant = pickReviewVariant(lab.id, lab.variants, input.labResults, rng);
        items.push({
          id: `r-lab-${objective.id}-${variant.id}`,
          kind: "lab",
          objectiveId: objective.id,
          objectiveLabel,
          domain,
          labId: lab.id,
          labTitle: lab.title,
          variantId: variant.id,
          variantLabel: variant.label,
          symptom: variant.symptom,
          simulatorNote: lab.simulatorNote,
        });
        alreadyQueued.add(`lab:${lab.id}:${variant.id}`);
      }
    }

    // Fresh question from the objective's arc bank.
    if (items.length < maxItems) {
      const arcId = arcForObjective(objective.id);
      if (arcId) {
        const question = pickReviewQuestion(arcId, objective.id, input.reviewSeen, alreadyQueued, rng);
        if (question) {
          items.push({
            id: `r-q-${objective.id}-${question.id}`,
            kind: "question",
            objectiveId: objective.id,
            objectiveLabel,
            domain,
            arcId,
            questionKind: questionKindFor(objective),
            questionId: question.id,
            prompt: question.prompt,
            options: question.options,
            correct: question.correct,
            explain: question.explain,
            wrongGuidance: question.wrongGuidance,
          });
          alreadyQueued.add(question.id);
        }
      }
    }
  }

  return { items, targetedObjectives };
}

/** SM-2-lite for objectives — same scheduler as the flashcards. */
export function nextReviewSchedule(prev: ReviewSchedule | undefined, correct: boolean, now: number): ReviewSchedule {
  return nextCardState(prev, correct, now);
}

/**
 * Record one question result: stretch the objective's interval on a correct
 * answer, reset to due-now on a miss, and remember the question id so the next
 * session draws fresh material. Pure — returns the updated maps.
 */
export function applyReviewResult(
  schedules: Record<string, ReviewSchedule>,
  reviewSeen: Record<string, string[]>,
  objectiveId: string,
  questionId: string,
  correct: boolean,
  now: number = Date.now(),
): { schedules: Record<string, ReviewSchedule>; reviewSeen: Record<string, string[]> } {
  const schedule = nextReviewSchedule(schedules[objectiveId], correct, now);
  const seen = new Set(reviewSeen[objectiveId] ?? []);
  seen.add(questionId);
  return {
    schedules: { ...schedules, [objectiveId]: schedule },
    reviewSeen: { ...reviewSeen, [objectiveId]: [...seen].slice(0, 400) },
  };
}

/** Number of objectives currently in scope for the dashboard (due + weak). */
export function dueReviewCount(skills: SkillMap, schedules: Record<string, ReviewSchedule>, now: number = Date.now()): number {
  return dueReviewObjectives(skills, schedules, now).length;
}
