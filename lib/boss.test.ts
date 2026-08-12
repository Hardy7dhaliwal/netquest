import { describe, expect, it } from "vitest";
import {
  BOSS_QUESTIONS,
  DAILY_QUESTIONS,
  VICTORY_ACCURACY,
  dateKey,
  getBossBattle,
  getBossFights,
  getDailyChallenge,
  isVictory,
} from "./boss";
import { getArcQuiz } from "./quiz";
import { ARC_TO_MISSION } from "./quiz";

describe("boss engine", () => {
  it("offers a boss fight for every playable arc with a question bank", () => {
    const fights = getBossFights();
    expect(fights.length).toBeGreaterThanOrEqual(14);
    for (const fight of fights) {
      expect(fight.questionCount).toBeGreaterThan(0);
      expect(ARC_TO_MISSION[fight.arcId]).toBeTruthy();
    }
  });

  it("samples up to the battle size from the arc's question bank", () => {
    const battle = getBossBattle("stp-storm", "seed-1");
    expect(battle.length).toBeLessThanOrEqual(BOSS_QUESTIONS);
    expect(battle.length).toBeGreaterThan(0);
    const bank = getArcQuiz("stp-storm");
    for (const question of battle) {
      expect(bank.some((entry) => entry.id === question.id)).toBe(true);
    }
  });

  it("is deterministic for a given seed and arc", () => {
    const a = getBossBattle("edge-services", "2026-08-12");
    const b = getBossBattle("edge-services", "2026-08-12");
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(a.map((q) => q.id)).not.toEqual(getBossBattle("edge-services", "other-seed").map((q) => q.id));
  });

  it("declares victory at the accuracy threshold", () => {
    expect(isVictory(VICTORY_ACCURACY)).toBe(true);
    expect(isVictory(1)).toBe(true);
    expect(isVictory(0.6)).toBe(false);
    // 5 of 6 and 4 of 5 both clear the bar.
    expect(isVictory(5 / 6)).toBe(true);
    expect(isVictory(4 / 5)).toBe(true);
  });
});

describe("daily challenge", () => {
  it("formats calendar dates as YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 7, 12))).toBe("2026-08-12");
    expect(dateKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("is deterministic for the same calendar day", () => {
    const a = getDailyChallenge(new Date(2026, 7, 12));
    const b = getDailyChallenge(new Date(2026, 7, 12));
    expect(a.date).toBe("2026-08-12");
    expect(a.arcId).toBe(b.arcId);
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
  });

  it("serves three questions from the chosen arc's bank", () => {
    const challenge = getDailyChallenge(new Date(2026, 7, 12));
    expect(challenge.questions).toHaveLength(DAILY_QUESTIONS);
    const bank = getArcQuiz(challenge.arcId);
    for (const question of challenge.questions) {
      expect(bank.some((entry) => entry.id === question.id)).toBe(true);
    }
  });

  it("rotates across arcs over time", () => {
    const arcs = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      arcs.add(getDailyChallenge(new Date(2026, 7, day)).arcId);
    }
    expect(arcs.size).toBeGreaterThan(1);
  });
});
