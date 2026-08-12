import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS } from "./encor-catalog";
import {
  bandForAttempts,
  bandLabel,
  getMasterySummary,
  getWeakObjectives,
  MASTERY_BANDS,
  objectiveScore,
  recordBossResult,
  recordMissionResult,
  recordQuizResult,
  recommendNext,
  type MasteryMap,
} from "./mastery";

const ALL_OBJECTIVE_IDS = ENCOR_DOMAINS.flatMap((domain) => domain.objectives.map((objective) => objective.id));

function allIndependent(): MasteryMap {
  const mastery: MasteryMap = {};
  for (const id of ALL_OBJECTIVE_IDS) mastery[id] = MASTERY_BANDS.independent;
  return mastery;
}

describe("mastery engine", () => {
  it("maps wrong attempts to mastery bands", () => {
    expect(bandForAttempts(0)).toBe(85);
    expect(bandForAttempts(1)).toBe(85);
    expect(bandForAttempts(2)).toBe(70);
    expect(bandForAttempts(3)).toBe(70);
    expect(bandForAttempts(4)).toBe(50);
    expect(bandForAttempts(6)).toBe(50);
    expect(bandForAttempts(7)).toBe(25);
  });

  it("labels the PRD mastery bands", () => {
    expect(bandLabel(0)).toBe("Unseen");
    expect(bandLabel(25)).toBe("Introduced");
    expect(bandLabel(50)).toBe("Recognized");
    expect(bandLabel(70)).toBe("Guided");
    expect(bandLabel(85)).toBe("Independent");
    expect(bandLabel(95)).toBe("Under Pressure");
  });

  it("raises every taught objective to the attempts band", () => {
    const next = recordMissionResult({}, ["3.1.a", "3.1.b"], 2);
    expect(next["3.1.a"]).toBe(70);
    expect(next["3.1.b"]).toBe(70);
  });

  it("a boss victory is the only path to the under-pressure band", () => {
    const victory = recordBossResult({}, ["3.1.a", "3.1.b"], true);
    expect(victory["3.1.a"]).toBe(95);
    expect(victory["3.1.b"]).toBe(95);
    // A defeat changes nothing.
    expect(recordBossResult({ "3.1.a": 85 }, ["3.1.a"], false)["3.1.a"]).toBe(85);
    // Victory only ever raises.
    expect(recordBossResult({ "3.1.a": 95 }, ["3.1.a"], true)["3.1.a"]).toBe(95);
  });

  it("keeps the best result when a mission is rerun", () => {
    const cleanRerun = recordMissionResult({ "3.1.a": 25 }, ["3.1.a"], 0);
    expect(cleanRerun["3.1.a"]).toBe(85);
    // A rougher rerun never lowers a score.
    const roughRerun = recordMissionResult({ "3.1.a": 85 }, ["3.1.a"], 7);
    expect(roughRerun["3.1.a"]).toBe(85);
  });

  it("never mutates the input mastery map", () => {
    const before = { "3.1.a": 25 };
    const next = recordMissionResult(before, ["3.1.a"], 0);
    expect(before["3.1.a"]).toBe(25);
    expect(next["3.1.a"]).toBe(85);
  });

  it("reports playable objectives below Guided as weak", () => {
    const mastery: MasteryMap = { "3.1.a": 85, "3.1.c": 70, "3.2.b": 50 };
    const weak = getWeakObjectives(mastery).map((objective) => objective.id);
    expect(weak).toContain("3.2.b");
    expect(weak).not.toContain("3.1.a");
    expect(weak).not.toContain("3.1.c");
  });

  it("recommends an unplayed arc before anything else", () => {
    const rec = recommendNext({});
    expect(rec.kind).toBe("unseen");
    if (rec.kind === "unseen") {
      expect(rec.arcId).toBe("vlan-that-vanished");
      expect(rec.objective.id).toBe("3.1.a");
    }
  });

  it("recommends reviewing the arc holding the weakest objective", () => {
    const mastery = allIndependent();
    mastery["3.3.b"] = 50; // NAT/PAT — taught by Edge Services.
    const rec = recommendNext(mastery);
    expect(rec.kind).toBe("review");
    if (rec.kind === "review") {
      expect(rec.arcId).toBe("edge-services");
      expect(rec.weakObjectives.map((objective) => objective.id)).toContain("3.3.b");
    }
  });

  it("declares the blueprint ready when nothing is weak", () => {
    expect(recommendNext(allIndependent()).kind).toBe("ready");
  });

  it("maps quiz performance to a mild mastery contribution", () => {
    expect(recordQuizResult({}, ["3.1.a"], 5, 5)["3.1.a"]).toBe(70);
    expect(recordQuizResult({}, ["3.1.a"], 3, 5)["3.1.a"]).toBe(50);
    expect(recordQuizResult({}, ["3.1.a"], 1, 5)["3.1.a"]).toBe(25);
    // A quiz never overrides a mission-earned Independent score.
    expect(recordQuizResult({ "3.1.a": 85 }, ["3.1.a"], 5, 5)["3.1.a"]).toBe(85);
  });

  it("summarizes per-domain average mastery", () => {
    const mastery: MasteryMap = {};
    for (const id of ALL_OBJECTIVE_IDS) mastery[id] = 50;
    const summary = getMasterySummary(mastery);
    expect(summary).toHaveLength(6);
    for (const entry of summary) expect(entry.average).toBe(50);
    expect(objectiveScore(mastery, "6.7")).toBe(50);
    expect(objectiveScore(mastery, "missing-id")).toBe(0);
  });
});
