import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS } from "./encor-catalog";
import { getExamReadiness, getReadinessReportV2, getReadinessV2Percent, type ExamScoreHistory } from "./readiness";
import type { SkillMap } from "./skills";

function allObjectivesAt(score: number): Record<string, number> {
  const mastery: Record<string, number> = {};
  for (const domain of ENCOR_DOMAINS) {
    for (const objective of domain.objectives) {
      mastery[objective.id] = score;
    }
  }
  return mastery;
}

describe("exam readiness", () => {
  it("starts at 0% with every objective unseen", () => {
    const report = getExamReadiness({});
    expect(report.readiness).toBe(0);
    expect(report.verdict).toBe("starting");
    expect(report.verdictLabel).toBe("Getting started");
    expect(report.bands.unseen).toBe(47);
  });

  it("reports 85% ready when every objective is Independent", () => {
    const report = getExamReadiness(allObjectivesAt(85));
    expect(report.readiness).toBe(85);
    expect(report.verdict).toBe("ready");
    expect(report.verdictLabel).toBe("Exam-ready");
    expect(report.bands.independent).toBe(47);
  });

  it("weights domains by their share of the exam", () => {
    // Infrastructure (30%) fully at Guided, everything else unseen → 70 × 0.30.
    const mastery: Record<string, number> = {};
    const infrastructure = ENCOR_DOMAINS.find((domain) => domain.id === "infrastructure")!;
    for (const objective of infrastructure.objectives) mastery[objective.id] = 70;
    const report = getExamReadiness(mastery);
    expect(report.readiness).toBe(21);
    expect(report.bands.guided).toBe(11);
    expect(report.bands.unseen).toBe(36);
  });

  it("classifies the verdict bands", () => {
    expect(getExamReadiness(allObjectivesAt(50)).verdict).toBe("developing");
    expect(getExamReadiness(allObjectivesAt(70)).verdict).toBe("approaching");
    expect(getExamReadiness(allObjectivesAt(85)).verdict).toBe("ready");
    expect(getExamReadiness({}).verdict).toBe("starting");
  });

  it("counts the per-band breakdown", () => {
    const report = getExamReadiness({ "3.1.a": 85, "3.1.b": 70, "3.1.c": 50, "3.2.a": 25 });
    expect(report.bands).toEqual({ unseen: 43, introduced: 1, recognized: 1, guided: 1, independent: 1 });
  });

  it("reports per-domain averages", () => {
    const mastery: Record<string, number> = {};
    const architecture = ENCOR_DOMAINS.find((domain) => domain.id === "architecture")!;
    for (const objective of architecture.objectives) mastery[objective.id] = 85;
    const report = getExamReadiness(mastery);
    const architectureRow = report.domains.find((entry) => entry.domainId === "architecture")!;
    expect(architectureRow.average).toBe(85);
    expect(architectureRow.weight).toBe(15);
  });

  it("keeps readiness within 0-100 for any mastery map", () => {
    const report = getExamReadiness(allObjectivesAt(95));
    expect(report.readiness).toBeLessThanOrEqual(100);
    expect(report.readiness).toBe(95);
    expect(report.bands.independent).toBe(47);
  });
});

describe("multi-dimensional readiness report", () => {
  const allObjectives = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);

  function skillsForAll(cleanRuns: number, variantCount: number, primaryScore: number, timed = 0, timedAt: number | null = null): SkillMap {
    const skills: SkillMap = {};
    for (const objective of allObjectives) {
      const kind = objective.interaction === "configure" || objective.interaction === "code" ? "configure" : objective.interaction === "troubleshoot" ? "troubleshoot" : "interpret";
      const variants = Array.from({ length: variantCount }, (_, index) => `v${index}`);
      skills[objective.id] = {
        scores: { recall: 0, interpret: 0, configure: 0, troubleshoot: 0, timed },
        cleanRuns,
        variants,
        bestTimedPct: timed,
        lastTimedAt: timedAt,
      };
      skills[objective.id].scores[kind] = primaryScore;
    }
    return skills;
  }

  it("starts with every dimension at zero and no remaining requirements met", () => {
    const report = getReadinessReportV2({}, {}, {}, 1000);
    expect(report.blueprintCoverage).toBe(100); // plans are complete
    expect(report.knowledgeScore).toBe(0);
    expect(report.configurationScore).toBe(0);
    expect(report.troubleshootingScore).toBe(0);
    expect(report.timedExamScore).toBe(0);
    expect(report.confidence).toBe("low");
    expect(report.examReady).toBe(false);
    expect(report.remaining.length).toBe(5);
  });

  it("reports dimension scores from practiced skills", () => {
    const skills = skillsForAll(0, 1, 85);
    const report = getReadinessReportV2({}, skills, {}, 1000);
    expect(report.knowledgeScore).toBe(85);
    expect(report.configurationScore).toBe(85);
    expect(report.troubleshootingScore).toBe(85);
    expect(report.blueprintCoverage).toBe(100);
  });

  it("takes the best mock exam score into the timed dimension", () => {
    const history: ExamScoreHistory = {
      "mock-a": { pct: 65, passed: false, at: 100 },
      "mock-b": { pct: 82, passed: true, at: 200 },
    };
    const report = getReadinessReportV2({}, {}, history, 1000);
    expect(report.timedExamScore).toBe(82);
    expect(report.bestExamKind).toBe("mock-b");
  });

  it("flags the weakest objectives by primary skill", () => {
    const skills = skillsForAll(0, 1, 85);
    skills["3.1.a"].scores.troubleshoot = 25;
    const report = getReadinessReportV2({}, skills, {}, 1000);
    expect(report.weakest[0].objectiveId).toBe("3.1.a");
    expect(report.weakest[0].score).toBe(25);
  });

  it("never calls a learner exam-ready from missions alone", () => {
    // Every objective practiced with strong scores but no variants, no mocks.
    const skills = skillsForAll(1, 1, 85);
    const report = getReadinessReportV2({}, skills, {}, 1000);
    expect(report.examReady).toBe(false);
    expect(report.remaining.find((r) => r.id === "independent")!.met).toBe(false);
    expect(report.remaining.find((r) => r.id === "mock")!.met).toBe(false);
  });

  it("awards exam-ready only when every requirement is genuinely met", () => {
    // Independent on every objective (2 clean runs, 2+ variants).
    const skills = skillsForAll(2, 2, 85, 95, 1000);
    const history: ExamScoreHistory = { "mock-a": { pct: 75, passed: true, at: 100 } };
    const report = getReadinessReportV2({}, skills, history, 1000 + 24 * 60 * 60 * 1000);
    expect(report.examReady).toBe(true);
    expect(report.confidence).toBe("high");
    expect(report.remaining.every((requirement) => requirement.met)).toBe(true);
  });

  it("blocks exam-ready when Infrastructure or Security has a high-risk weak area", () => {
    const skills = skillsForAll(2, 2, 85, 95, 1000);
    skills["3.3.b"].scores.configure = 50; // Infrastructure, below the safe threshold
    const history: ExamScoreHistory = { "mock-a": { pct: 75, passed: true, at: 100 } };
    const report = getReadinessReportV2({}, skills, history, 1000 + 24 * 60 * 60 * 1000);
    expect(report.examReady).toBe(false);
    expect(report.remaining.find((r) => r.id === "highrisk")!.met).toBe(false);
  });

  it("blocks exam-ready when the timed success is stale", () => {
    const skills = skillsForAll(2, 2, 85, 95, 1000);
    const history: ExamScoreHistory = { "mock-a": { pct: 75, passed: true, at: 100 } };
    const report = getReadinessReportV2({}, skills, history, 1000 + 45 * 24 * 60 * 60 * 1000);
    expect(report.examReady).toBe(false);
    expect(report.remaining.find((r) => r.id === "timed")!.met).toBe(false);
  });

  it("derives a weighted percentage from the report", () => {
    const skills = skillsForAll(0, 1, 85);
    const report = getReadinessReportV2({}, skills, {}, 1000);
    expect(getReadinessV2Percent(report)).toBeGreaterThan(0);
    expect(getReadinessV2Percent(report)).toBeLessThanOrEqual(100);
  });
});
