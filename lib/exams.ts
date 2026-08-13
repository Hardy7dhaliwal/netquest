import { ENCOR_DOMAINS, ENCOR_MISSION_ARCS, type EncorDomainId } from "./encor-catalog";
import { getArcQuiz, type QuizQuestion } from "./quiz";
import { seededRng } from "./boss";

/**
 * Mixed exam preparation (PRD "learn and pass" — diagnostic + mock exams).
 *
 * Mocks are assembled deterministically from the vetted per-arc quiz banks,
 * sampling questions per domain in proportion to the blueprint weights
 * (Architecture 15%, Virtualization 10%, Infrastructure 30%, Assurance 10%,
 * Security 20%, Automation 15%). Seeding gives every attempt a fresh mixed
 * variant while staying reproducible in tests.
 *
 * The diagnostic is a short, untimed first-pass exam run before study begins;
 * Mock A and Mock B are full-length timed exams. Each question is attributed
 * to the domain and objectives of the arc it came from, so the score report
 * can show per-domain and per-objective performance plus remediation links.
 */

export type ExamKind = "diagnostic" | "mock-a" | "mock-b";

export type ExamSpec = {
  id: ExamKind;
  title: string;
  subtitle: string;
  /** Seconds allowed; 0 = untimed (diagnostic). */
  timeLimitSec: number;
  /** Total question count (assembled per domain weights). */
  questionCount: number;
  /** Minimum percentage to pass (for remediation and timed mastery). */
  passPct: number;
};

export const EXAM_SPECS: Record<ExamKind, ExamSpec> = {
  diagnostic: {
    id: "diagnostic",
    title: "Diagnostic exam",
    subtitle: "A short, untimed first pass across the whole blueprint — find your starting gaps.",
    timeLimitSec: 0,
    questionCount: 15,
    passPct: 60,
  },
  "mock-a": {
    id: "mock-a",
    title: "Mock exam A",
    subtitle: "Full-length, timed, mixed-domain — aligned to the real ENCOR domain weights.",
    timeLimitSec: 55 * 60,
    questionCount: 40,
    passPct: 70,
  },
  "mock-b": {
    id: "mock-b",
    title: "Mock exam B",
    subtitle: "A second full-length timed exam with a different question mix — retake for variety.",
    timeLimitSec: 55 * 60,
    questionCount: 40,
    passPct: 70,
  },
};

export type ExamQuestion = QuizQuestion & {
  domainId: EncorDomainId;
  /** Objectives this question exercises (the source arc's objectives). */
  objectiveIds: string[];
  arcId: string;
};

export type ExamDomainCount = { domainId: EncorDomainId; weight: number; count: number };

/**
 * Question count per domain for a given exam, by exact blueprint weight.
 * Uses the largest-remainder method so every exam hits the spec'd question
 * count while staying within one question of each domain's weighted share.
 */
export function domainCounts(kind: ExamKind): ExamDomainCount[] {
  const total = EXAM_SPECS[kind].questionCount;
  const weightSum = ENCOR_DOMAINS.reduce((sum, domain) => sum + domain.weight, 0);
  const exact = ENCOR_DOMAINS.map((domain) => ({ domainId: domain.id, weight: domain.weight, exact: (domain.weight / weightSum) * total }));
  const counts = exact.map((entry) => ({ domainId: entry.domainId, weight: entry.weight, count: Math.floor(entry.exact) }));
  let remainder = total - counts.reduce((sum, entry) => sum + entry.count, 0);
  // Distribute leftover questions to the domains with the largest fractions.
  const byFraction = [...exact].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (const entry of byFraction) {
    if (remainder <= 0) break;
    const row = counts.find((candidate) => candidate.domainId === entry.domainId)!;
    row.count += 1;
    remainder -= 1;
  }
  return counts;
}

/** Every arc question attributed to its first-listed domain and objectives. */
function domainPools(): Record<EncorDomainId, ExamQuestion[]> {
  const pools: Record<EncorDomainId, ExamQuestion[]> = {
    architecture: [],
    virtualization: [],
    infrastructure: [],
    assurance: [],
    security: [],
    automation: [],
  };
  for (const arc of ENCOR_MISSION_ARCS) {
    if (arc.status === "planned") continue;
    const primaryDomain = arc.domains[0];
    for (const question of getArcQuiz(arc.id)) {
      pools[primaryDomain].push({ ...question, domainId: primaryDomain, objectiveIds: [...arc.objectiveIds], arcId: arc.id });
    }
  }
  return pools;
}

function pickMany<T>(pool: T[], count: number, rng: () => number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    const index = Math.floor(rng() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Assemble an exam deterministically from a seed. Different seeds yield
 * different question mixes; the same seed always yields the same exam.
 */
export function buildExam(kind: ExamKind, seed: string = `${kind}:v1`): ExamQuestion[] {
  const pools = domainPools();
  const rng = seededRng(seed);
  const questions: ExamQuestion[] = [];
  for (const { domainId, count } of domainCounts(kind)) {
    const selected = pickMany(pools[domainId], count, rng);
    if (selected.length < count) {
      // Every domain pool holds 8+ questions (each arc is topped up by the
      // extra bank), so a short draw signals a catalog regression — surface it
      // loudly rather than silently shipping a shorter exam.
      throw new Error(`Not enough questions in the ${domainId} pool for exam ${kind}: need ${count}, have ${pools[domainId].length}`);
    }
    questions.push(...selected);
  }
  return questions;
}

// ─── Timed exam session ─────────────────────────────────────────────────────

export type ExamSessionPhase = "answering" | "feedback" | "done";

export type ExamSession = {
  kind: ExamKind;
  seed: string;
  index: number;
  answers: (string | null)[];
  phase: ExamSessionPhase;
  /** Epoch ms the session started (for timed mode). */
  startedAt: number;
};

export function startExam(kind: ExamKind, seed: string = `${kind}:v${Math.floor(Math.random() * 1e6)}`, now: number = Date.now()): ExamSession {
  return { kind, seed, index: 0, answers: [], phase: "answering", startedAt: now };
}

export function answerExam(session: ExamSession, value: string): ExamSession {
  if (session.phase !== "answering") return session;
  const answers = [...session.answers];
  answers[session.index] = value;
  return { ...session, answers, phase: "feedback" };
}

export function advanceExam(session: ExamSession, total: number): ExamSession {
  if (session.phase !== "feedback") return session;
  if (session.index < total - 1) return { ...session, index: session.index + 1, phase: "answering" };
  return { ...session, phase: "done" };
}

/** Seconds remaining in a timed session (0 when untimed or expired). */
export function secondsRemaining(session: ExamSession, now: number = Date.now()): number {
  const spec = EXAM_SPECS[session.kind];
  if (spec.timeLimitSec <= 0) return 0;
  return Math.max(0, spec.timeLimitSec - Math.floor((now - session.startedAt) / 1000));
}

export function isExpired(session: ExamSession, now: number = Date.now()): boolean {
  return secondsRemaining(session, now) === 0 && EXAM_SPECS[session.kind].timeLimitSec > 0 && session.phase !== "done";
}

export function finishExam(session: ExamSession): ExamSession {
  if (session.phase === "done") return session;
  return { ...session, phase: "done" };
}

// ─── Score report ───────────────────────────────────────────────────────────

export type DomainResult = { domainId: EncorDomainId; correct: number; total: number; pct: number };

export type ObjectiveResult = { objectiveId: string; correct: number; total: number; pct: number };

export type RemediationLink = {
  objectiveId: string;
  arcId: string;
  arcTitle: string;
  /** The objective's label (for display). */
  objectiveLabel: string;
};

export type ExamResult = {
  kind: ExamKind;
  seed: string;
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  byDomain: DomainResult[];
  byObjective: ObjectiveResult[];
  /** Weakest objectives (below the exam's pass threshold), for remediation. */
  weakObjectives: ObjectiveResult[];
  remediation: RemediationLink[];
};

const objectiveLabel = (objectiveId: string): string =>
  ENCOR_DOMAINS.flatMap((domain) => domain.objectives).find((objective) => objective.id === objectiveId)?.label ?? objectiveId;

/** Score a finished (or time-expired) exam with a per-objective report. */
export function scoreExam(session: ExamSession, questions: ExamQuestion[]): ExamResult {
  const spec = EXAM_SPECS[session.kind];
  const answers = session.answers;
  const answeredCount = Math.min(answers.length, questions.length);
  const correct = questions.reduce(
    (count, question, index) => count + (answers[index] === question.correct ? 1 : 0),
    0,
  );
  const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const passed = pct >= spec.passPct;

  // Per-domain rollup.
  const byDomain: DomainResult[] = ENCOR_DOMAINS.map((domain) => {
    const items = questions.filter((question) => question.domainId === domain.id);
    const domainCorrect = items.reduce((count, question, index) => {
      const globalIndex = questions.indexOf(question);
      return count + (answers[globalIndex] === question.correct ? 1 : 0);
    }, 0);
    return { domainId: domain.id, correct: domainCorrect, total: items.length, pct: items.length ? Math.round((domainCorrect / items.length) * 100) : 0 };
  });

  // Per-objective rollup (a question attributes to all of its arc's objectives).
  const objectiveTotals = new Map<string, { correct: number; total: number }>();
  questions.forEach((question, index) => {
    const wasCorrect = answers[index] === question.correct;
    for (const objectiveId of question.objectiveIds) {
      const entry = objectiveTotals.get(objectiveId) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (wasCorrect) entry.correct += 1;
      objectiveTotals.set(objectiveId, entry);
    }
  });
  const byObjective: ObjectiveResult[] = [...objectiveTotals.entries()]
    .map(([objectiveId, { correct, total }]) => ({
      objectiveId,
      correct,
      total,
      pct: Math.round((correct / Math.max(total, 1)) * 100),
    }))
    .sort((a, b) => a.pct - b.pct);

  const weakObjectives = byObjective.filter((entry) => entry.pct < spec.passPct);

  const remediation: RemediationLink[] = weakObjectives.map((entry) => {
    const arcId = ENCOR_MISSION_ARCS.find((arc) => arc.objectiveIds.includes(entry.objectiveId))?.id ?? "";
    return {
      objectiveId: entry.objectiveId,
      arcId,
      arcTitle: ENCOR_MISSION_ARCS.find((arc) => arc.id === arcId)?.title ?? arcId,
      objectiveLabel: objectiveLabel(entry.objectiveId),
    };
  });

  return { kind: session.kind, seed: session.seed, correct, total: questions.length, pct, passed, byDomain, byObjective, weakObjectives, remediation };
}

/** Objectives covered by an exam (union of its questions' objective ids). */
export function coveredObjectives(questions: ExamQuestion[]): string[] {
  return [...new Set(questions.flatMap((question) => question.objectiveIds))];
}
