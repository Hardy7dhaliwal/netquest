import { describe, expect, it } from "vitest";
import { GLOSSARY } from "./glossary";
import { MISSION_PRIMERS } from "./mission-primers";

// Mirrors the 17 entries of MISSION_CATALOG in app/page.tsx, so a mission
// added to the catalog without a primer (or a primer without a mission) is
// caught by the coverage assertions below.
const CATALOG_IDS = [
  "console-basics",
  "show-and-ping",
  "packet-trail",
  "vlan-that-vanished",
  "stp-storm",
  "bundled-bottleneck",
  "area-zero-hero",
  "edge-has-opinions",
  "gateway-at-dawn",
  "edge-services",
  "tunnel-vision",
  "fabric-express",
  "sdwan-overlay",
  "signal-detective",
  "campus-fabric",
  "lock-the-control-plane",
  "automator-prime",
];

// Same canonicalization as the inline glossary links: term or alias,
// case-insensitive, so a primer chip always opens a real glossary entry.
const RESOLVABLE = new Map<string, string>();
for (const entry of GLOSSARY) {
  RESOLVABLE.set(entry.term.toLowerCase(), entry.term);
  for (const alias of entry.aliases ?? []) RESOLVABLE.set(alias.toLowerCase(), entry.term);
}

describe("mission primers", () => {
  it("covers every mission in the catalog", () => {
    for (const id of CATALOG_IDS) {
      expect(MISSION_PRIMERS[id], `missing primer for mission ${id}`).toBeDefined();
    }
    for (const id of Object.keys(MISSION_PRIMERS)) {
      expect(CATALOG_IDS, `primer ${id} has no catalog mission`).toContain(id);
    }
  });

  it("writes a plain-language explanation with at least one glossary chip", () => {
    for (const [id, primer] of Object.entries(MISSION_PRIMERS)) {
      expect(primer.what.trim().length, `${id}: what must be non-empty`).toBeGreaterThan(40);
      expect(primer.terms.length, `${id}: at least one glossary term`).toBeGreaterThanOrEqual(1);
      expect(primer.terms.length, `${id}: no duplicate chips`).toBe(new Set(primer.terms).size);
    }
  });

  it("resolves every primer chip to a real glossary entry", () => {
    for (const [id, primer] of Object.entries(MISSION_PRIMERS)) {
      for (const term of primer.terms) {
        expect(RESOLVABLE.get(term.toLowerCase()), `${id}: chip "${term}" is not in the glossary`).toBeDefined();
      }
    }
  });
});
