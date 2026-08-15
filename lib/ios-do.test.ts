import { describe, expect, it } from "vitest";
import { tryRunDo } from "./ios-do";
import { iosHelpForMode } from "./ios-help";
import { INITIAL_MISSION, runCommand, type MissionState } from "./mission";
import { INITIAL_EDGE_MISSION, runEdgeCommand, type EdgeMissionState } from "./edge-mission";
import { INITIAL_AUTOMATOR_PRIME_MISSION, runAutomatorCommand, type AutomatorPrimeMissionState } from "./automator-prime-mission";
import { INITIAL_LOCK_CONTROL_PLANE_MISSION, runLockCommand, type LockControlPlaneMissionState } from "./lock-control-plane-mission";

describe("do <exec> from configuration mode", () => {
  it("runs a show command mid-config and stays in the config submode", () => {
    const state: MissionState = { ...INITIAL_MISSION, status: "in_progress", cliMode: "interface" };
    const result = runCommand(state, "do show interfaces trunk");

    expect(result.cliMode).toBe("interface");
    expect(result.inspectedTrunk).toBe(true);
    expect(result.cliHistory).toHaveLength(1);
    expect(result.cliHistory[0].prompt).toBe("SW1(config-if)#");
    expect(result.cliHistory[0].input).toBe("do show interfaces trunk");
    expect(result.cliHistory[0].output).toContain("Vlans allowed on trunk");
  });

  it("keeps the config-router prompt and can still verify from a submode", () => {
    const state: EdgeMissionState = {
      ...INITIAL_EDGE_MISSION,
      status: "in_progress",
      phase: "bgp-fix",
      cliMode: "config-router",
      bgpConfigured: true,
    };
    const result = runEdgeCommand(state, "do show ip bgp summary");

    expect(result.bgpVerified).toBe(true);
    expect(result.cliMode).toBe("config-router");
    expect(result.cliHistory[0].prompt).toBe("R-EDGE(config-router)#");
    expect(result.cliHistory[0].input).toBe("do show ip bgp summary");
    expect(result.cliHistory[0].output).toContain("00:02:11");
  });

  it("does not intercept `do` in EXEC modes — it falls through to normal matching", () => {
    const state: EdgeMissionState = {
      ...INITIAL_EDGE_MISSION,
      status: "in_progress",
      phase: "bgp-fix",
      cliMode: "privileged",
    };
    const result = runEdgeCommand(state, "do show ip bgp summary");

    expect(result.cliMode).toBe("privileged");
    expect(result.cliHistory[0].output).toBe("% Invalid input detected at '^' marker.");
  });

  it("does not intercept `do` in the Python/JSON repl", () => {
    const state: AutomatorPrimeMissionState = {
      ...INITIAL_AUTOMATOR_PRIME_MISSION,
      status: "in_progress",
      phase: "python",
      cliMode: "repl",
    };
    const result = runAutomatorCommand(state, "do print('hi')");

    expect(result.cliMode).toBe("repl");
    expect(result.cliHistory[0].output).toBe("% Invalid input detected at '^' marker.");
  });

  it("respects a phase reset when `do` completes the verification", () => {
    const state: LockControlPlaneMissionState = {
      ...INITIAL_LOCK_CONTROL_PLANE_MISSION,
      status: "in_progress",
      phase: "local",
      cliMode: "config",
      userCreated: true,
      vtyLocal: true,
      vtySsh: true,
    };
    const result = runLockCommand(state, "do show running-config | include line vty");

    expect(result.localVerified).toBe(true);
    expect(result.phase).toBe("aaa");
    expect(result.cliMode).toBe("user");
    expect(result.cliHistory[0].prompt).toBe("R-BR(config)#");
    expect(result.cliHistory[0].input).toBe("do show running-config | include line vty");
  });
});

describe("tryRunDo", () => {
  const noop = (s: { cliMode: string; cliHistory: { input: string; output: string; prompt: string }[] }) => s;

  it("returns null when the input is not a `do` command", () => {
    expect(tryRunDo({ cliMode: "config", cliHistory: [] }, "show run", "R1(config)#", noop)).toBeNull();
  });

  it("returns null outside configuration modes", () => {
    expect(tryRunDo({ cliMode: "privileged", cliHistory: [] }, "do show run", "R1#", noop)).toBeNull();
    expect(tryRunDo({ cliMode: "repl", cliHistory: [] }, "do show run", ">>>", noop)).toBeNull();
  });
});

describe("iosHelpForMode `do`", () => {
  it("lists `do` in every configuration mode", () => {
    for (const mode of ["config", "interface", "config-if", "config-router", "config-vrf", "config-isakmp", "config-crypto-map"]) {
      expect(iosHelpForMode(mode)).toContain("do");
    }
  });

  it("never lists `do` in EXEC modes or the repl", () => {
    for (const mode of ["user", "exec", "privileged", "repl"]) {
      expect(iosHelpForMode(mode)).not.toContain("do");
    }
  });
});
