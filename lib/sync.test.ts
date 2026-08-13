import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS } from "./encor-catalog";
import { INITIAL_PROGRESS } from "./progress-store";
import {
  buildSnapshot,
  mergeProgress,
  syncWithTransport,
  type ProgressSnapshot,
  type SyncTransport,
} from "./sync";

function snap(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    xp: 0,
    streak: 0,
    weakTopics: [],
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
    labResults: {},
    lastSyncedAt: null,
    updatedAt: 0,
    ...overrides,
  };
}

describe("sync snapshots", () => {
  it("builds a snapshot of the persistable progress with a timestamp", () => {
    const snapshot = buildSnapshot(INITIAL_PROGRESS, 1234);
    expect(snapshot.updatedAt).toBe(1234);
    expect(snapshot.xp).toBe(0);
    // Transient UI fields never travel.
    expect("syncStatus" in snapshot).toBe(false);
    expect("syncMessage" in snapshot).toBe(false);
  });
});

describe("mergeProgress", () => {
  it("keeps the best of both sides for monotonic fields", () => {
    const merged = mergeProgress(snap({ xp: 50, streak: 2, updatedAt: 100 }), snap({ xp: 120, streak: 5, updatedAt: 200 }));
    expect(merged.xp).toBe(120);
    expect(merged.streak).toBe(5);
    expect(merged.updatedAt).toBe(200);
    expect(merged.lastSyncedAt).toBeNull();
  });

  it("merges mastery per objective with the max score", () => {
    const merged = mergeProgress(snap({ mastery: { "3.1.a": 85, "3.2.b": 50 } }), snap({ mastery: { "3.1.a": 70, "3.3.b": 95 } }));
    expect(merged.mastery).toEqual({ "3.1.a": 85, "3.2.b": 50, "3.3.b": 95 });
  });

  it("unions completed missions and badges without duplicates", () => {
    const merged = mergeProgress(
      snap({ completedMissions: ["vlan-that-vanished", "stp-storm"], badges: ["cli-apprentice"] }),
      snap({ completedMissions: ["stp-storm", "area-zero-hero"], badges: ["cli-apprentice", "vlan-initiate"] }),
    );
    expect(merged.completedMissions).toEqual(["vlan-that-vanished", "stp-storm", "area-zero-hero"]);
    expect(merged.badges).toEqual(["cli-apprentice", "vlan-initiate"]);
  });

  it("keeps the stronger quiz result per arc", () => {
    const merged = mergeProgress(
      snap({ quizResults: { "stp-storm": { correct: 3, total: 3, perfect: true } } }),
      snap({ quizResults: { "stp-storm": { correct: 2, total: 3, perfect: false }, "area-zero-hero": { correct: 1, total: 3, perfect: false } } }),
    );
    expect(merged.quizResults["stp-storm"]).toEqual({ correct: 3, total: 3, perfect: true });
    expect(merged.quizResults["area-zero-hero"]).toEqual({ correct: 1, total: 3, perfect: false });
  });

  it("keeps the freshest flashcard schedule per card", () => {
    const merged = mergeProgress(
      snap({ cardReviews: { c1: { due: 100, interval: 5, ease: 2.5 } } }),
      snap({ cardReviews: { c1: { due: 300, interval: 9, ease: 2.5 } } }),
    );
    expect(merged.cardReviews["c1"].due).toBe(300);
    expect(merged.cardReviews["c1"].interval).toBe(9);
  });

  it("merges the daily claim by date, OR-ing completion on the same day", () => {
    const merged = mergeProgress(
      snap({ daily: { date: "2026-08-12", arcId: "stp-storm", done: true } }),
      snap({ daily: { date: "2026-08-12", arcId: "stp-storm", done: false } }),
    );
    expect(merged.daily).toEqual({ date: "2026-08-12", arcId: "stp-storm", done: true });
    // A newer day wins outright.
    const newer = mergeProgress(
      snap({ daily: { date: "2026-08-12", arcId: "stp-storm", done: true } }),
      snap({ daily: { date: "2026-08-13", arcId: "edge-services", done: true } }),
    );
    expect(newer.daily?.date).toBe("2026-08-13");
  });

  it("unions the daily-challenge streak history", () => {
    const merged = mergeProgress(
      snap({ dailyHistory: ["2026-08-10", "2026-08-11"] }),
      snap({ dailyHistory: ["2026-08-11", "2026-08-12"] }),
    );
    expect(merged.dailyHistory).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("merges boss records with the best of each stat", () => {
    const merged = mergeProgress(
      snap({ bossRecords: { battles: 3, victories: 1, bestAccuracy: 0.6 } }),
      snap({ bossRecords: { battles: 2, victories: 2, bestAccuracy: 0.9 } }),
    );
    expect(merged.bossRecords).toEqual({ battles: 3, victories: 2, bestAccuracy: 0.9 });
  });

  it("re-derives weak topics from the merged mastery", () => {
    const label = (id: string) => ENCOR_DOMAINS.flatMap((d) => d.objectives).find((o) => o.id === id)!.label;
    const strong: Record<string, number> = {};
    for (const domain of ENCOR_DOMAINS) {
      for (const objective of domain.objectives) strong[objective.id] = 85;
    }
    strong["3.2.b"] = 50; // the only weak objective
    const merged = mergeProgress(snap({ mastery: strong }), snap({ mastery: {} }));
    expect(merged.weakTopics).toContain(label("3.2.b"));
    expect(merged.weakTopics).not.toContain(label("3.1.a"));
  });

  it("merges per-skill scores with the max and unions variant evidence", () => {
    const merged = mergeProgress(
      snap({ skills: { "3.1.a": { scores: { recall: 50, interpret: 0, configure: 0, troubleshoot: 0, timed: 0 }, cleanRuns: 1, variants: ["v1"], bestTimedPct: 0, lastTimedAt: null } } }),
      snap({ skills: { "3.1.a": { scores: { recall: 70, interpret: 0, configure: 0, troubleshoot: 0, timed: 0 }, cleanRuns: 1, variants: ["v2"], bestTimedPct: 0, lastTimedAt: null } } }),
    );
    const state = merged.skills["3.1.a"];
    expect(state.scores.recall).toBe(70);
    expect(state.variants).toEqual(["v1", "v2"]);
    expect(state.cleanRuns).toBe(1);
  });

  it("merges exam results keeping the best score per kind", () => {
    const merged = mergeProgress(
      snap({ examResults: { "mock-a": { pct: 60, passed: false, at: 1 } } }),
      snap({ examResults: { "mock-a": { pct: 80, passed: true, at: 2 }, "mock-b": { pct: 40, passed: false, at: 3 } } }),
    );
    expect(merged.examResults["mock-a"].pct).toBe(80);
    expect(merged.examResults["mock-b"].pct).toBe(40);
  });

  it("merges lab results unioning variant ids", () => {
    const merged = mergeProgress(
      snap({ labResults: { "lab-ospf-adjacency": { variantIds: ["a"], cleanRuns: 1, lastRunAt: 1 } } }),
      snap({ labResults: { "lab-ospf-adjacency": { variantIds: ["b"], cleanRuns: 1, lastRunAt: 2 } } }),
    );
    expect(merged.labResults["lab-ospf-adjacency"].variantIds).toEqual(["a", "b"]);
    expect(merged.labResults["lab-ospf-adjacency"].lastRunAt).toBe(2);
  });

  it("is idempotent once converged", () => {
    const a = snap({ xp: 90, mastery: { "3.1.a": 85 }, badges: ["x"], updatedAt: 5 });
    const b = snap({ xp: 120, mastery: { "3.1.a": 70 }, badges: ["y"], updatedAt: 9 });
    const converged = mergeProgress(a, b);
    expect(mergeProgress(converged, converged)).toEqual(converged);
  });
});

describe("syncWithTransport", () => {
  it("fetches, merges, and pushes the converged blob", async () => {
    const remote = snap({ xp: 100, mastery: { "3.1.a": 70 }, updatedAt: 50 });
    const pushes: ProgressSnapshot[] = [];
    const transport: SyncTransport = {
      fetchRemote: async () => remote,
      pushRemote: async (snapshot) => {
        pushes.push(snapshot);
      },
    };
    const local = snap({ xp: 60, mastery: { "3.1.a": 85 }, updatedAt: 10 });
    const merged = await syncWithTransport(local, transport);

    expect(pushes).toHaveLength(1);
    expect(merged.xp).toBe(100);
    expect(merged.mastery["3.1.a"]).toBe(85);
    expect(pushes[0]).toEqual(merged);
  });

  it("treats a missing remote as a first-time sync", async () => {
    const pushes: ProgressSnapshot[] = [];
    const transport: SyncTransport = {
      fetchRemote: async () => null,
      pushRemote: async (snapshot) => {
        pushes.push(snapshot);
      },
    };
    const local = snap({ xp: 40, updatedAt: 7 });
    const merged = await syncWithTransport(local, transport);
    expect(merged).toEqual(local);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toEqual(local);
  });

  it("never lets a stale device overwrite newer cloud data", async () => {
    const cloud: { current: ProgressSnapshot | null } = { current: snap({ xp: 120, updatedAt: 50 }) };
    const staleLocal = snap({ xp: 50, updatedAt: 10 });
    const merged = await syncWithTransport(staleLocal, {
      fetchRemote: async () => cloud.current,
      pushRemote: async (snapshot) => {
        cloud.current = snapshot;
      },
    });
    expect(merged.xp).toBe(120); // the newer cloud value survives
    expect(cloud.current?.xp).toBe(120);
    expect(cloud.current?.updatedAt).toBe(50);
  });

  it("converges to stable values across alternating devices", async () => {
    const cloud: { current: ProgressSnapshot | null } = { current: null };
    const deviceA = snap({ xp: 50, mastery: { "3.1.a": 85, "3.2.b": 50 }, updatedAt: 10 });
    const deviceB = snap({ xp: 120, mastery: { "3.2.b": 70 }, updatedAt: 20 });
    const sync = (local: ProgressSnapshot) =>
      syncWithTransport(local, {
        fetchRemote: async () => cloud.current,
        pushRemote: async (snapshot) => {
          cloud.current = snapshot;
        },
      });

    await sync(deviceA);
    await sync(deviceB);
    expect(cloud.current?.xp).toBe(120);
    expect(cloud.current?.mastery["3.1.a"]).toBe(85);
    expect(cloud.current?.mastery["3.2.b"]).toBe(70);

    // A stale device syncing again no longer churns the converged values.
    await sync(deviceA);
    expect(cloud.current?.xp).toBe(120);
    expect(cloud.current?.mastery["3.1.a"]).toBe(85);
    expect(cloud.current?.mastery["3.2.b"]).toBe(70);
  });
});
