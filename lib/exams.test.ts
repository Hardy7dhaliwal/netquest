import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS } from "./encor-catalog";
import {
  advanceExam,
  answerExam,
  buildExam,
  coveredObjectives,
  domainCounts,
  EXAM_SPECS,
  finishExam,
  isExpired,
  scoreExam,
  secondsRemaining,
  startExam,
  type ExamQuestion,
} from "./exams";

describe("exam assembly", () => {
  it("aligns every mock to the exact blueprint domain weights", () => {
    for (const kind of ["diagnostic", "mock-a", "mock-b"] as const) {
      const counts = domainCounts(kind);
      expect(counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(EXAM_SPECS[kind].questionCount);
      expect(counts.map((entry) => entry.weight)).toEqual(ENCOR_DOMAINS.map((domain) => domain.weight));
      const weights = ENCOR_DOMAINS.reduce((sum, domain) => sum + domain.weight, 0);
      for (const entry of counts) {
        const expectedShare = (entry.weight / weights) * EXAM_SPECS[kind].questionCount;
        // Weighted share matches within one question (rounding).
        expect(Math.abs(entry.count - expectedShare)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("assembles full-length mocks with exactly the spec'd question count", () => {
    for (const kind of ["diagnostic", "mock-a", "mock-b"] as const) {
      const exam = buildExam(kind, `${kind}:test`);
      expect(exam).toHaveLength(EXAM_SPECS[kind].questionCount);
    }
  });

  it("is deterministic for a given seed and varied across seeds", () => {
    const a1 = buildExam("mock-a", "seed-1");
    const a2 = buildExam("mock-a", "seed-1");
    const b = buildExam("mock-a", "seed-2");
    expect(a1.map((question) => question.id)).toEqual(a2.map((question) => question.id));
    expect(a1.map((question) => question.id)).not.toEqual(b.map((question) => question.id));
  });

  it("tags every question with a domain and objectives", () => {
    for (const question of buildExam("mock-b", "tags")) {
      expect(ENCOR_DOMAINS.map((domain) => domain.id)).toContain(question.domainId);
      expect(question.objectiveIds.length).toBeGreaterThan(0);
      expect(question.arcId.length).toBeGreaterThan(0);
    }
  });

  it("covers a broad spread of objectives across both mocks", () => {
    const covered = coveredObjectives([...buildExam("mock-a", "spread"), ...buildExam("mock-b", "spread")]);
    // Both mocks together should touch a wide share of the blueprint.
    expect(covered.length).toBeGreaterThanOrEqual(20);
  });
});

describe("timed session", () => {
  it("counts down from the spec time limit", () => {
    const session = startExam("mock-a", "s", 0);
    expect(secondsRemaining(session, 0)).toBe(EXAM_SPECS["mock-a"].timeLimitSec);
    expect(secondsRemaining(session, 60_000)).toBe(EXAM_SPECS["mock-a"].timeLimitSec - 60);
    expect(secondsRemaining(session, EXAM_SPECS["mock-a"].timeLimitSec * 1000)).toBe(0);
  });

  it("marks a session expired only when time runs out while answering", () => {
    const session = startExam("mock-a", "s", 0);
    expect(isExpired(session, 0)).toBe(false);
    expect(isExpired(session, EXAM_SPECS["mock-a"].timeLimitSec * 1000)).toBe(true);
    // A finished session is never 'expired' even past the deadline.
    const done = finishExam(session);
    expect(isExpired(done, 10 ** 12)).toBe(false);
  });

  it("the diagnostic is untimed", () => {
    const session = startExam("diagnostic", "s", 0);
    expect(secondsRemaining(session, 10 ** 12)).toBe(0);
    expect(isExpired(session, 10 ** 12)).toBe(false);
  });

  it("walks answering → feedback → done", () => {
    const exam = buildExam("diagnostic", "walk");
    let session = startExam("diagnostic", "walk");
    session = answerExam(session, exam[0].correct);
    expect(session.phase).toBe("feedback");
    session = advanceExam(session, exam.length);
    expect(session.phase).toBe("answering");
    expect(session.index).toBe(1);
    // Answer everything and reach done.
    for (let i = 1; i < exam.length; i++) {
      session = answerExam(session, exam[i].correct);
      session = advanceExam(session, exam.length);
    }
    expect(session.phase).toBe("done");
  });
});

describe("score report", () => {
  it("scores correct answers and computes the percentage", () => {
    const exam = buildExam("diagnostic", "score");
    let session = startExam("diagnostic", "score");
    session = answerExam(session, exam[0].correct);
    session = advanceExam(session, exam.length);
    const result = scoreExam(session, exam);
    expect(result.correct).toBe(1);
    expect(result.total).toBe(exam.length);
    expect(result.pct).toBe(Math.round((1 / exam.length) * 100));
  });

  it("treats unanswered questions as wrong", () => {
    const exam = buildExam("diagnostic", "unanswered");
    const session = startExam("diagnostic", "unanswered");
    const result = scoreExam(session, exam);
    expect(result.correct).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("reports per-domain breakdowns that roll up to the total", () => {
    const exam = buildExam("mock-a", "domains");
    const session = finishExam(startExam("mock-a", "domains"));
    const result = scoreExam(session, exam);
    expect(result.byDomain.reduce((sum, entry) => sum + entry.total, 0)).toBe(exam.length);
    for (const domain of result.byDomain) {
      expect(domain.pct).toBe(0);
    }
  });

  it("flags a passing score when above the spec threshold", () => {
    const exam = buildExam("diagnostic", "pass");
    let session = startExam("diagnostic", "pass");
    for (let i = 0; i < exam.length; i++) {
      session = answerExam(session, exam[i].correct);
      session = advanceExam(session, exam.length);
    }
    const result = scoreExam(session, exam);
    expect(result.correct).toBe(exam.length);
    expect(result.passed).toBe(true);
  });

  it("produces remediation links pointing at the right arcs", () => {
    const exam = buildExam("mock-a", "remediation");
    const session = finishExam(startExam("mock-a", "remediation"));
    const result = scoreExam(session, exam);
    for (const link of result.remediation) {
      expect(link.arcId.length).toBeGreaterThan(0);
      expect(link.objectiveId.length).toBeGreaterThan(0);
      expect(link.arcTitle.length).toBeGreaterThan(0);
      expect(link.objectiveLabel.length).toBeGreaterThan(0);
    }
  });
});
