import { describe, expect, it } from "vitest";
import { MISSION_MAPS } from "./mission-maps";

// Missions that require typing exact values (IPs, subnets, peers) and so must
// expose a network map so the player never has to guess an address.
const REQUIRED_MAP_IDS = [
  "area-zero-hero",
  "tunnel-vision",
  "signal-detective",
  "lock-the-control-plane",
  "gateway-at-dawn",
  "edge-services",
  "edge-has-opinions",
];

describe("mission network maps", () => {
  it("covers every mission that requires typing exact values", () => {
    for (const id of REQUIRED_MAP_IDS) {
      expect(MISSION_MAPS[id], `missing network map for mission ${id}`).toBeDefined();
    }
  });

  it("has at least two devices and one link per map", () => {
    for (const [id, map] of Object.entries(MISSION_MAPS)) {
      expect(map.devices.length, `${id}: at least 2 devices`).toBeGreaterThanOrEqual(2);
      expect(map.links.length, `${id}: at least 1 link`).toBeGreaterThanOrEqual(1);
    }
  });

  it("every link references existing devices with no duplicate ids", () => {
    for (const [id, map] of Object.entries(MISSION_MAPS)) {
      const ids = new Set(map.devices.map((device) => device.id));
      expect(ids.size, `${id}: duplicate device ids`).toBe(map.devices.length);
      for (const link of map.links) {
        expect(ids.has(link.from), `${id}: link ${link.from}->${link.to} has unknown source`).toBe(true);
        expect(ids.has(link.to), `${id}: link ${link.from}->${link.to} has unknown target`).toBe(true);
      }
    }
  });

  it("every device shows an address or role on the map", () => {
    for (const [id, map] of Object.entries(MISSION_MAPS)) {
      for (const device of map.devices) {
        expect(device.label.trim().length, `${id}: ${device.id} needs a label`).toBeGreaterThan(0);
        expect(device.detail.trim().length, `${id}: ${device.id} needs an address detail`).toBeGreaterThan(0);
      }
    }
  });

  it("device coordinates stay inside the 0–100 map space", () => {
    for (const [id, map] of Object.entries(MISSION_MAPS)) {
      for (const device of map.devices) {
        expect(device.x, `${id}: ${device.id} x out of range`).toBeGreaterThanOrEqual(0);
        expect(device.x, `${id}: ${device.id} x out of range`).toBeLessThanOrEqual(100);
        expect(device.y, `${id}: ${device.id} y out of range`).toBeGreaterThanOrEqual(0);
        expect(device.y, `${id}: ${device.id} y out of range`).toBeLessThanOrEqual(100);
      }
    }
  });
});
