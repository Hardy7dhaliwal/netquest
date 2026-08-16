import { describe, expect, it } from "vitest";
import { iosTabComplete } from "./ios-console";

const COMMANDS = [
  "enable",
  "configure terminal",
  "interface gi0/5",
  "show ip ospf neighbor",
  "show ip bgp summary",
  "show version",
];

describe("iosTabComplete", () => {
  it("completes the first keyword from the command list", () => {
    expect(iosTabComplete("sh", COMMANDS)).toBe("show ");
    expect(iosTabComplete("en", COMMANDS)).toBe("enable");
    expect(iosTabComplete("conf", COMMANDS)).toBe("configure ");
    expect(iosTabComplete("int", COMMANDS)).toBe("interface ");
  });

  it("only leaves a trailing space when the word is followed by more keywords", () => {
    expect(iosTabComplete("show", COMMANDS)).toBe("show ");
    expect(iosTabComplete("show ip", COMMANDS)).toBe("show ip ");
    expect(iosTabComplete("enable", COMMANDS)).toBe("enable");
    expect(iosTabComplete("show version", COMMANDS)).toBe("show version");
  });

  it("completes later keywords position-aware", () => {
    expect(iosTabComplete("show ip o", COMMANDS)).toBe("show ip ospf ");
    expect(iosTabComplete("show ip b", COMMANDS)).toBe("show ip bgp ");
    expect(iosTabComplete("show ip ospf ne", COMMANDS)).toBe("show ip ospf neighbor");
    expect(iosTabComplete("show ver", COMMANDS)).toBe("show version");
    expect(iosTabComplete("interface g", COMMANDS)).toBe("interface gi0/5");
  });

  it("extends ambiguous prefixes to the longest shared prefix", () => {
    const pair = ["show interface gi0/1", "show interface gi0/2"];
    expect(iosTabComplete("show interface gi0", pair)).toBe("show interface gi0/");
  });

  it("leaves unmatched input untouched", () => {
    expect(iosTabComplete("show e", COMMANDS)).toBe("show e");
    expect(iosTabComplete("show ip o bad", COMMANDS)).toBe("show ip o bad");
    expect(iosTabComplete("zzz", COMMANDS)).toBe("zzz");
    expect(iosTabComplete("show qqq", COMMANDS)).toBe("show qqq");
  });

  it("handles do <exec> by shifting positions", () => {
    expect(iosTabComplete("do sh ip b", COMMANDS)).toBe("do sh ip bgp ");
    expect(iosTabComplete("do show ip o", COMMANDS)).toBe("do show ip ospf ");
  });

  it("falls back to the IOS keyword vocabulary without a command list", () => {
    expect(iosTabComplete("sp", [])).toBe("spanning-tree");
    expect(iosTabComplete("sh", [])).toBe("show");
    expect(iosTabComplete("en", [])).toBe("enable");
    expect(iosTabComplete("conf", [])).toBe("configure");
    expect(iosTabComplete("wr", [])).toBe("write memory");
    expect(iosTabComplete("show int", [])).toBe("show interface");
  });

  it("leaves empty input untouched", () => {
    expect(iosTabComplete("", COMMANDS)).toBe("");
    expect(iosTabComplete("   ", COMMANDS)).toBe("   ");
  });

  it("matches case-insensitively but keeps the user's casing for the prefix", () => {
    expect(iosTabComplete("SH IP OSPF NE", COMMANDS)).toBe("SH IP OSPF neighbor");
    expect(iosTabComplete("Show Ip B", COMMANDS)).toBe("Show Ip bgp ");
  });
});