import { ENCOR_MISSION_ARCS } from "./encor-catalog";
import { ARC_TO_MISSION, getArcQuiz, type QuizQuestion } from "./quiz";

/**
 * Slice C — the under-pressure modes (PRD §13 boss battles, §14 daily challenge).
 *
 * Both modes run timed gauntlets drawn from the vetted rescue checkpoint bank
 * (the same questions the arc quizzes use), so no new question authoring is
 * needed. Seeded randomness keeps the daily challenge deterministic per calendar
 * day while boss battles get a fresh seed per fight.
 */

export const BOSS_XP = { victory: 75, defeat: 15 } as const;
export const DAILY_XP = 40;
export const BOSS_QUESTIONS = 6;
export const DAILY_QUESTIONS = 3;
/** Seconds allowed per question — the "pressure". */
export const BOSS_TIME_PER_QUESTION = 15;
export const DAILY_TIME_PER_QUESTION = 20;
/** Accuracy needed to win a battle (5/6 = 83%, 4/5 = 80%). */
export const VICTORY_ACCURACY = 0.8;

export type BossTierId = "rookie" | "veteran" | "elite";

export type BossTier = {
  id: BossTierId;
  label: string;
  /** Short spec line, e.g. "4 questions · 25s each". */
  description: string;
  questions: number;
  timePerQuestion: number;
  xp: { victory: number; defeat: number };
};

/** Boss difficulty tiers — harder tiers ask more questions in less time for more XP. */
export const BOSS_TIERS: BossTier[] = [
  {
    id: "rookie",
    label: "Rookie",
    description: "4 questions · 25s each",
    questions: 4,
    timePerQuestion: 25,
    xp: { victory: 50, defeat: 10 },
  },
  {
    id: "veteran",
    label: "Veteran",
    description: "6 questions · 15s each",
    questions: BOSS_QUESTIONS,
    timePerQuestion: BOSS_TIME_PER_QUESTION,
    xp: { victory: BOSS_XP.victory, defeat: BOSS_XP.defeat },
  },
  {
    id: "elite",
    label: "Elite",
    description: "8 questions · 10s each",
    questions: 8,
    timePerQuestion: 10,
    xp: { victory: 100, defeat: 20 },
  },
];

// ─── Deterministic PRNG (xmur3 string hash + mulberry32), no dependencies. ──
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic PRNG shared by boss battles and mock exams (seeded per run). */
export function seededRng(seed: string): () => number {
  return mulberry32(xmur3(seed)());
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

// ─── Boss battles ──────────────────────────────────────────────────────────

export type BossFight = {
  arcId: string;
  title: string;
  /** How many checkpoint questions the arc's rescues actually hold. */
  questionCount: number;
};

/** Every playable arc with a question bank becomes a boss fight. */
export function getBossFights(): BossFight[] {
  return ENCOR_MISSION_ARCS.filter(
    (arc) => (arc.status === "available" || arc.status === "complete") && ARC_TO_MISSION[arc.id],
  ).map((arc) => ({ arcId: arc.id, title: arc.title, questionCount: getArcQuiz(arc.id).length }));
}

/** A seeded, time-pressured sample of the arc's checkpoint questions. */
export function getBossBattle(arcId: string, seed: string, count: number = BOSS_QUESTIONS): QuizQuestion[] {
  return pickMany(getArcQuiz(arcId), count, seededRng(seed));
}

/** A battle is won at or above the accuracy threshold. */
export function isVictory(accuracy: number): boolean {
  return accuracy >= VICTORY_ACCURACY;
}

// ─── Daily challenge ───────────────────────────────────────────────────────

export type DailyChallenge = {
  /** Calendar day the challenge belongs to, YYYY-MM-DD. */
  date: string;
  arcId: string;
  arcTitle: string;
  questions: QuizQuestion[];
};

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** One deterministic challenge per calendar day: arc + three questions. */
export function getDailyChallenge(now: Date = new Date()): DailyChallenge {
  const fights = getBossFights();
  const date = dateKey(now);
  if (fights.length === 0) return { date, arcId: "", arcTitle: "", questions: [] };
  const rng = seededRng(`daily:${date}`);
  const fight = fights[Math.floor(rng() * fights.length)];
  const questions = pickMany(getArcQuiz(fight.arcId), DAILY_QUESTIONS, rng);
  return { date, arcId: fight.arcId, arcTitle: fight.title, questions };
}
