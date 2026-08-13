import { describe, expect, it } from "vitest";
import { ENCOR_MISSION_ARCS } from "./encor-catalog";
import { advanceQuiz, answerQuiz, arcTitle, getArcQuiz, quizScore, startQuiz } from "./quiz";

describe("quiz engine", () => {
  it("derives at least one question for every playable arc", () => {
    for (const arc of ENCOR_MISSION_ARCS) {
      if (arc.status !== "available" && arc.status !== "complete") continue;
      const questions = getArcQuiz(arc.id);
      expect(questions.length, `${arc.id} has no quiz questions`).toBeGreaterThan(0);
      for (const question of questions) {
        expect(question.options.map((option) => option.value)).toContain(question.correct);
        expect(question.prompt.length).toBeGreaterThan(0);
        expect(question.explain.length).toBeGreaterThan(0);
      }
    }
  });

  it("produces unique question ids", () => {
    const ids = ENCOR_MISSION_ARCS.filter((arc) => arc.status !== "planned").flatMap((arc) => getArcQuiz(arc.id).map((question) => question.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every playable arc a full Elite-sized bank (8+ questions)", () => {
    for (const arc of ENCOR_MISSION_ARCS) {
      if (arc.status !== "available" && arc.status !== "complete") continue;
      expect(getArcQuiz(arc.id).length, `${arc.id} bank too small for an Elite battle`).toBeGreaterThanOrEqual(8);
    }
  });

  it("shuffles nothing — the quiz is deterministic", () => {
    expect(getArcQuiz("stp-storm")).toEqual(getArcQuiz("stp-storm"));
    expect(getArcQuiz("stp-storm")[0].prompt).toContain("bridge ID");
  });

  it("walks a quiz to a perfect score", () => {
    const questions = getArcQuiz("stp-storm");
    let state = startQuiz("stp-storm");
    for (const question of questions) {
      expect(state.phase).toBe("answering");
      state = answerQuiz(state, question.correct);
      expect(state.phase).toBe("feedback");
      state = advanceQuiz(state, questions.length);
    }
    expect(state.phase).toBe("done");
    expect(quizScore(state, questions)).toEqual({ correct: questions.length, total: questions.length, perfect: true });
  });

  it("scores wrong answers and reports imperfection", () => {
    const questions = getArcQuiz("stp-storm");
    let state = startQuiz("stp-storm");
    state = answerQuiz(state, questions[0].options.find((option) => option.value !== questions[0].correct)!.value);
    state = advanceQuiz(state, questions.length);
    expect(quizScore(state, questions).perfect).toBe(false);
    expect(quizScore(state, questions).correct).toBe(0);
  });

  it("ignores answers in the wrong phase and double answers", () => {
    const questions = getArcQuiz("bundled-bottleneck");
    let state = startQuiz("bundled-bottleneck");
    // An answer while feedback for the previous question is showing is ignored.
    state = answerQuiz(state, questions[0].correct);
    expect(answerQuiz(state, questions[1]?.correct ?? questions[0].correct)).toBe(state);
    // Advancing makes answers legal again…
    state = advanceQuiz(state, questions.length);
    state = answerQuiz(state, questions[1]?.correct ?? questions[0].correct);
    // …but a second answer on the same question is ignored (no double answers).
    expect(answerQuiz(state, questions[0].correct)).toBe(state);
  });

  it("maps arc ids to titles", () => {
    expect(arcTitle("bundled-bottleneck")).toBe("The Bundled Bottleneck");
  });
});
