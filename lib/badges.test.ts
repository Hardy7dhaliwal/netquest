import { describe, expect, it } from "vitest";
import { BADGES, getBadgeStatus, type BadgeSnapshot } from "./badges";
import { ENCOR_DOMAINS } from "./encor-catalog";

const EMPTY: BadgeSnapshot = {
  xp: 0,
  streak: 0,
  completedMissions: [],
  mastery: {},
  quizResults: {},
  cardReviews: {},
};

function status(id: string, snapshot: BadgeSnapshot = EMPTY) {
  const entry = getBadgeStatus(snapshot).find((candidate) => candidate.badge.id === id);
  if (!entry) throw new Error(`badge "${id}" not found`);
  return entry;
}

function allObjectivesAt(score: number): Record<string, number> {
  const mastery: Record<string, number> = {};
  for (const domain of ENCOR_DOMAINS) {
    for (const objective of domain.objectives) {
      mastery[objective.id] = score;
    }
  }
  return mastery;
}

describe("badges", () => {
  it("includes the PRD's named badges", () => {
    const titles = BADGES.map((badge) => badge.title);
    for (const expected of ["CLI Apprentice", "VLAN Initiate", "STP Survivor", "OSPF Neighbor", "Packet Detective", "Troubleshooting Specialist"]) {
      expect(titles).toContain(expected);
    }
  });

  it("earns CLI Apprentice on the first completed mission", () => {
    expect(status("cli-apprentice").earned).toBe(false);
    expect(status("cli-apprentice", { ...EMPTY, completedMissions: ["stp-storm"] }).earned).toBe(true);
  });

  it("earns arc badges only when that exact arc is completed", () => {
    const otherArc = { ...EMPTY, completedMissions: ["stp-storm"] };
    expect(status("vlan-initiate", otherArc).earned).toBe(false);
    expect(status("stp-survivor", otherArc).earned).toBe(true);
    expect(status("vlan-initiate", { ...EMPTY, completedMissions: ["vlan-that-vanished"] }).earned).toBe(true);
  });

  it("counts missions toward the milestone badges", () => {
    const five = { ...EMPTY, completedMissions: ["a", "b", "c", "d", "e"] };
    expect(status("troubleshooting-specialist", five).earned).toBe(true);
    expect(status("network-operator", five).progress).toBe(5);
    expect(status("network-operator", five).earned).toBe(false);
    expect(status("blueprint-complete", { ...EMPTY, completedMissions: Array.from({ length: 17 }, (_, i) => `m${i}`) }).earned).toBe(true);
  });

  it("caps XP progress at the target", () => {
    const rich = { ...EMPTY, xp: 5000 };
    expect(status("centurion", rich)).toMatchObject({ progress: 1000, earned: true });
    expect(status("marathoner", rich)).toMatchObject({ progress: 2000, earned: true });
    expect(status("centurion", { ...EMPTY, xp: 750 }).progress).toBe(750);
  });

  it("counts perfect quizzes only", () => {
    const snapshot = {
      ...EMPTY,
      quizResults: {
        "stp-storm": { correct: 3, total: 3, perfect: true },
        "bundled-bottleneck": { correct: 1, total: 3, perfect: false },
      },
    };
    expect(status("quiz-ace", snapshot).progress).toBe(1);
    expect(status("quiz-ace", snapshot).earned).toBe(true);
    expect(status("quiz-master", snapshot).progress).toBe(1);
    expect(status("quiz-master", { ...EMPTY, quizResults: { a: { correct: 1, total: 1, perfect: true }, b: { correct: 1, total: 1, perfect: true }, c: { correct: 1, total: 1, perfect: true }, d: { correct: 1, total: 1, perfect: true }, e: { correct: 1, total: 1, perfect: true } } }).earned).toBe(true);
  });

  it("counts flashcards reviewed for Card Scholar", () => {
    expect(status("card-scholar", { ...EMPTY, cardReviews: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`c${i}`, {}])) }).earned).toBe(true);
  });

  it("requires all 47 objectives at Guided for Exam Ready", () => {
    expect(status("exam-ready", { ...EMPTY, mastery: allObjectivesAt(70) })).toMatchObject({ progress: 47, earned: true });
    const oneShort = allObjectivesAt(70);
    oneShort["3.1.a"] = 50;
    expect(status("exam-ready", { ...EMPTY, mastery: oneShort })).toMatchObject({ progress: 46, earned: false });
  });

  it("counts Independent objectives for Independent Operator", () => {
    expect(status("independent-operator", { ...EMPTY, mastery: allObjectivesAt(85) })).toMatchObject({ progress: 10, earned: true });
    expect(status("independent-operator", { ...EMPTY, mastery: allObjectivesAt(70) }).earned).toBe(false);
  });

  it("tracks the streak badge", () => {
    expect(status("week-warrior", { ...EMPTY, streak: 7 }).earned).toBe(true);
    expect(status("week-warrior", { ...EMPTY, streak: 3 }).earned).toBe(false);
  });

  it("never reports progress above the target", () => {
    for (const entry of getBadgeStatus({ ...EMPTY, xp: 9999, completedMissions: Array.from({ length: 30 }, (_, i) => `m${i}`) })) {
      expect(entry.progress).toBeLessThanOrEqual(entry.badge.target);
    }
  });
});
