import { describe, expect, it } from "vitest";
import { DAY_MS } from "./flashcards";
import { ENCOR_DOMAINS } from "./encor-catalog";
import { getArcQuiz } from "./quiz";
import {
  applyReviewResult,
  buildReviewQueue,
  dueReviewCount,
  dueReviewObjectives,
  nextReviewSchedule,
  questionKindFor,
  REVIEW_MAX_ITEMS,
  type ReviewSchedule,
} from "./review";
import { blankObjectiveState, type SkillMap } from "./skills";
import { MASTERY_BANDS } from "./mastery";

/** Skills with EVERY blueprint objective at the given score (or a custom override). */
function skillsAt(score: number, overrides: Record<string, number> = {}): SkillMap {
  const skills: SkillMap = {};
  for (const domain of ENCOR_DOMAINS) {
    for (const objective of domain.objectives) {
      const value = overrides[objective.id] ?? score;
      const state = blankObjectiveState();
      state.scores = { recall: value, interpret: value, configure: value, troubleshoot: value, timed: 0 };
      skills[objective.id] = state;
    }
  }
  return skills;
}

function schedule(due: number, interval = 1, ease = 2): ReviewSchedule {
  return { ease, interval, due };
}

describe("due objective selection", () => {
  it("returns nothing when every objective is at or above Guided", () => {
    expect(dueReviewObjectives(skillsAt(MASTERY_BANDS.guided), {}, 0)).toEqual([]);
  });

  it("targets weak objectives that are unseen or due, weakest first", () => {
    const now = 1_000_000;
    const skills = skillsAt(MASTERY_BANDS.guided, { "3.2.b": 25, "3.1.a": 0 });
    const schedules = {
      "3.2.b": schedule(now - 1), // weak and due
      "3.1.a": schedule(now + 10_000), // weaker but NOT due yet (spaced out)
    };
    const due = dueReviewObjectives(skills, schedules, now).map((objective) => objective.id);
    expect(due).toEqual(["3.2.b"]);
  });

  it("caps the session at a few objectives", () => {
    const skills = skillsAt(0); // everything weak
    const due = dueReviewObjectives(skills, {}, 0);
    expect(due.length).toBeLessThanOrEqual(4);
  });
});

describe("queue building", () => {
  it("builds nothing when nothing is weak", () => {
    const queue = buildReviewQueue({ skills: skillsAt(85), schedules: {}, reviewSeen: {}, labResults: {}, seed: "s" });
    expect(queue.items).toEqual([]);
  });

  it("mixes a lab variant and a fresh question for a lab-covered weak objective", () => {
    const skills = skillsAt(70, { "3.2.b": 0 });
    const queue = buildReviewQueue({ skills, schedules: {}, reviewSeen: {}, labResults: {}, seed: "lab-mix" });
    const kinds = queue.items.map((item) => item.kind);
    expect(kinds).toContain("lab");
    expect(kinds).toContain("question");
    const labItem = queue.items.find((item) => item.kind === "lab")!;
    expect(labItem.labId).toBe("lab-ospf-adjacency");
    expect(labItem.objectiveId).toBe("3.2.b");
  });

  it("prefers lab variants the player has not completed", () => {
    const skills = skillsAt(70, { "3.2.b": 0 });
    const completed = buildReviewQueue({ skills, schedules: {}, reviewSeen: {}, labResults: { "lab-ospf-adjacency": { variantIds: ["a"] } }, seed: "fresh-variant" });
    const labItem = completed.items.find((item) => item.kind === "lab")!;
    expect(labItem.variantId).not.toBe("a");
  });

  it("serves fresh questions, skipping ids already recorded in reviewSeen", () => {
    const skills = skillsAt(70, { "3.2.b": 0 });
    const first = buildReviewQueue({ skills, schedules: {}, reviewSeen: {}, labResults: {}, seed: "fresh-q" });
    const question = first.items.find((item) => item.kind === "question")!;
    expect(question.questionId.length).toBeGreaterThan(0);
    const again = buildReviewQueue({
      skills,
      schedules: {},
      reviewSeen: { "3.2.b": [question.questionId] },
      labResults: {},
      seed: "fresh-q",
    });
    const nextQuestion = again.items.find((item) => item.kind === "question")!;
    expect(nextQuestion.questionId).not.toBe(question.questionId);
  });

  it("is deterministic for the same inputs and seed", () => {
    const input = { skills: skillsAt(70, { "3.2.b": 0, "4.3": 25 }), schedules: {}, reviewSeen: {}, labResults: {}, seed: "fixed" };
    const a = buildReviewQueue(input);
    const b = buildReviewQueue(input);
    expect(a.items.map((item) => item.id)).toEqual(b.items.map((item) => item.id));
  });

  it("caps the queue at the session limit", () => {
    const queue = buildReviewQueue({ skills: skillsAt(0), schedules: {}, reviewSeen: {}, labResults: {}, seed: "cap" });
    expect(queue.items.length).toBeLessThanOrEqual(REVIEW_MAX_ITEMS);
    expect(queue.items.length).toBeGreaterThan(0);
  });
});

describe("SM-2-lite scheduling", () => {
  const now = 5_000_000;

  it("a correct first answer schedules the next review a day out", () => {
    const next = nextReviewSchedule(undefined, true, now);
    expect(next.interval).toBe(1);
    expect(next.due).toBe(now + DAY_MS);
  });

  it("a miss resets to due-now", () => {
    const prev = schedule(now + DAY_MS, 3, 2);
    const next = nextReviewSchedule(prev, false, now);
    expect(next.interval).toBe(0);
    expect(next.due).toBe(now);
  });

  it("correct answers stretch the interval by ease", () => {
    const prev = schedule(now + DAY_MS, 1, 2);
    const next = nextReviewSchedule(prev, true, now);
    expect(next.interval).toBe(2);
  });

  it("applyReviewResult updates the schedule and remembers the question", () => {
    const { schedules, reviewSeen } = applyReviewResult({}, {}, "3.2.b", "q-1", true, now);
    expect(schedules["3.2.b"].due).toBe(now + DAY_MS);
    expect(reviewSeen["3.2.b"]).toEqual(["q-1"]);
    const again = applyReviewResult(schedules, reviewSeen, "3.2.b", "q-2", false, now + 60_000);
    expect(again.schedules["3.2.b"].interval).toBe(0);
    expect(again.reviewSeen["3.2.b"]).toEqual(["q-1", "q-2"]);
  });

  it("dueReviewCount matches the number of in-scope objectives", () => {
    const skills = skillsAt(70, { "3.2.b": 0, "4.3": 25 });
    expect(dueReviewCount(skills, {}, 0)).toBe(dueReviewObjectives(skills, {}, 0).length);
  });
});

describe("question kinds", () => {
  it("maps interpret/predict/inspect objectives to interpret and the rest to recall", () => {
    expect(questionKindFor({ id: "1.1.a", label: "", interaction: "predict" })).toBe("interpret");
    expect(questionKindFor({ id: "3.2.b", label: "", interaction: "configure" })).toBe("recall");
    expect(questionKindFor({ id: "4.1", label: "", interaction: "troubleshoot" })).toBe("recall");
  });

  it("the queued question really exists in the arc bank", () => {
    const skills = skillsAt(70, { "3.2.b": 0 });
    const queue = buildReviewQueue({ skills, schedules: {}, reviewSeen: {}, labResults: {}, seed: "bank" });
    const question = queue.items.find((item) => item.kind === "question")!;
    const bank = getArcQuiz(question.arcId);
    expect(bank.some((entry) => entry.id === question.questionId)).toBe(true);
  });
});
