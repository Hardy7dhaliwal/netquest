import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS, ENCOR_MISSION_ARCS } from "./encor-catalog";
import { EXAM_BANK_QUESTIONS } from "./exam-bank";

describe("multi-domain exam bank", () => {
  it("uses unique question ids", () => {
    const ids = EXAM_BANK_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item spans two or more domains with a valid primary", () => {
    const domainIds = ENCOR_DOMAINS.map((domain) => domain.id);
    for (const question of EXAM_BANK_QUESTIONS) {
      expect(question.domainIds.length).toBeGreaterThanOrEqual(2);
      for (const domainId of question.domainIds) {
        expect(domainIds).toContain(domainId);
      }
      expect(domainIds).toContain(question.domainIds[0]);
    }
  });

  it("every objective id exists in the blueprint", () => {
    const all = new Set(ENCOR_DOMAINS.flatMap((domain) => domain.objectives.map((objective) => objective.id)));
    for (const question of EXAM_BANK_QUESTIONS) {
      expect(question.objectiveIds.length).toBeGreaterThanOrEqual(2);
      for (const objectiveId of question.objectiveIds) {
        expect(all.has(objectiveId), `${question.id} references unknown objective ${objectiveId}`).toBe(true);
      }
    }
  });

  it("every remediation link points at a real arc", () => {
    const arcIds = new Set(ENCOR_MISSION_ARCS.map((arc) => arc.id));
    for (const question of EXAM_BANK_QUESTIONS) {
      expect(arcIds.has(question.remediationArcId), `${question.id} → ${question.remediationArcId}`).toBe(true);
    }
  });

  it("every domain is the primary of at least two items (retakes can draw from the bank)", () => {
    const primaryCounts = new Map<string, number>();
    for (const question of EXAM_BANK_QUESTIONS) {
      primaryCounts.set(question.domainIds[0], (primaryCounts.get(question.domainIds[0]) ?? 0) + 1);
    }
    for (const domain of ENCOR_DOMAINS) {
      expect(primaryCounts.get(domain.id) ?? 0, `no bank items for ${domain.id}`).toBeGreaterThanOrEqual(2);
    }
  });
});
