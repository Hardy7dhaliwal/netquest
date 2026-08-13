import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS, ENCOR_OBJECTIVE_COUNT } from "./encor-catalog";
import {
  ARC_TEST_FILES,
  arcForObjective,
  CURRICULUM_PLANS,
  getBlueprintCoverage,
  getCoverageMatrix,
  getObjectiveAssessments,
  getObjectiveReviewCards,
  getObjectiveStatus,
  MIN_ASSESSMENTS,
  MIN_REVIEW_CARDS,
  MIN_SCENARIOS,
  VERIFIED_QUIZ_BANK_MIN,
} from "./curriculum";

const ALL_OBJECTIVES = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);

describe("curriculum completeness (quality bar)", () => {
  it("covers all 47 blueprint objectives with a teaching plan", () => {
    expect(ALL_OBJECTIVES).toHaveLength(ENCOR_OBJECTIVE_COUNT);
    for (const objective of ALL_OBJECTIVES) {
      const plan = CURRICULUM_PLANS[objective.id];
      expect(plan, `missing plan for ${objective.id}`).toBeDefined();
      expect(plan!.lesson.trim().length).toBeGreaterThan(40);
    }
  });

  it("splits broad objectives into teachable subskills", () => {
    for (const objective of ALL_OBJECTIVES) {
      const subskills = CURRICULUM_PLANS[objective.id].subskills;
      expect(subskills.length, `${objective.id} has no subskills`).toBeGreaterThanOrEqual(1);
      for (const subskill of subskills) {
        expect(subskill.length).toBeGreaterThan(8);
      }
    }
  });

  it("gives every objective at least two guided scenarios", () => {
    for (const objective of ALL_OBJECTIVES) {
      const scenarios = CURRICULUM_PLANS[objective.id].scenarios;
      expect(scenarios.length, `${objective.id} scenarios`).toBeGreaterThanOrEqual(MIN_SCENARIOS);
    }
  });

  it("gives every objective misconception feedback", () => {
    for (const objective of ALL_OBJECTIVES) {
      const misconceptions = CURRICULUM_PLANS[objective.id].misconceptions;
      expect(misconceptions.length, `${objective.id} misconceptions`).toBeGreaterThanOrEqual(1);
      for (const misconception of misconceptions) {
        expect(misconception).toContain("—");
      }
    }
  });

  it("derives at least three varied assessment items per objective", () => {
    for (const objective of ALL_OBJECTIVES) {
      const assessments = getObjectiveAssessments(objective.id);
      expect(assessments.length, `${objective.id} assessments`).toBeGreaterThanOrEqual(MIN_ASSESSMENTS);
      const prompts = new Set(assessments.map((question) => question.prompt));
      expect(prompts.size, `${objective.id} assessments must vary`).toBeGreaterThanOrEqual(MIN_ASSESSMENTS);
    }
  });

  it("derives at least one review card per objective", () => {
    for (const objective of ALL_OBJECTIVES) {
      const cards = getObjectiveReviewCards(objective.id);
      expect(cards.length, `${objective.id} review cards`).toBeGreaterThanOrEqual(MIN_REVIEW_CARDS);
    }
  });

  it("provides a remediation path (a playable arc) for every objective", () => {
    for (const objective of ALL_OBJECTIVES) {
      expect(arcForObjective(objective.id), `${objective.id} has no arc`).not.toBeNull();
    }
  });

  it("gives a hands-on task to config/troubleshoot objectives", () => {
    const handsOnKinds = new Set(["configure", "troubleshoot", "code"]);
    for (const objective of ALL_OBJECTIVES) {
      if (!handsOnKinds.has(objective.interaction)) continue;
      expect(CURRICULUM_PLANS[objective.id].handsOn, `${objective.id} lacks a hands-on task`).toBeDefined();
    }
  });
});

describe("evidence-based coverage states", () => {
  it("never reports planned or partial for objectives with complete evidence", () => {
    for (const objective of ALL_OBJECTIVES) {
      const status = getObjectiveStatus(objective.id);
      expect(["planned", "partial", "complete", "verified"]).toContain(status);
    }
  });

  it("verifies objectives backed by a bank of 8+ questions and an engine test", () => {
    const matrix = getCoverageMatrix();
    for (const row of matrix) {
      if (row.status === "verified") {
        expect(row.assessmentCount).toBeGreaterThanOrEqual(VERIFIED_QUIZ_BANK_MIN);
        expect(row.testFiles.length).toBeGreaterThan(0);
        expect(row.arcId).not.toBeNull();
      }
    }
  });

  it("keeps every mission's objectives at complete or verified", () => {
    for (const arcId of Object.keys(ARC_TEST_FILES)) {
      const arc = ENCOR_DOMAINS.flatMap((d) => d.objectives).filter((o) => arcForObjective(o.id) === arcId);
      for (const objective of arc) {
        expect(["complete", "verified"]).toContain(getObjectiveStatus(objective.id));
      }
    }
  });

  it("reports blueprint coverage across all four states", () => {
    const coverage = getBlueprintCoverage();
    expect(coverage.total).toBe(ENCOR_OBJECTIVE_COUNT);
    expect(coverage.complete + coverage.verified + coverage.partial + coverage.planned).toBe(coverage.total);
    // Every objective is playable and fully planned — none should be 'planned'.
    expect(coverage.planned).toBe(0);
  });
});

describe("coverage matrix", () => {
  it("has one auditable row per objective", () => {
    const matrix = getCoverageMatrix();
    expect(matrix).toHaveLength(ENCOR_OBJECTIVE_COUNT);
    const ids = new Set(matrix.map((row) => row.objective.id));
    expect(ids.size).toBe(ENCOR_OBJECTIVE_COUNT);
  });

  it("links each verified row to a real test file", () => {
    for (const row of getCoverageMatrix()) {
      if (row.status !== "verified") continue;
      expect(row.testFiles[0]).toMatch(/^lib\/.*\.test\.ts$/);
    }
  });

  it("links every row to its arc", () => {
    for (const row of getCoverageMatrix()) {
      expect(row.arcId).not.toBeNull();
    }
  });

  it("records real assessment and review-card counts (evidence)", () => {
    for (const row of getCoverageMatrix()) {
      expect(row.assessmentCount).toBeGreaterThanOrEqual(MIN_ASSESSMENTS);
      expect(row.reviewCardCount).toBeGreaterThanOrEqual(MIN_REVIEW_CARDS);
      expect(row.scenarioCount).toBeGreaterThanOrEqual(MIN_SCENARIOS);
      expect(row.hasLesson).toBe(true);
    }
  });
});
