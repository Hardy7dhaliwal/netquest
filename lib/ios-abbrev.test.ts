import { describe, expect, it } from "vitest";
import { normalizeIosCommand } from "./ios-abbrev";

describe("normalizeIosCommand", () => {
  it("expands leading mode verbs", () => {
    expect(normalizeIosCommand("en")).toBe("enable");
    expect(normalizeIosCommand("shut")).toBe("shutdown");
  });

  it("expands configure terminal abbreviations", () => {
    expect(normalizeIosCommand("conf t")).toBe("configure terminal");
    expect(normalizeIosCommand("conf term")).toBe("configure terminal");
    expect(normalizeIosCommand("configure t")).toBe("configure terminal");
    expect(normalizeIosCommand("con t")).toBe("configure terminal");
  });

  it("expands show + running-config", () => {
    expect(normalizeIosCommand("sh run")).toBe("show running-config");
    expect(normalizeIosCommand("sh running")).toBe("show running-config");
  });

  it("expands show sub-keywords", () => {
    expect(normalizeIosCommand("sh vlan br")).toBe("show vlan brief");
    expect(normalizeIosCommand("sh ip ospf nei")).toBe("show ip ospf neighbor");
    expect(normalizeIosCommand("sh ip bgp sum")).toBe("show ip bgp summary");
    expect(normalizeIosCommand("sh stand")).toBe("show standby");
    expect(normalizeIosCommand("sh ver")).toBe("show version");
    expect(normalizeIosCommand("sh ip nat stat")).toBe("show ip nat statistics");
    expect(normalizeIosCommand("sh ip nat trans")).toBe("show ip nat translations");
  });

  it("resolves show int by what follows", () => {
    expect(normalizeIosCommand("sh int trunk")).toBe("show interfaces trunk");
    expect(normalizeIosCommand("sh int gi0/1")).toBe("show interface gi0/1");
    expect(normalizeIosCommand("sh int tunnel 0")).toBe("show interface tunnel 0");
  });

  it("expands interface entry", () => {
    expect(normalizeIosCommand("int g0/1")).toBe("interface g0/1");
    expect(normalizeIosCommand("int gi0/1")).toBe("interface gi0/1");
  });

  it("keeps pipes and full commands intact", () => {
    expect(normalizeIosCommand("sh run | include line vty")).toBe(
      "show running-config | include line vty",
    );
    expect(normalizeIosCommand("configure terminal")).toBe("configure terminal");
    expect(normalizeIosCommand("show running-config")).toBe("show running-config");
    expect(normalizeIosCommand("enable")).toBe("enable");
  });

  it("collapses whitespace and lowercases", () => {
    expect(normalizeIosCommand("  Conf   T  ")).toBe("configure terminal");
    expect(normalizeIosCommand("SH RUN")).toBe("show running-config");
  });

  it("leaves unknown and non-IOS input untouched", () => {
    expect(normalizeIosCommand("foo bar")).toBe("foo bar");
    expect(normalizeIosCommand("esxcli network vswitch standard list")).toBe(
      "esxcli network vswitch standard list",
    );
    expect(normalizeIosCommand("")).toBe("");
  });
});
