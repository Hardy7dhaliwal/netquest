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
});
