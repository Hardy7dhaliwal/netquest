import { describe, expect, it } from "vitest";
import { iosHelpForMode } from "./ios-help";

describe("iosHelpForMode", () => {
  it("lists user EXEC commands", () => {
    const out = iosHelpForMode("user");
    expect(out).toContain("Exec commands");
    expect(out).toContain("enable");
    expect(out).toContain("ping");
  });

  it("lists privileged EXEC commands", () => {
    const out = iosHelpForMode("privileged");
    expect(out).toContain("Privileged EXEC commands");
    expect(out).toContain("configure terminal");
    expect(out).toContain("show");
  });

  it("lists global configuration commands", () => {
    const out = iosHelpForMode("config");
    expect(out).toContain("interface");
    expect(out).toContain("router");
    expect(out).toContain("ip");
  });

  it("distinguishes interface vs router submodes", () => {
    expect(iosHelpForMode("config-if")).toContain("channel-group");
    expect(iosHelpForMode("interface")).toContain("switchport");
    expect(iosHelpForMode("config-router")).toContain("neighbor");
  });

  it("never reveals a mission answer string", () => {
    for (const mode of ["user", "privileged", "config", "config-if", "config-router", "config-vrf", "config-isakmp", "config-crypto-map", "repl"]) {
      expect(iosHelpForMode(mode)).not.toMatch(/switchport trunk allowed|ebgp-multihop|standby 1 ip|ip nat inside|tunnel destination/);
    }
  });

  it("falls back to user EXEC for unknown modes", () => {
    expect(iosHelpForMode("something-else")).toContain("enable");
  });
});
