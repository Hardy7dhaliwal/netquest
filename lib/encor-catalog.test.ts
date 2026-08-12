import { describe, expect, it } from "vitest";
import { ENCOR_DOMAINS, ENCOR_MISSION_ARCS, ENCOR_OBJECTIVE_COUNT, getCoverageByDomain, getWeightedCoverage } from "./encor-catalog";

describe("ENCOR v1.2 catalog", () => {
  it("covers the six Cisco blueprint domains with exact weights", () => {
    expect(ENCOR_DOMAINS.map(({ id, weight }) => [id, weight])).toEqual([
      ["architecture", 15],
      ["virtualization", 10],
      ["infrastructure", 30],
      ["assurance", 10],
      ["security", 20],
      ["automation", 15],
    ]);
    expect(ENCOR_DOMAINS.reduce((sum, domain) => sum + domain.weight, 0)).toBe(100);
  });

  it("keeps every objective uniquely addressable", () => {
    const ids = ENCOR_DOMAINS.flatMap((domain) => domain.objectives.map((objective) => objective.id));
    expect(ids).toHaveLength(ENCOR_OBJECTIVE_COUNT);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ENCOR_OBJECTIVE_COUNT).toBeGreaterThanOrEqual(40);
  });

  it("maps the mission arcs to the blueprint", () => {
    expect(ENCOR_MISSION_ARCS).toHaveLength(14);
    expect(ENCOR_MISSION_ARCS[0].status).toBe("complete");
    expect(ENCOR_MISSION_ARCS[1].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[1].objectiveIds).toEqual(["3.1.c"]);
    expect(ENCOR_MISSION_ARCS[2].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[2].objectiveIds).toEqual(["3.1.b"]);
    expect(ENCOR_MISSION_ARCS[3].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[3].objectiveIds).toEqual(["3.2.b"]);
    expect(ENCOR_MISSION_ARCS[4].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[4].objectiveIds).toEqual(["3.2.a", "3.2.c", "3.2.d"]);
    expect(ENCOR_MISSION_ARCS[5].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[5].objectiveIds).toEqual(["1.1.a", "1.1.b", "3.3.c"]);
    expect(ENCOR_MISSION_ARCS[6].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[6].objectiveIds).toEqual(["1.4", "3.3.a", "3.3.b", "3.3.d"]);
    expect(ENCOR_MISSION_ARCS[7].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[7].objectiveIds).toEqual(["2.2.a", "2.2.b"]);
    expect(ENCOR_MISSION_ARCS[8].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[8].objectiveIds).toEqual(["2.1.a", "2.1.b", "2.1.c", "2.3.b"]);
    expect(ENCOR_MISSION_ARCS[9].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[9].objectiveIds).toEqual(["1.3.a", "1.3.b", "2.3.a"]);
    expect(ENCOR_MISSION_ARCS[10].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[10].objectiveIds).toEqual(["1.2.a", "1.2.b"]);
    expect(ENCOR_MISSION_ARCS[11].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[11].objectiveIds).toEqual(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"]);
    expect(ENCOR_MISSION_ARCS[12].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[12].objectiveIds).toEqual(["5.1.a", "5.1.b", "5.2.a", "5.2.b", "5.3", "5.4.a", "5.4.b", "5.4.c", "5.4.d"]);
    expect(ENCOR_MISSION_ARCS[13].status).toBe("available");
    expect(ENCOR_MISSION_ARCS[13].objectiveIds).toEqual(["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"]);
    const catalogIds = new Set(ENCOR_DOMAINS.flatMap((domain) => domain.objectives.map((objective) => objective.id)));
    const mappedIds = new Set(ENCOR_MISSION_ARCS.flatMap((arc) => arc.objectiveIds));
    expect(mappedIds).toEqual(catalogIds);
    expect(ENCOR_MISSION_ARCS.flatMap((arc) => arc.objectiveIds)).toContain("6.7");
  });

  it("computes per-domain coverage from playable arcs only", () => {
    const coverage = getCoverageByDomain();
    expect(coverage).toHaveLength(6);

    // Infrastructure is now fully covered — all 11 objectives have a mission.
    const infrastructure = coverage.find((entry) => entry.domain.id === "infrastructure");
    expect(infrastructure?.coveredObjectives.map((objective) => objective.id)).toEqual(["3.1.a", "3.1.b", "3.1.c", "3.2.a", "3.2.b", "3.2.c", "3.2.d", "3.3.a", "3.3.b", "3.3.c", "3.3.d"]);

    // SD-WAN (1.2.a/b) and The Campus Fabric (1.3.a/b) take Architecture to 7/7.
    const architecture = coverage.find((entry) => entry.domain.id === "architecture");
    expect(architecture?.coveredObjectives.map((objective) => objective.id)).toEqual(["1.1.a", "1.1.b", "1.2.a", "1.2.b", "1.3.a", "1.3.b", "1.4"]);

    // Tunnel Vision, The Fabric Express, and The Campus Fabric (LISP 2.3.a)
    // bring Virtualization to 7/7 — fully covered.
    const virtualization = coverage.find((entry) => entry.domain.id === "virtualization");
    expect(virtualization?.coveredObjectives.map((objective) => objective.id)).toEqual(["2.1.a", "2.1.b", "2.1.c", "2.2.a", "2.2.b", "2.3.a", "2.3.b"]);

    // The Signal Detective fully covers Network Assurance — all 6 objectives.
    const assurance = coverage.find((entry) => entry.domain.id === "assurance");
    expect(assurance?.coveredObjectives.map((objective) => objective.id)).toEqual(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"]);

    // Lock the Control Plane covers all 9 Security objectives.
    const security = coverage.find((entry) => entry.domain.id === "security");
    expect(security?.coveredObjectives.map((objective) => objective.id)).toEqual(["5.1.a", "5.1.b", "5.2.a", "5.2.b", "5.3", "5.4.a", "5.4.b", "5.4.c", "5.4.d"]);

    // Automator Prime covers all 7 Automation objectives — the full blueprint.
    const automation = coverage.find((entry) => entry.domain.id === "automation");
    expect(automation?.coveredObjectives.map((objective) => objective.id)).toEqual(["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"]);

    // Every domain now has playable coverage — the catalog is complete.
    for (const entry of coverage) {
      expect(entry.coveredObjectives.length).toBeGreaterThan(0);
    }

    const totalCovered = coverage.reduce((sum, entry) => sum + entry.coveredObjectives.length, 0);
    expect(totalCovered).toBe(ENCOR_OBJECTIVE_COUNT);
  });

  it("weights coverage by domain share of the exam", () => {
    // All six domains are fully covered: Architecture 15% + Infrastructure 30% +
    // Virtualization 10% + Assurance 10% + Security 20% + Automation 15% = 100%.
    expect(getWeightedCoverage()).toBeCloseTo(15 * (7 / 7) + 30 * (11 / 11) + 10 * (7 / 7) + 10 * (6 / 6) + 20 * (9 / 9) + 15 * (7 / 7), 1);
  });
});
