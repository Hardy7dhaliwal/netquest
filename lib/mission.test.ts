import { describe, expect, it } from "vitest";
import { INITIAL_MISSION, resetMission, runCommand, sendPing } from "./mission";

function commandSequence(...commands: string[]) {
  return commands.reduce(runCommand, resetMission());
}

describe("The VLAN That Vanished mission", () => {
  it("starts with VLAN 20 missing from the trunk and fails ping", () => {
    const state = sendPing({ ...INITIAL_MISSION, status: "in_progress" });

    expect(state.trunkAllowedVlans).toEqual([10]);
    expect(state.lastPingResult).toBe("failed");
    expect(state.packetStatus).toBe("blocked");
    expect(state.eventLog.at(-1)?.message).toContain("not allowed");
  });

  it("runs the inspection commands and records objectives", () => {
    const state = commandSequence(
      "enable",
      "show vlan brief",
      "show interfaces trunk",
    );

    expect(state.inspectedVlans).toBe(true);
    expect(state.inspectedTrunk).toBe(true);
    expect(state.cliHistory[1].output).toContain("20   SALES");
    expect(state.cliHistory[2].output).toContain("10");
    expect(state.cliHistory[2].output).not.toContain("10, 20");
    expect(state.identifiedBlock).toBe(true);
    expect(state.eventLog.map(({ message }) => message)).toEqual([
      "User inspected VLAN state.",
      "User inspected trunk state.",
    ]);
  });

  it("supports help and running-config output", () => {
    const state = commandSequence("enable", "help", "show running-config");

    expect(state.cliHistory[1].output).toContain("show interfaces trunk");
    expect(state.cliHistory[2].output).toContain("switchport trunk allowed vlan 10");
  });

  it("adds VLAN 20 and succeeds on the post-fix ping", () => {
    const state = commandSequence(
      "enable",
      "configure terminal",
      "interface g0/1",
      "switchport trunk allowed vlan add 20",
      "end",
      "ping 10.20.0.1",
    );

    expect(state.trunkAllowedVlans).toEqual([10, 20]);
    expect(state.lastPingResult).toBe("success");
    expect(state.packetStatus).toBe("success");
    expect(state.status).toBe("complete");
    expect(state.eventLog.at(-1)?.message).toContain("Mission completed");
  });

  it("rejects invalid commands without changing network state", () => {
    const before = commandSequence("enable");
    const after = runCommand(before, "delete everything");

    expect(after.trunkAllowedVlans).toEqual(before.trunkAllowedVlans);
    expect(after.cliMode).toBe(before.cliMode);
    expect(after.cliHistory.at(-1)?.output).toContain("Invalid input");
  });

  it("does not complete after a failed ping", () => {
    const state = commandSequence("enable", "ping 10.20.0.1");

    expect(state.status).toBe("in_progress");
    expect(state.status).not.toBe("complete");
  });
});
