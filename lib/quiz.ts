import { ENCOR_MISSION_ARCS } from "./encor-catalog";
import { RESCUES } from "./rescues";
import { EXTRA_QUIZ_QUESTIONS } from "./quiz-extra";

/**
 * Per-arc question bank (curriculum "Required Content Per Mission Arc" #7),
 * shared by the arc quizzes, boss battles, and the daily challenge.
 * The core questions are derived from the vetted rescue `checkpoint` steps;
 * EXTRA_QUIZ_QUESTIONS (lib/quiz-extra.ts) tops every arc up to 8+ so even the
 * smallest arcs can field a full Elite (8-question) boss fight.
 */

export type QuizOption = {
  value: string;
  title: string;
  note?: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correct: string;
  explain: string;
  wrongGuidance: string;
};

/** Arc id → rescue mission id (rescues use short names, arcs use catalog ids). */
export const ARC_TO_MISSION: Record<string, string> = {
  "vlan-that-vanished": "vlan",
  "stp-storm": "stp",
  "bundled-bottleneck": "ec",
  "area-zero-hero": "ospf",
  "edge-has-opinions": "edge",
  "gateway-at-dawn": "gateway",
  "edge-services": "edge-services",
  "tunnel-vision": "tunnel-vision",
  "fabric-express": "fabric-express",
  "sdwan-overlay": "sdwan",
  "signal-detective": "signal-detective",
  "campus-fabric": "campus-fabric",
  "lock-the-control-plane": "lock-the-control-plane",
  "automator-prime": "automator-prime",
};

export function arcTitle(arcId: string): string {
  return ENCOR_MISSION_ARCS.find((arc) => arc.id === arcId)?.title ?? arcId;
}

/** Every checkpoint step of the arc's rescues, as a quiz question. */
export function getArcQuiz(arcId: string): QuizQuestion[] {
  const mission = ARC_TO_MISSION[arcId];
  const questions: QuizQuestion[] = [];
  for (const rescue of RESCUES) {
    if (rescue.mission !== mission) continue;
    rescue.steps.forEach((step, index) => {
      if (step.kind !== "checkpoint") return;
      questions.push({
        id: `${rescue.id}-${index}`,
        prompt: step.prompt,
        options: step.options.map((option) => ({ value: option.value, title: option.title, note: option.note })),
        correct: step.correct,
        explain: step.explain,
        wrongGuidance: step.wrongGuidance,
      });
    });
  }
  return [...questions, ...(EXTRA_QUIZ_QUESTIONS[arcId] ?? [])];
}

export type QuizPhase = "answering" | "feedback" | "done";

export type QuizSessionState = {
  arcId: string;
  index: number;
  answers: (string | null)[];
  phase: QuizPhase;
};

export function startQuiz(arcId: string): QuizSessionState {
  return { arcId, index: 0, answers: [], phase: "answering" };
}

export function answerQuiz(state: QuizSessionState, value: string): QuizSessionState {
  if (state.phase !== "answering") return state;
  const answers = [...state.answers];
  answers[state.index] = value;
  return { ...state, answers, phase: "feedback" };
}

export function advanceQuiz(state: QuizSessionState, total: number): QuizSessionState {
  if (state.phase !== "feedback") return state;
  if (state.index < total - 1) {
    return { ...state, index: state.index + 1, phase: "answering" };
  }
  return { ...state, phase: "done" };
}

export function quizScore(state: QuizSessionState, questions: QuizQuestion[]): { correct: number; total: number; perfect: boolean } {
  const correct = questions.reduce((count, question, index) => count + (state.answers[index] === question.correct ? 1 : 0), 0);
  const total = questions.length;
  return { correct, total, perfect: total > 0 && correct === total };
}
