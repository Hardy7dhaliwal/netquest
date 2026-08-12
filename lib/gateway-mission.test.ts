import { describe, expect, it } from "vitest";
import {
  chooseDesign,
  chooseHa,
  chooseVrrp,
  gatewayPromptFor,
  hsrpConfigured,
  resetGatewayMission,
  runGatewayCommand,
  startGatewayMission,
} from "./gateway-mission";

describe("Gateway at Dawn mission", () => {
  it("starts in the design phase and records a mission-started event", () => {
    const state = startGatewayMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("design");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  it("advances through the design choice when correct", () => {
    const next = chooseDesign(startGatewayMission(), "collapsed-core-pair");
    expect(next.phase).toBe("ha");
    expect(next.selectedDesign).toBe("collapsed-core-pair");
    expect(next.attempts).toBe(1);
    expect(next.eventLog.at(-1)?.tone).toBe("success");
  });

  it("holds on the design phase with guidance after a wrong answer", () => {
    const next = chooseDesign(startGatewayMission(), "flat-single");
    expect(next.phase).toBe("design");
    expect(next.attempts).toBe(1);
    expect(next.eventLog.at(-1)?.tone).toBe("error");
  });

  it("moves from HA to the HSRP console phase on the right answer", () => {
    const atHa = chooseDesign(startGatewayMission(), "collapsed-core-pair");
    const next = chooseHa(atHa, "fhrp");
    expect(next.phase).toBe("hsrp-config");
    expect(next.selectedHa).toBe("fhrp");
    expect(next.eventLog.at(-1)?.message).toContain("virtual IP");
  });

  it("rejects wrong HA answers with misconception feedback", () => {
    const atHa = chooseDesign(startGatewayMission(), "collapsed-core-pair");
    const next = chooseHa(atHa, "stp");
    expect(next.phase).toBe("ha");
    expect(next.eventLog.at(-1)?.message).toContain("loops");
  });

  describe("HSRP CLI configure phase", () => {
    function atConsole() {
      const state = startGatewayMission();
      const designed = chooseDesign(state, "collapsed-core-pair");
      return chooseHa(designed, "fhrp");
    }

    it("walks the CLI modes: enable → configure terminal → interface", () => {
      const state = atConsole();
      const enabled = runGatewayCommand(state, "enable");
      expect(enabled.cliMode).toBe("privileged");
      const conf = runGatewayCommand(enabled, "configure terminal");
      expect(conf.cliMode).toBe("config");
      const intf = runGatewayCommand(conf, "interface gi0/1");
      expect(intf.cliMode).toBe("config-if");
    });

    it("tracks the three standby commands and verifies with show standby", () => {
      let state = atConsole();
      state = runGatewayCommand(state, "enable");
      state = runGatewayCommand(state, "configure terminal");
      state = runGatewayCommand(state, "interface gi0/1");
      state = runGatewayCommand(state, "standby 1 ip 10.30.0.1");
      state = runGatewayCommand(state, "standby 1 priority 110");
      expect(hsrpConfigured(state)).toBe(false);
      state = runGatewayCommand(state, "standby 1 preempt");
      expect(hsrpConfigured(state)).toBe(true);
      state = runGatewayCommand(state, "end");
      const verified = runGatewayCommand(state, "show standby");
      expect(verified.hsrpVerified).toBe(true);
      expect(verified.phase).toBe("failover");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("shows 'Group 1 is not running' until the group is fully configured", () => {
      let state = atConsole();
      state = runGatewayCommand(state, "enable");
      const unconfigured = runGatewayCommand(state, "show standby");
      expect(unconfigured.cliHistory.at(-1)?.output).toContain("Group 1 is not running");
      expect(unconfigured.phase).toBe("hsrp-config");
    });

    it("ignores commands when the state is not in a CLI phase", () => {
      const next = runGatewayCommand(startGatewayMission(), "enable");
      expect(next.cliHistory).toHaveLength(0);
    });
  });

  describe("failover drill", () => {
    function atFailover() {
      let state = startGatewayMission();
      state = chooseDesign(state, "collapsed-core-pair");
      state = chooseHa(state, "fhrp");
      state = runGatewayCommand(state, "enable");
      state = runGatewayCommand(state, "configure terminal");
      state = runGatewayCommand(state, "interface gi0/1");
      state = runGatewayCommand(state, "standby 1 ip 10.30.0.1");
      state = runGatewayCommand(state, "standby 1 priority 110");
      state = runGatewayCommand(state, "standby 1 preempt");
      state = runGatewayCommand(state, "end");
      return runGatewayCommand(state, "show standby");
    }

    it("shows GW1 as Active before the failure", () => {
      const state = atFailover();
      expect(state.device).toBe("GW1");
      const summary = runGatewayCommand(state, "show standby");
      expect(summary.cliHistory.at(-1)?.output).toContain("State is Active");
    });

    it("switches the console to GW2 after shutdown and verifies the takeover", () => {
      let state = atFailover();
      expect(state.phase).toBe("failover");
      state = runGatewayCommand(state, "configure terminal");
      state = runGatewayCommand(state, "interface gi0/1");
      const down = runGatewayCommand(state, "shutdown");
      expect(down.gw1ShutDown).toBe(true);
      expect(down.device).toBe("GW2");
      expect(down.cliMode).toBe("user");
      const enabled = runGatewayCommand(down, "enable");
      const verified = runGatewayCommand(enabled, "show standby");
      expect(verified.gw2Active).toBe(true);
      expect(verified.phase).toBe("vrrp");
      expect(verified.cliHistory.at(-1)?.output).toContain("State is Active");
    });
  });

  it("guards the VRRP choice until the failover phase", () => {
    let state = startGatewayMission();
    state = chooseDesign(state, "collapsed-core-pair");
    state = chooseHa(state, "fhrp");
    const guarded = chooseVrrp(state, "virtual-mac");
    expect(guarded.phase).toBe("hsrp-config");
    // Unchanged: the guard returns the state as-is, attempts already at 2.
    expect(guarded.attempts).toBe(2);
  });

  it("completes the mission after the correct VRRP comparison", () => {
    let state = startGatewayMission();
    state = chooseDesign(state, "collapsed-core-pair");
    state = chooseHa(state, "fhrp");
    state = runGatewayCommand(state, "enable");
    state = runGatewayCommand(state, "configure terminal");
    state = runGatewayCommand(state, "interface gi0/1");
    state = runGatewayCommand(state, "standby 1 ip 10.30.0.1");
    state = runGatewayCommand(state, "standby 1 priority 110");
    state = runGatewayCommand(state, "standby 1 preempt");
    state = runGatewayCommand(state, "end");
    state = runGatewayCommand(state, "show standby");
    state = runGatewayCommand(state, "configure terminal");
    state = runGatewayCommand(state, "interface gi0/1");
    state = runGatewayCommand(state, "shutdown");
    state = runGatewayCommand(state, "enable");
    state = runGatewayCommand(state, "show standby");
    const done = chooseVrrp(state, "virtual-mac");
    expect(done.status).toBe("complete");
    expect(done.phase).toBe("complete");
    expect(done.selectedVrrp).toBe("virtual-mac");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startGatewayMission();
    const before = JSON.stringify(state);
    chooseDesign(state, "flat-single");
    runGatewayCommand(state, "enable");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders device-scoped prompts", () => {
    expect(gatewayPromptFor("user", "GW1")).toBe("GW1>");
    expect(gatewayPromptFor("privileged", "GW2")).toBe("GW2#");
    expect(gatewayPromptFor("config", "GW1")).toBe("GW1(config)#");
    expect(gatewayPromptFor("config-if", "GW2")).toBe("GW2(config-if)#");
  });

  it("resets to a clean slate", () => {
    const next = resetGatewayMission();
    expect(next).toEqual(resetGatewayMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
