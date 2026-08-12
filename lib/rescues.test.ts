import { describe, expect, it } from "vitest";
import { ARC_TO_MISSION } from "./quiz";
import { EC_PHASES } from "./etherchannel-mission";
import { EDGE_PHASES } from "./edge-mission";
import { CAMPUS_PHASES } from "./campus-fabric-mission";
import { LOCK_PHASES } from "./lock-control-plane-mission";
import { AUTOMATOR_PHASES } from "./automator-prime-mission";
import { EDGE_SERVICES_PHASES } from "./edge-services-mission";
import { FABRIC_PHASES } from "./fabric-express-mission";
import { SDWAN_PHASES } from "./sdwan-mission";
import { SIGNAL_PHASES } from "./signal-detective-mission";
import { TUNNEL_VISION_PHASES } from "./tunnel-vision-mission";
import { GATEWAY_PHASES } from "./gateway-mission";
import { OSPF_PHASES } from "./ospf-mission";
import { RESCUES, rescueFor } from "./rescues";
import { STP_PHASES } from "./stp-mission";

const MISSIONS = ["vlan", "stp", "ec", "ospf", "edge", "gateway", "edge-services", "tunnel-vision", "fabric-express", "sdwan", "signal-detective", "campus-fabric", "lock-the-control-plane", "automator-prime"] as const;

/** Authoritative phase lists mirror the field-mission libs. */
const MISSION_PHASES: Record<string, string[]> = {
  vlan: [],
  stp: [...STP_PHASES],
  ec: [...EC_PHASES],
  ospf: [...OSPF_PHASES],
  edge: [...EDGE_PHASES],
  gateway: [...GATEWAY_PHASES],
  "edge-services": [...EDGE_SERVICES_PHASES],
  "tunnel-vision": [...TUNNEL_VISION_PHASES],
  "fabric-express": [...FABRIC_PHASES],
  "sdwan": [...SDWAN_PHASES],
  "signal-detective": [...SIGNAL_PHASES],
  "campus-fabric": [...CAMPUS_PHASES],
  "lock-the-control-plane": [...LOCK_PHASES],
  "automator-prime": [...AUTOMATOR_PHASES],
};

describe("rescue catalog", () => {
  it("has unique ids and only references known missions", () => {
    const ids = RESCUES.map((rescue) => rescue.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rescue of RESCUES) {
      expect(MISSIONS).toContain(rescue.mission);
      expect(rescue.title.length).toBeGreaterThan(0);
      expect(rescue.teaches.length).toBeGreaterThan(0);
      expect(rescue.tip.length).toBeGreaterThan(0);
      expect(rescue.steps.length).toBeGreaterThan(0);
    }
  });

  it("covers every phase of every field mission", () => {
    for (const mission of MISSIONS) {
      for (const phase of MISSION_PHASES[mission]) {
        expect(rescueFor(mission, phase), `${mission} phase "${phase}" has no rescue`).not.toBeNull();
      }
      // Missions without phases still need a rescue.
      if (MISSION_PHASES[mission].length === 0) {
        expect(rescueFor(mission), `${mission} has no rescue`).not.toBeNull();
      }
    }
  });

  it("gives each mission a default rescue as the fallback", () => {
    for (const mission of MISSIONS) {
      expect(RESCUES.some((rescue) => rescue.mission === mission && rescue.isDefault), `${mission} lacks a default rescue`).toBe(true);
    }
  });

  it("every catalog arc maps to a rescue mission (in-mission stuck button wiring)", () => {
    // The dashboard's rescue button looks up by ARC_TO_MISSION arc → mission,
    // so every mapped value must be a real mission with a default rescue.
    for (const [arcId, mission] of Object.entries(ARC_TO_MISSION)) {
      expect(MISSIONS, `${arcId} → "${mission}" is not a known rescue mission`).toContain(mission);
      expect(RESCUES.some((rescue) => rescue.mission === mission && rescue.isDefault), `${arcId} (${mission}) lacks a default rescue`).toBe(true);
    }
    // Every playable arc is wired: the map covers all 14 catalog arcs.
    expect(Object.keys(ARC_TO_MISSION)).toHaveLength(14);
  });

  it("prefers an exact phase match over the default rescue", () => {
    // "mst_concept" maps to rescue-stp-mst, not the default rescue-stp-guards.
    expect(rescueFor("stp", "mst_concept")?.id).toBe("rescue-stp-mst");
    expect(rescueFor("stp", "bpdu_guard")?.id).toBe("rescue-stp-guards");
  });

  it("every phase listed on a rescue really belongs to its mission", () => {
    for (const rescue of RESCUES) {
      for (const phase of rescue.phases) {
        expect(MISSION_PHASES[rescue.mission], `${rescue.id} lists unknown phase "${phase}"`).toContain(phase);
      }
    }
  });

  it("checkpoint steps have a correct answer among unique options", () => {
    for (const rescue of RESCUES) {
      for (const step of rescue.steps) {
        if (step.kind !== "checkpoint") continue;
        const values = step.options.map((option) => option.value);
        expect(new Set(values).size, `${rescue.id} has duplicate option values`).toBe(values.length);
        expect(values, `${rescue.id}: correct answer "${step.correct}" is not an option`).toContain(step.correct);
        expect(step.explain.length).toBeGreaterThan(0);
        expect(step.wrongGuidance.length).toBeGreaterThan(0);
      }
    }
  });

  it("CLI steps carry a real prompt and a non-empty command", () => {
    for (const rescue of RESCUES) {
      for (const step of rescue.steps) {
        if (step.kind !== "cli") continue;
        expect(step.command.length).toBeGreaterThan(0);
        expect(step.device.length).toBeGreaterThan(0);
        expect(step.prompt).toMatch(/[#>]$/);
        expect(step.expectedOutput.length).toBeGreaterThan(0);
        expect(step.wrongHint.length).toBeGreaterThan(0);
      }
    }
  });
});
