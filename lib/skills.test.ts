import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS } from "./encor-catalog";
import { MASTERY_BANDS } from "./mastery";
import {
  blankObjectiveState,
  hasRecentTimedSuccess,
  INDEPENDENT_CLEAN_RUNS,
  isIndependent,
  isUnderPressure,
  objectiveState,
  primarySkill,
  recordLabSkill,
  recordMissionSkill,
  recordQuizSkill,
  recordTimedSkill,
  skillAverage,
  weakObjectives,
  type SkillMap,
} from "./skills";

const objectives = ENCOR_DOMAINS.flatMap((domain) => domain.objectives);
const byId = (id: string) => objectives.find((objective) => objective.id === id)!;

describe("skill mapping", () => {
  it("maps blueprint interactions to assessment types", () => {
    expect(primarySkill("configure")).toBe("configure");
    expect(primarySkill("troubleshoot")).toBe("troubleshoot");
    expect(primarySkill("inspect")).toBe("interpret");
    expect(primarySkill("predict")).toBe("interpret");
    expect(primarySkill("interpret")).toBe("interpret");
    expect(primarySkill("code")).toBe("configure");
  });

  it("starts every objective at zero on all five skills", () => {
    const state = blankObjectiveState();
    expect(state.scores).toEqual({ recall: 0, interpret: 0, configure: 0, troubleshoot: 0, timed: 0 });
    expect(state.cleanRuns).toBe(0);
    expect(state.variants).toEqual([]);
  });
});

describe("mission and quiz skill recording", () => {
  it("raises the primary skill of every taught objective", () => {
    const taught = [byId("3.1.a"), byId("3.1.b")]; // troubleshoot / troubleshoot
    const skills = recordMissionSkill({}, taught, 0, "variant-a");
    expect(objectiveState(skills, "3.1.a").scores.troubleshoot).toBe(MASTERY_BANDS.independent);
    expect(objectiveState(skills, "3.1.b").scores.troubleshoot).toBe(MASTERY_BANDS.independent);
  });

  it("counts clean runs and variant evidence", () => {
    const taught = [byId("3.1.c")]; // configure
    let skills: SkillMap = {};
    skills = recordMissionSkill(skills, taught, 0, "variant-1");
    skills = recordMissionSkill(skills, taught, 0, "variant-2");
    const state = objectiveState(skills, "3.1.c");
    expect(state.cleanRuns).toBe(INDEPENDENT_CLEAN_RUNS);
    expect(state.variants).toEqual(["variant-1", "variant-2"]);
  });

  it("never lowers a skill score on a rougher rerun", () => {
    const taught = [byId("3.2.b")]; // configure
    let skills = recordMissionSkill({}, taught, 0);
    skills = recordMissionSkill(skills, taught, 7);
    expect(objectiveState(skills, "3.2.b").scores.configure).toBe(MASTERY_BANDS.independent);
  });

  it("separates recall from interpretation for quizzes", () => {
    const taught = [byId("4.1")];
    let skills = recordQuizSkill({}, taught, "recall", 3, 3);
    expect(objectiveState(skills, "4.1").scores.recall).toBe(MASTERY_BANDS.guided);
    expect(objectiveState(skills, "4.1").scores.interpret).toBe(0);
    skills = recordQuizSkill(skills, taught, "interpret", 3, 3);
    expect(objectiveState(skills, "4.1").scores.interpret).toBe(MASTERY_BANDS.guided);
  });
});

describe("Independent gate (repeated no-hint success across variants)", () => {
  it("requires two clean runs across two distinct variants", () => {
    const taught = [byId("3.3.b")]; // configure
    // One clean run, one variant → not Independent.
    let skills = recordMissionSkill({}, taught, 0, "variant-1");
    expect(isIndependent(skills, byId("3.3.b"))).toBe(false);
    // Second clean run on the SAME variant → still not Independent.
    skills = recordMissionSkill(skills, taught, 0, "variant-1");
    expect(isIndependent(skills, byId("3.3.b"))).toBe(false);
    // Second clean run on a NEW variant → Independent.
    skills = recordMissionSkill(skills, taught, 0, "variant-2");
    expect(isIndependent(skills, byId("3.3.b"))).toBe(true);
  });

  it("does not award Independent from a single clean run even at top score", () => {
    const taught = [byId("3.1.a")];
    const skills = recordMissionSkill({}, taught, 0, "variant-1");
    expect(objectiveState(skills, "3.1.a").scores.troubleshoot).toBe(MASTERY_BANDS.independent);
    expect(isIndependent(skills, byId("3.1.a"))).toBe(false); // evidence incomplete
  });

  it("awards Independent through repeated clean lab runs across variants", () => {
    const taught = [byId("2.2.a")]; // configure
    let skills = recordLabSkill({}, taught, "configure", true, "ospf-lab-a");
    skills = recordLabSkill(skills, taught, "configure", true, "ospf-lab-b");
    expect(isIndependent(skills, byId("2.2.a"))).toBe(true);
  });
});

describe("Under Pressure gate (timed mixed-variant assessment)", () => {
  it("awards 95 only on a timed pass at the accuracy threshold", () => {
    const taught = [byId("3.2.c")];
    const passed = recordTimedSkill({}, taught, 5 / 6, true, 1000);
    expect(isUnderPressure(passed, "3.2.c")).toBe(true);
    expect(objectiveState(passed, "3.2.c").scores.timed).toBe(MASTERY_BANDS.underPressure);
    expect(objectiveState(passed, "3.2.c").bestTimedPct).toBe(83);
  });

  it("never awards Under Pressure below the threshold or on a loss", () => {
    const taught = [byId("3.2.c")];
    const lowAccuracy = recordTimedSkill({}, taught, 0.5, true, 1000);
    expect(isUnderPressure(lowAccuracy, "3.2.c")).toBe(false);
    const defeat = recordTimedSkill({}, taught, 1, false, 1000);
    expect(isUnderPressure(defeat, "3.2.c")).toBe(false);
  });

  it("keeps a passed timed result fresh for the readiness window", () => {
    const taught = [byId("3.3.c")];
    const skills = recordTimedSkill({}, taught, 0.9, true, 1000);
    expect(hasRecentTimedSuccess(skills, "3.3.c", 1000 + 29 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(hasRecentTimedSuccess(skills, "3.3.c", 1000 + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("cannot be earned by missions — only timed assessments award it", () => {
    const taught = [byId("3.3.c")];
    let skills = recordMissionSkill({}, taught, 0, "variant-1");
    skills = recordMissionSkill(skills, taught, 0, "variant-2");
    expect(isUnderPressure(skills, "3.3.c")).toBe(false);
  });
});

describe("aggregates", () => {
  it("computes per-skill averages across practiced objectives only", () => {
    const skills = recordMissionSkill({}, [byId("3.1.a"), byId("3.1.b")], 0, "v1");
    expect(skillAverage(skills, "troubleshoot")).toBe(MASTERY_BANDS.independent);
    expect(skillAverage(skills, "recall")).toBe(0);
  });

  it("lists practiced objectives below a threshold, never above it", () => {
    let skills = recordMissionSkill({}, [byId("3.1.a")], 7, "v1"); // 25
    skills = recordMissionSkill(skills, [byId("3.1.b")], 0, "v1"); // 85
    const weak = weakObjectives(skills, objectives, MASTERY_BANDS.guided);
    const weakIds = weak.map((objective) => objective.id);
    expect(weakIds).toContain("3.1.a");
    expect(weakIds).not.toContain("3.1.b");
    // The weakest *practiced* objective sorts first among practiced items.
    const practicedWeak = weakIds.filter((id) => id === "3.1.a" || id === "3.1.b");
    expect(practicedWeak[0]).toBe("3.1.a");
  });
});
