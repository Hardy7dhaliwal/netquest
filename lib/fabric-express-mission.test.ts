import { describe, expect, it } from "vitest";
import {
  chooseHypervisor,
  chooseVm,
  chooseVswitch,
  chooseVxlan,
  fabricPromptFor,
  FABRIC_PHASES,
  resetFabricExpressMission,
  runFabricCommand,
  startFabricExpressMission,
  vswitchInspected,
  vxlanInspected,
} from "./fabric-express-mission";

describe("The Fabric Express mission", () => {
  it("starts in the hypervisor phase and records a mission-started event", () => {
    const state = startFabricExpressMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("hypervisor");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("hypervisor phase (2.1.a)", () => {
    it("recognizes ESXi as a Type 1 bare-metal hypervisor and advances", () => {
      const state = startFabricExpressMission();
      const correct = chooseHypervisor(state, "type1");
      expect(correct.selectedHypervisor).toBe("type1");
      expect(correct.phase).toBe("vm");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("explains why VirtualBox is not the right read", () => {
      const state = startFabricExpressMission();
      const wrong = chooseHypervisor(state, "type2");
      expect(wrong.phase).toBe("hypervisor");
      expect(wrong.attempts).toBe(1);
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("VM phase (2.1.b)", () => {
    it("reads the VM config as virtual hardware backed by the hypervisor", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      const correct = chooseVm(state, "virtual-hardware");
      expect(correct.selectedVm).toBe("virtual-hardware");
      expect(correct.phase).toBe("vswitch");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects the physical-disk misread", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      const wrong = chooseVm(state, "vmdk-physical");
      expect(wrong.phase).toBe("vm");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("vSwitch inspection (2.1.c)", () => {
    it("walks the ESXi shell: enable, list the vSwitch, list the uplinks", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      expect(state.phase).toBe("vswitch");
      state = runFabricCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      expect(state.vsListed).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("vSwitch0");
      const inspected = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      expect(inspected.uplinkListed).toBe(true);
      expect(vswitchInspected(inspected)).toBe(true);
      expect(inspected.phase).toBe("vswitch-check");
      expect(inspected.cliMode).toBe("user");
      expect(inspected.cliHistory.at(-1)?.output).toContain("vmnic0");
      expect(inspected.eventLog.at(-1)?.tone).toBe("success");
    });

    it("needs both esxcli reads before the checkpoint unlocks", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      expect(state.phase).toBe("vswitch");
      const attemptsBefore = state.attempts;
      const locked = chooseVswitch(state, "uplink-needed");
      expect(locked.phase).toBe("vswitch");
      expect(locked.attempts).toBe(attemptsBefore);
      expect(locked.attempts).toBe(2);
    });

    it("completes the checkpoint only after inspecting, then opens the VXLAN phase", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      const correct = chooseVswitch(state, "uplink-needed");
      expect(correct.selectedVswitch).toBe("uplink-needed");
      expect(correct.phase).toBe("vxlan");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("explains the closed-island misread", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      const wrong = chooseVswitch(state, "no-uplink");
      expect(wrong.phase).toBe("vswitch-check");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("VXLAN inspection (2.3.b)", () => {
    it("walks the leaf console: enable, read nve1, the VNI table, and the peers", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      state = chooseVswitch(state, "uplink-needed");
      expect(state.phase).toBe("vxlan");
      expect(state.cliMode).toBe("user");
      state = runFabricCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runFabricCommand(state, "show running-config interface nve1");
      expect(state.nveInspected).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("member vni 10010");
      state = runFabricCommand(state, "show vxlan vni");
      expect(state.vniListed).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("10010");
      const inspected = runFabricCommand(state, "show nve peers");
      expect(inspected.nvePeersSeen).toBe(true);
      expect(vxlanInspected(inspected)).toBe(true);
      expect(inspected.phase).toBe("vxlan-check");
      expect(inspected.cliHistory.at(-1)?.output).toContain("192.0.2.11");
      expect(inspected.eventLog.at(-1)?.tone).toBe("success");
    });

    it("guides show commands typed before enable", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      state = chooseVswitch(state, "uplink-needed");
      const early = runFabricCommand(state, "show vxlan vni");
      expect(early.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(early.vniListed).toBe(false);
    });

    it("does not tell a privileged player to enable for an esxcli command", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      state = chooseVswitch(state, "uplink-needed");
      state = runFabricCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      const invalid = runFabricCommand(state, "esxcli network vswitch standard list");
      expect(invalid.cliHistory.at(-1)?.output).toContain("% Invalid input");
    });

    it("completes the mission when a VNI is read as a Layer 2 segment", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      state = chooseVswitch(state, "uplink-needed");
      state = runFabricCommand(state, "enable");
      state = runFabricCommand(state, "show running-config interface nve1");
      state = runFabricCommand(state, "show vxlan vni");
      state = runFabricCommand(state, "show nve peers");
      const done = chooseVxlan(state, "l2-segment");
      expect(done.status).toBe("complete");
      expect(done.phase).toBe("complete");
      expect(done.selectedVxlan).toBe("l2-segment");
    });

    it("distinguishes a VNI from a VLAN number", () => {
      let state = startFabricExpressMission();
      state = chooseHypervisor(state, "type1");
      state = chooseVm(state, "virtual-hardware");
      state = runFabricCommand(state, "esxcli network vswitch standard list");
      state = runFabricCommand(state, "esxcli network vswitch standard uplink list");
      state = chooseVswitch(state, "uplink-needed");
      state = runFabricCommand(state, "enable");
      state = runFabricCommand(state, "show running-config interface nve1");
      state = runFabricCommand(state, "show vxlan vni");
      state = runFabricCommand(state, "show nve peers");
      const wrong = chooseVxlan(state, "vlan-number");
      expect(wrong.phase).toBe("vxlan-check");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  it("guards every choice behind its own phase", () => {
    let state = startFabricExpressMission();
    expect(chooseVm(state, "virtual-hardware").phase).toBe("hypervisor");
    expect(chooseVswitch(state, "uplink-needed").phase).toBe("hypervisor");
    expect(chooseVxlan(state, "l2-segment").phase).toBe("hypervisor");
    expect(chooseHypervisor(state, "type1").phase).toBe("vm");
  });

  it("lists exactly the five in-progress phases", () => {
    expect(FABRIC_PHASES).toEqual(["hypervisor", "vm", "vswitch", "vswitch-check", "vxlan", "vxlan-check"]);
  });

  it("renders prompts for both CLI modes and devices", () => {
    expect(fabricPromptFor("user")).toBe("HOST-1>");
    expect(fabricPromptFor("privileged")).toBe("HOST-1#");
    expect(fabricPromptFor("user", "vxlan")).toBe("LEAF-1>");
    expect(fabricPromptFor("privileged", "vxlan")).toBe("LEAF-1#");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startFabricExpressMission();
    const before = JSON.stringify(state);
    runFabricCommand(state, "enable");
    chooseHypervisor(state, "type1");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resets to a clean slate", () => {
    const next = resetFabricExpressMission();
    expect(next).toEqual(resetFabricExpressMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
