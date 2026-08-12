import { describe, expect, it } from "vitest";
import { resetShowAndPingMission, runShowAndPingCommand, startShowAndPingMission } from "./show-and-ping-mission";

describe("Show & Ping mission", () => {
  it("starts at the enable step in user EXEC", () => {
    const state = startShowAndPingMission();
    expect(state.status).toBe("in_progress");
    expect(state.step).toBe("enable");
    expect(state.cliMode).toBe("exec");
  });

  it("walks through every step to a successful ping", () => {
    let state = startShowAndPingMission();

    state = runShowAndPingCommand(state, "enable");
    expect(state.step).toBe("show-vlan");
    expect(state.cliMode).toBe("privileged");

    state = runShowAndPingCommand(state, "show vlan brief");
    expect(state.step).toBe("show-trunk");
    expect(state.cliHistory.at(-1)?.output).toContain("20   SALES");

    state = runShowAndPingCommand(state, "show interfaces trunk");
    expect(state.step).toBe("show-running");
    expect(state.cliHistory.at(-1)?.output).toContain("10, 20");

    state = runShowAndPingCommand(state, "show running-config");
    expect(state.step).toBe("ping");
    expect(state.cliHistory.at(-1)?.output).toContain("hostname SW1");

    state = runShowAndPingCommand(state, "ping 10.20.0.1");
    expect(state.status).toBe("complete");
    expect(state.step).toBe("complete");
    expect(state.cliHistory.at(-1)?.output).toContain("100 percent");
    expect(state.eventLog.at(-1)?.tone).toBe("success");
  });

  it("does not advance when the target step's command is run early", () => {
    const state = runShowAndPingCommand(startShowAndPingMission(), "show vlan brief");
    expect(state.step).toBe("enable");
    expect(state.cliHistory[0].output).toContain("enable first");
  });

  it("runs other valid commands without advancing steps", () => {
    const state = runShowAndPingCommand(runShowAndPingCommand(startShowAndPingMission(), "enable"), "show interfaces trunk");
    expect(state.step).toBe("show-vlan");
    expect(state.attempts).toBe(1);
    expect(state.cliHistory.at(-1)?.output).toContain("trunking");
  });

  it("gives friendly feedback for unknown commands", () => {
    const state = runShowAndPingCommand(startShowAndPingMission(), "format disk0:");
    expect(state.step).toBe("enable");
    expect(state.cliHistory[0].output).toContain("isn't recognized");
  });

  it("does not change a completed mission", () => {
    let state = startShowAndPingMission();
    ["enable", "show vlan brief", "show interfaces trunk", "show running-config", "ping 10.20.0.1"].forEach((command) => {
      state = runShowAndPingCommand(state, command);
    });
    expect(runShowAndPingCommand(state, "help")).toEqual(state);
    expect(resetShowAndPingMission().status).toBe("not_started");
  });
});
