import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS } from "./encor-catalog";
import { getExamReadiness } from "./readiness";

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
