import { getWeakObjectives } from "./mastery";
import type { BossRecords, DailyState, ProgressData, QuizResult } from "./progress-store";

/**
 * Cross-device sync engine (PRD §20 "Auth and persistence").
 *
 * The cloud stores one progress blob per user. Sync is conflict-free for a
 * single player on a few devices because every merged field is monotonic or
 * unioned — mastery/XP/streaks only ever grow, lists union, and per-card quiz
 * and flashcard states keep the freshest entry. Pushing before pulling and
 * pushing the merged result back lets both devices converge to the same blob.
 *
 * The engine is transport-agnostic so it is fully unit-testable with a fake;
 * the Supabase transport lives in ./sync-supabase.
 */

/** The persistable progress payload plus the wall-clock time it was written. */
export type ProgressSnapshot = Omit<ProgressData, "syncStatus" | "syncMessage"> & { updatedAt: number };

/** Snapshot the persistable part of the store, stamped with the current time. */
export function buildSnapshot(state: ProgressData, now: number = Date.now()): ProgressSnapshot {
  return {
    xp: state.xp,
    streak: state.streak,
    weakTopics: state.weakTopics,
    completedMissions: state.completedMissions,
    mastery: state.mastery,
    quizResults: state.quizResults,
    cardReviews: state.cardReviews,
    badges: state.badges,
    daily: state.daily,
    bossRecords: state.bossRecords,
    lastSyncedAt: state.lastSyncedAt,
    updatedAt: now,
  };
}

function union(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

function betterQuiz(left: QuizResult | undefined, right: QuizResult | undefined): QuizResult | undefined {
  if (!left) return right;
  if (!right) return left;
  if (left.correct !== right.correct) return left.correct > right.correct ? left : right;
  if (left.total !== right.total) return left.total > right.total ? left : right;
  return { correct: left.correct, total: left.total, perfect: left.perfect || right.perfect };
}

function mergeDaily(left: DailyState | null, right: DailyState | null): DailyState | null {
  if (!left) return right;
  if (!right) return left;
  if (left.date !== right.date) return left.date > right.date ? left : right;
  return { date: left.date, arcId: left.arcId, done: left.done || right.done };
}

function mergeBossRecords(left: BossRecords, right: BossRecords): BossRecords {
  return {
    battles: Math.max(left.battles, right.battles),
    victories: Math.max(left.victories, right.victories),
    bestAccuracy: Math.max(left.bestAccuracy, right.bestAccuracy),
  };
}

/**
 * Monotonic merge of two progress snapshots — nothing ever decreases.
 * weakTopics are re-derived from the merged mastery (they are a projection of
 * mastery in the app anyway), and lastSyncedAt/updatedAt take the newest time.
 */
export function mergeProgress(left: ProgressSnapshot, right: ProgressSnapshot): ProgressSnapshot {
  const mastery: ProgressSnapshot["mastery"] = { ...left.mastery };
  for (const [id, score] of Object.entries(right.mastery)) {
    mastery[id] = Math.max(mastery[id] ?? 0, score);
  }

  const quizResults: ProgressSnapshot["quizResults"] = { ...left.quizResults };
  for (const [arcId, result] of Object.entries(right.quizResults)) {
    const merged = betterQuiz(quizResults[arcId], result);
    if (merged) quizResults[arcId] = merged;
  }

  const cardReviews: ProgressSnapshot["cardReviews"] = { ...left.cardReviews };
  for (const [cardId, state] of Object.entries(right.cardReviews)) {
    const existing = cardReviews[cardId];
    if (!existing || (state.due ?? 0) > (existing.due ?? 0)) cardReviews[cardId] = state;
  }

  return {
    xp: Math.max(left.xp, right.xp),
    streak: Math.max(left.streak, right.streak),
    weakTopics: getWeakObjectives(mastery)
      .slice(0, 3)
      .map((objective) => objective.label),
    completedMissions: union(left.completedMissions, right.completedMissions),
    mastery,
    quizResults,
    cardReviews,
    badges: union(left.badges, right.badges),
    daily: mergeDaily(left.daily, right.daily),
    bossRecords: mergeBossRecords(left.bossRecords, right.bossRecords),
    lastSyncedAt: Math.max(left.lastSyncedAt ?? 0, right.lastSyncedAt ?? 0) || null,
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
  };
}

export type SyncTransport = {
  fetchRemote: () => Promise<ProgressSnapshot | null>;
  pushRemote: (snapshot: ProgressSnapshot) => Promise<void>;
};

/**
 * Converge the local snapshot with the cloud: fetch, merge, push back.
 * Fetching BEFORE pushing is what keeps a stale device from destroying newer
 * cloud data — because {@link mergeProgress} is monotonic, an old device that
 * pulls a newer blob and re-pushes the union never loses anything, whereas a
 * push-first order would overwrite the cloud with the stale blob. First-time
 * sync is handled the same way: no remote means the local blob is pushed as-is.
 */
export async function syncWithTransport(local: ProgressSnapshot, transport: SyncTransport): Promise<ProgressSnapshot> {
  const remote = await transport.fetchRemote();
  const merged = remote ? mergeProgress(local, remote) : local;
  await transport.pushRemote(merged);
  return merged;
}
