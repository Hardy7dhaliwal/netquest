import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_CATEGORIES, tokenizeGlossaryText } from "./glossary";

describe("networking glossary", () => {
  it("covers the core terms a beginner needs", () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase());
    for (const required of ["vlan", "trunk", "access port", "ping", "lacp", "ospf"]) {
      expect(terms).toContain(required);
    }
  });

  it("has unique terms with complete, meaningful fields", () => {
    const seen = new Set<string>();
    for (const entry of GLOSSARY) {
      expect(seen.has(entry.term.toLowerCase()), `duplicate term: ${entry.term}`).toBe(false);
      seen.add(entry.term.toLowerCase());
      expect(entry.term.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeGreaterThan(10);
      expect(GLOSSARY_CATEGORIES).toContain(entry.category);
    }
  });

  it("every seeAlso reference resolves to a real term", () => {
    const terms = new Set(GLOSSARY.map((entry) => entry.term.toLowerCase()));
    for (const entry of GLOSSARY) {
      for (const ref of entry.seeAlso ?? []) {
        expect(terms.has(ref.toLowerCase()), `${entry.term} references unknown term "${ref}"`).toBe(true);
      }
    }
  });

  it("covers terms from every mission in the game", () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase());
    for (const missionTerm of ["stp", "bpdu", "etherchannel", "eigrp", "ebgp", "pbr", "routing table", "default gateway"]) {
      expect(terms).toContain(missionTerm);
    }
  });
});

describe("tokenizeGlossaryText", () => {
  it("links known terms and leaves surrounding text untouched", () => {
    expect(tokenizeGlossaryText("The VLAN 20 trunk failed.")).toEqual([
      { type: "text", value: "The " },
      { type: "term", value: "VLAN", term: "VLAN" },
      { type: "text", value: " 20 " },
      { type: "term", value: "trunk", term: "Trunk" },
      { type: "text", value: " failed." },
    ]);
  });

  it("matches plurals and aliases, resolving to the canonical term", () => {
    expect(tokenizeGlossaryText("VLANs and gateways")).toEqual([
      { type: "term", value: "VLANs", term: "VLAN" },
      { type: "text", value: " and " },
      { type: "term", value: "gateways", term: "Default gateway" },
    ]);
    expect(tokenizeGlossaryText("enter config mode")).toContainEqual({ type: "term", value: "config mode", term: "Configuration mode" });
  });

  it("links 'es' plurals like switches and IP addresses", () => {
    expect(tokenizeGlossaryText("both switches and IP addresses")).toEqual([
      { type: "text", value: "both " },
      { type: "term", value: "switches", term: "Switch" },
      { type: "text", value: " and " },
      { type: "term", value: "IP addresses", term: "IP address" },
    ]);
  });

  it("prefers the longest term (OSPF adjacency over OSPF)", () => {
    const terms = tokenizeGlossaryText("the OSPF adjacency forms").filter((token) => token.type === "term");
    expect(terms).toEqual([{ type: "term", value: "OSPF adjacency", term: "OSPF adjacency" }]);
  });

  it("does not link inside backtick code spans", () => {
    expect(tokenizeGlossaryText("type `switchport trunk allowed vlan add 20` now")).toEqual([
      { type: "text", value: "type " },
      { type: "code", value: "switchport trunk allowed vlan add 20" },
      { type: "text", value: " now" },
    ]);
  });

  it("does not link terms that are substrings of other words", () => {
    expect(tokenizeGlossaryText("switchport trunking is not switching").filter((token) => token.type === "term")).toEqual([]);
  });
});
