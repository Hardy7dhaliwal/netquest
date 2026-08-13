import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.hoisted(() => {
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });

  return values;
});

import { getLevel, INITIAL_PROGRESS, useProgressStore } from "./progress-store";

beforeEach(() => {
  values.clear();
  useProgressStore.setState(INITIAL_PROGRESS);
});

describe("progress", () => {
  it("calculates levels from XP", () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(499)).toBe(1);
    expect(getLevel(500)).toBe(2);
  });

  it("awards review XP and starts a streak", () => {
    useProgressStore.getState().completeReview();

    expect(useProgressStore.getState().xp).toBe(5);
    expect(useProgressStore.getState().streak).toBe(1);
  });

  it("persists progress after a review", () => {
    useProgressStore.getState().completeReview();

    expect(JSON.parse(values.get("netquest-progress") ?? "{}")).toMatchObject({
      state: { xp: 5, streak: 1 },
    });
  });

  it("resets progress to the initial state", () => {
    useProgressStore.setState({ xp: 25, streak: 3, weakTopics: ["STP"], completedMissions: [] });

    useProgressStore.getState().reset();

    expect(useProgressStore.getState().xp).toBe(0);
    expect(useProgressStore.getState().streak).toBe(0);
    expect(useProgressStore.getState().weakTopics).toEqual(["VLANs and trunks"]);
    expect(useProgressStore.getState().completedMissions).toEqual([]);
  });

  it("awards a mission only once", () => {
    useProgressStore.getState().awardMission("vlan-that-vanished");
    useProgressStore.getState().awardMission("vlan-that-vanished");

    expect(useProgressStore.getState().xp).toBe(150);
    expect(useProgressStore.getState().completedMissions).toEqual(["vlan-that-vanished"]);
  });

  it("supports a custom mission XP award", () => {
    useProgressStore.getState().awardMission("stp-storm", 100);

    expect(useProgressStore.getState().xp).toBe(100);
    expect(useProgressStore.getState().completedMissions).toEqual(["stp-storm"]);
  });

  it("records per-objective mastery from a mission result", () => {
    useProgressStore.getState().recordMissionResult("stp-storm", 2);

    expect(useProgressStore.getState().mastery["3.1.c"]).toBe(70);
    // Weak topics are now derived from mastery instead of the static default.
    expect(useProgressStore.getState().weakTopics).not.toEqual(["VLANs and trunks"]);
  });

  it("ignores unknown mission ids for mastery", () => {
    useProgressStore.getState().recordMissionResult("not-an-arc", 0);

    expect(useProgressStore.getState().mastery).toEqual({});
  });

  it("persists the mastery map", () => {
    useProgressStore.getState().recordMissionResult("area-zero-hero", 0);

    expect(JSON.parse(values.get("netquest-progress") ?? "{}")).toMatchObject({
      state: { mastery: { "3.2.b": 85 } },
    });
  });

  it("awards quiz XP once and bumps mastery", () => {
    useProgressStore.getState().recordQuizResult("stp-storm", 3, 3);
    expect(useProgressStore.getState().xp).toBe(25);
    expect(useProgressStore.getState().mastery["3.1.c"]).toBe(70);

    // Re-quizzing does not farm XP, and a worse rerun never lowers mastery.
    useProgressStore.getState().recordQuizResult("stp-storm", 1, 3);
    expect(useProgressStore.getState().xp).toBe(25);
    expect(useProgressStore.getState().mastery["3.1.c"]).toBe(70);
  });

  it("awards partial-quiz XP at the lower rate", () => {
    useProgressStore.getState().recordQuizResult("bundled-bottleneck", 1, 3);
    expect(useProgressStore.getState().xp).toBe(10);
    expect(useProgressStore.getState().quizResults["bundled-bottleneck"]).toEqual({ correct: 1, total: 3, perfect: false });
  });

  it("rewards 5 XP when a due flashcard is remembered", () => {
    useProgressStore.getState().reviewFlashcard("card-1", true);
    expect(useProgressStore.getState().xp).toBe(5);
    expect(useProgressStore.getState().cardReviews["card-1"].interval).toBe(1);

    // The scheduled card is no longer due — no farmable XP until its due date.
    useProgressStore.getState().reviewFlashcard("card-1", true);
    expect(useProgressStore.getState().xp).toBe(5);
  });

  it("starts with no badges", () => {
    expect(useProgressStore.getState().badges).toEqual([]);
  });

  it("awards badge XP exactly once via syncBadges", () => {
    // One completed mission earns CLI Apprentice (and VLAN Initiate here).
    useProgressStore.getState().awardMission("vlan-that-vanished", 150);
    useProgressStore.getState().syncBadges();

    const { badges, xp } = useProgressStore.getState();
    expect(badges).toContain("cli-apprentice");
    expect(badges).toContain("vlan-initiate");
    expect(xp).toBe(150 + badges.length * 20);

    // A second sync finds nothing new — no double XP, no duplicate ids.
    useProgressStore.getState().syncBadges();
    expect(useProgressStore.getState().badges).toEqual(badges);
    expect(useProgressStore.getState().xp).toBe(xp);
  });

  it("earns new badges when new milestones are reached", () => {
    useProgressStore.getState().awardMission("stp-storm", 100);
    useProgressStore.getState().syncBadges();
    const firstCount = useProgressStore.getState().badges.length;

    for (let i = 0; i < 4; i++) useProgressStore.getState().awardMission(`arc-${i}`, 100);
    useProgressStore.getState().syncBadges();

    const after = useProgressStore.getState();
    expect(after.badges.length).toBeGreaterThan(firstCount);
    expect(after.badges).toContain("troubleshooting-specialist");
  });

  it("persists earned badges", () => {
    useProgressStore.getState().awardMission("vlan-that-vanished", 150);
    useProgressStore.getState().syncBadges();

    const persisted = JSON.parse(values.get("netquest-progress") ?? "{}") as { state: { badges: string[] } };
    expect(persisted.state.badges).toContain("cli-apprentice");
  });

  it("claims the daily challenge once per calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    try {
      useProgressStore.getState().claimDaily("stp-storm");
      expect(useProgressStore.getState().xp).toBe(40);
      expect(useProgressStore.getState().streak).toBe(1);
      expect(useProgressStore.getState().daily).toEqual({ date: "2026-08-12", arcId: "stp-storm", done: true });
      expect(useProgressStore.getState().dailyHistory).toEqual(["2026-08-12"]);

      // A second claim the same day awards nothing and never duplicates history.
      useProgressStore.getState().claimDaily("stp-storm");
      expect(useProgressStore.getState().xp).toBe(40);
      expect(useProgressStore.getState().dailyHistory).toEqual(["2026-08-12"]);

      // A new day opens a fresh claim and appends to the streak history.
      vi.setSystemTime(new Date(2026, 7, 13));
      useProgressStore.getState().claimDaily("stp-storm");
      expect(useProgressStore.getState().xp).toBe(80);
      expect(useProgressStore.getState().streak).toBe(2);
      expect(useProgressStore.getState().daily?.date).toBe("2026-08-13");
      expect(useProgressStore.getState().dailyHistory).toEqual(["2026-08-12", "2026-08-13"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records a boss victory with XP, stats, and under-pressure mastery", () => {
    useProgressStore.getState().recordBossResult("stp-storm", true, 5 / 6);

    const state = useProgressStore.getState();
    expect(state.xp).toBe(75);
    expect(state.bossRecords).toEqual({ battles: 1, victories: 1, bestAccuracy: 5 / 6 });
    expect(state.mastery["3.1.c"]).toBe(95);
    // Weak topics are derived from the boosted mastery.
    expect(state.weakTopics).not.toEqual(["VLANs and trunks"]);
  });

  it("records a boss defeat without touching mastery", () => {
    useProgressStore.getState().recordMissionResult("stp-storm", 0);
    useProgressStore.getState().recordBossResult("stp-storm", false, 0.4);

    const state = useProgressStore.getState();
    expect(state.xp).toBe(15);
    expect(state.bossRecords).toEqual({ battles: 1, victories: 0, bestAccuracy: 0.4 });
    expect(state.mastery["3.1.c"]).toBe(85); // unchanged by the defeat
  });

  it("awards tier-based boss XP when passed", () => {
    useProgressStore.getState().recordBossResult("stp-storm", true, 1, 100); // Elite win
    expect(useProgressStore.getState().xp).toBe(100);
    expect(useProgressStore.getState().mastery["3.1.c"]).toBe(95);

    useProgressStore.getState().recordBossResult("stp-storm", false, 0.5, 20); // Elite defeat
    expect(useProgressStore.getState().xp).toBe(120);
    expect(useProgressStore.getState().bossRecords).toEqual({ battles: 2, victories: 1, bestAccuracy: 1 });
  });

  it("ignores boss results for unknown arcs", () => {
    useProgressStore.getState().recordBossResult("not-an-arc", true, 1);
    expect(useProgressStore.getState().xp).toBe(0);
    expect(useProgressStore.getState().bossRecords).toEqual({ battles: 0, victories: 0, bestAccuracy: 0 });
  });

  it("persists daily and boss records", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    try {
      useProgressStore.getState().claimDaily("stp-storm");
      useProgressStore.getState().recordBossResult("stp-storm", true, 1);

      const persisted = JSON.parse(values.get("netquest-progress") ?? "{}") as {
        state: { daily: { date: string }; dailyHistory: string[]; bossRecords: { victories: number } };
      };
      expect(persisted.state.daily.date).toBe("2026-08-12");
      expect(persisted.state.dailyHistory).toEqual(["2026-08-12"]);
      expect(persisted.state.bossRecords.victories).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies a merged cloud snapshot and stamps the sync time", () => {
    useProgressStore.getState().applyRemote({
      xp: 999,
      streak: 3,
      weakTopics: ["STP"],
      completedMissions: ["vlan-that-vanished"],
      mastery: { "3.1.a": 95 },
      quizResults: {},
      cardReviews: {},
      badges: ["cli-apprentice"],
      daily: null,
      dailyHistory: [],
      bossRecords: { battles: 1, victories: 1, bestAccuracy: 1 },
      skills: {},
      examResults: {},
      examSeen: {},
      labResults: {},
      lastSyncedAt: 1234,
    });

    const state = useProgressStore.getState();
    expect(state.xp).toBe(999);
    expect(state.mastery["3.1.a"]).toBe(95);
    expect(state.lastSyncedAt).toBe(1234);
    expect(state.syncStatus).toBe("synced");
  });

  it("is a no-op (same state reference) when the cloud snapshot is identical", () => {
    const before = useProgressStore.getState();
    useProgressStore.getState().applyRemote({
      xp: 0,
      streak: 0,
      weakTopics: ["VLANs and trunks"],
      completedMissions: [],
      mastery: {},
      quizResults: {},
      cardReviews: {},
      badges: [],
      daily: null,
      dailyHistory: [],
      bossRecords: { battles: 0, victories: 0, bestAccuracy: 0 },
      skills: {},
      examResults: {},
      examSeen: {},
      labResults: {},
      lastSyncedAt: before.lastSyncedAt,
    });
    expect(useProgressStore.getState()).toBe(before);
  });

  it("surfaces sync status messages", () => {
    useProgressStore.getState().setSyncStatus("error", "Network down");
    expect(useProgressStore.getState().syncStatus).toBe("error");
    expect(useProgressStore.getState().syncMessage).toBe("Network down");
  });

  it("persists lastSyncedAt", () => {
    useProgressStore.getState().applyRemote({
      xp: 0,
      streak: 0,
      weakTopics: ["VLANs and trunks"],
      completedMissions: [],
      mastery: {},
      quizResults: {},
      cardReviews: {},
      badges: [],
      daily: null,
      dailyHistory: [],
      bossRecords: { battles: 0, victories: 0, bestAccuracy: 0 },
      skills: {},
      examResults: {},
      examSeen: {},
      labResults: {},
      lastSyncedAt: 99,
    });

    const persisted = JSON.parse(values.get("netquest-progress") ?? "{}") as { state: { lastSyncedAt: number } };
    expect(persisted.state.lastSyncedAt).toBe(99);
  });

  it("records a mission result into per-skill mastery", () => {
    useProgressStore.getState().recordMissionResult("area-zero-hero", 0); // 3.2.b configure
    const skills = useProgressStore.getState().skills;
    expect(skills["3.2.b"].scores.configure).toBe(85);
  });

  it("records a quiz result into interpret/recall skills", () => {
    useProgressStore.getState().recordQuizResult("stp-storm", 3, 3, "interpret");
    expect(useProgressStore.getState().skills["3.1.c"].scores.interpret).toBe(70);
  });

  it("records a boss victory into the timed skill", () => {
    useProgressStore.getState().recordBossResult("stp-storm", true, 5 / 6);
    expect(useProgressStore.getState().skills["3.1.c"].scores.timed).toBe(95);
    expect(useProgressStore.getState().skills["3.1.c"].bestTimedPct).toBe(83);
  });

  it("records a lab result with variant evidence", () => {
    useProgressStore.getState().recordLabResult("lab-ospf-adjacency", "a", true, "troubleshoot");
    const skills = useProgressStore.getState().skills;
    expect(skills["3.2.b"].scores.troubleshoot).toBe(85);
    expect(skills["3.2.b"].variants).toEqual(["a"]);
    expect(useProgressStore.getState().labResults["lab-ospf-adjacency"].cleanRuns).toBe(1);
  });

  it("records a passing mock exam and its timed mastery", () => {
    useProgressStore.getState().recordExamResult("mock-a", 80, true, ["3.1.a", "3.2.b"]);
    expect(useProgressStore.getState().examResults["mock-a"].pct).toBe(80);
    expect(useProgressStore.getState().examResults["mock-a"].passed).toBe(true);
    expect(useProgressStore.getState().skills["3.2.b"].scores.timed).toBe(95);
  });

  it("records a failing exam without awarding timed mastery", () => {
    useProgressStore.getState().recordExamResult("mock-b", 40, false, ["3.1.a"]);
    expect(useProgressStore.getState().examResults["mock-b"].passed).toBe(false);
    expect(useProgressStore.getState().skills["3.1.a"].scores.timed).toBe(0);
  });

  it("remembers seen exam questions per kind, deduplicated", () => {
    useProgressStore.getState().recordExamSeen("mock-a", ["q1", "q2"]);
    useProgressStore.getState().recordExamSeen("mock-a", ["q2", "q3"]);
    expect(useProgressStore.getState().examSeen["mock-a"]).toEqual(["q1", "q2", "q3"]);
    expect(useProgressStore.getState().examSeen["mock-b"]).toBeUndefined();
  });
});
