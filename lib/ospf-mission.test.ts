import { describe, expect, it } from "vitest";
import {
  chooseCause,
  chooseEvidence,
  OSPF_EXPECTED,
  ospfDeviceFor,
  ospfPromptFor,
  resetOspfMission,
  runOspfCommand,
  startOspfMission,
} from "./ospf-mission";

function toConfig() {
  return chooseCause(chooseEvidence(startOspfMission(), "stuck-adjacency"), "area-mismatch");
}

function toVerify() {
  let state = toConfig();
  state = runOspfCommand(state, "enable");
  state = runOspfCommand(state, "configure terminal");
  state = runOspfCommand(state, "router ospf 1");
  return runOspfCommand(state, "network 10.0.2.0 0.0.0.255 area 0");
}

function toSummarize() {
  let state = toVerify();
  state = runOspfCommand(state, "enable");
  return runOspfCommand(state, "show ip ospf neighbor");
}

function toFilter() {
  let state = toSummarize();
  state = runOspfCommand(state, "enable");
  state = runOspfCommand(state, "configure terminal");
  state = runOspfCommand(state, "router ospf 1");
  return runOspfCommand(state, "area 1 range 172.16.0.0 255.255.252.0");
}

describe("Area Zero Hero mission", () => {
  it("starts in the evidence phase expecting the stuck-adjacency reading", () => {
    const state = startOspfMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("evidence");
    expect(OSPF_EXPECTED.evidence).toBe("stuck-adjacency");
    expect(state.selectedEvidence).toBeNull();
  });

  it("gives feedback for a wrong reading and advances on the correct one", () => {
    const wrong = chooseEvidence(startOspfMission(), "full-converged");
    expect(wrong.phase).toBe("evidence");
    expect(wrong.attempts).toBe(1);
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseEvidence(wrong, "stuck-adjacency");
    expect(next.phase).toBe("cause");
    expect(next.eventLog.at(-1)?.tone).toBe("success");
  });

  it("identifies the area mismatch as the cause", () => {
    const state = chooseEvidence(startOspfMission(), "stuck-adjacency");
    const wrong = chooseCause(state, "process-id-diff");
    expect(wrong.phase).toBe("cause");
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseCause(wrong, "area-mismatch");
    expect(next.phase).toBe("config");
    expect(next.selectedCause).toBe("area-mismatch");
  });

  describe("area fix drill on R2", () => {
    it("walks the CLI modes into config-router and moves the link to area 0", () => {
      let state = toConfig();
      expect(state.phase).toBe("config");
      expect(state.cliMode).toBe("user");
      state = runOspfCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runOspfCommand(state, "configure terminal");
      expect(state.cliMode).toBe("config");
      state = runOspfCommand(state, "router ospf 1");
      expect(state.cliMode).toBe("config-router");
      state = runOspfCommand(state, "network 10.0.2.0 0.0.0.255 area 0");
      expect(state.areaFixed).toBe(true);
      expect(state.phase).toBe("verify");
      expect(state.cliMode).toBe("user");
      expect(state.cliHistory.at(-1)?.output).toContain("now belongs to area 0");
      expect(state.eventLog.at(-1)?.tone).toBe("success");
    });

    it("guides ospf commands typed outside router config mode", () => {
      let state = toConfig();
      state = runOspfCommand(state, "enable");
      state = runOspfCommand(state, "configure terminal");
      const wrongMode = runOspfCommand(state, "network 10.0.2.0 0.0.0.255 area 0");
      expect(wrongMode.cliHistory.at(-1)?.output).toContain("enter router ospf 1 first");
      expect(wrongMode.phase).toBe("config");
    });
  });

  describe("adjacency verify drill on R1", () => {
    it("switches the console to R1 and proves FULL", () => {
      let state = toVerify();
      expect(state.phase).toBe("verify");
      expect(ospfDeviceFor(state.phase)).toBe("R1");
      state = runOspfCommand(state, "enable");
      const verified = runOspfCommand(state, "show ip ospf neighbor");
      expect(verified.areaVerified).toBe(true);
      expect(verified.phase).toBe("summarize");
      expect(verified.cliMode).toBe("user");
      expect(verified.cliHistory.at(-1)?.output).toContain("FULL/  -");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("asks for enable before show ip ospf neighbor in user mode", () => {
      const state = toVerify();
      const guided = runOspfCommand(state, "show ip ospf neighbor");
      expect(guided.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(guided.phase).toBe("verify");
    });
  });

  describe("summary drill on R2", () => {
    it("installs the ABR area range and advances to the filter", () => {
      let state = toSummarize();
      expect(state.phase).toBe("summarize");
      state = runOspfCommand(state, "enable");
      state = runOspfCommand(state, "configure terminal");
      state = runOspfCommand(state, "router ospf 1");
      const summarized = runOspfCommand(state, "area 1 range 172.16.0.0 255.255.252.0");
      expect(summarized.summarySet).toBe(true);
      expect(summarized.phase).toBe("filter");
      expect(summarized.cliMode).toBe("user");
      expect(summarized.cliHistory.at(-1)?.output).toContain("collapse into one /22");
    });
  });

  describe("compliance filter drill on R2", () => {
    it("refuses to apply the filter before the LabDeny prefix-list exists", () => {
      let state = toFilter();
      expect(state.phase).toBe("filter");
      state = runOspfCommand(state, "enable");
      state = runOspfCommand(state, "configure terminal");
      state = runOspfCommand(state, "router ospf 1");
      const early = runOspfCommand(state, "area 1 filter-list prefix LabDeny out");
      expect(early.filterSet).toBe(false);
      expect(early.status).toBe("in_progress");
      expect(early.phase).toBe("filter");
      expect(early.cliHistory.at(-1)?.output).toContain("create the prefix-list first");
    });

    it("accepts the prefix-list and completes on the area filter-list", () => {
      let state = toFilter();
      expect(state.phase).toBe("filter");
      state = runOspfCommand(state, "enable");
      state = runOspfCommand(state, "configure terminal");
      state = runOspfCommand(state, "router ospf 1");
      state = runOspfCommand(state, "ip prefix-list LabDeny seq 5 deny 192.168.50.0/24");
      expect(state.cliHistory.at(-1)?.output).toContain("is denied");
      expect(state.phase).toBe("filter");
      state = runOspfCommand(state, "ip prefix-list LabDeny seq 10 permit 0.0.0.0/0 le 32");
      state = runOspfCommand(state, "area 1 filter-list prefix LabDeny out");
      expect(state.filterSet).toBe(true);
      expect(state.status).toBe("complete");
      expect(state.phase).toBe("complete");
      expect(state.cliHistory.at(-1)?.output).toContain("no longer leave area 1");
      expect(state.eventLog.at(-1)?.tone).toBe("success");
    });

    it("cannot skip the catch-all permit and still apply the filter", () => {
      let state = toFilter();
      state = runOspfCommand(state, "enable");
      state = runOspfCommand(state, "configure terminal");
      state = runOspfCommand(state, "router ospf 1");
      state = runOspfCommand(state, "ip prefix-list LabDeny seq 5 deny 192.168.50.0/24");
      const incomplete = runOspfCommand(state, "area 1 filter-list prefix LabDeny out");
      expect(incomplete.filterSet).toBe(false);
      expect(incomplete.phase).toBe("filter");
      expect(incomplete.cliHistory.at(-1)?.output).toContain("create the prefix-list first");
    });
  });

  it("ignores commands when not in a CLI phase", () => {
    const next = runOspfCommand(startOspfMission(), "enable");
    expect(next.cliHistory).toHaveLength(0);
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startOspfMission();
    const before = JSON.stringify(state);
    chooseEvidence(state, "full-converged");
    runOspfCommand(state, "enable");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders device-scoped prompts", () => {
    expect(ospfPromptFor("user", "R1")).toBe("R1>");
    expect(ospfPromptFor("privileged", "R2")).toBe("R2#");
    expect(ospfPromptFor("config", "R2")).toBe("R2(config)#");
    expect(ospfPromptFor("config-router", "R1")).toBe("R1(config-router)#");
    expect(ospfDeviceFor("verify")).toBe("R1");
    expect(ospfDeviceFor("config")).toBe("R2");
    expect(ospfDeviceFor("filter")).toBe("R2");
  });

  it("does not change a completed mission and resets cleanly", () => {
    let state = toFilter();
    state = runOspfCommand(state, "enable");
    state = runOspfCommand(state, "configure terminal");
    state = runOspfCommand(state, "router ospf 1");
    state = runOspfCommand(state, "ip prefix-list LabDeny seq 5 deny 192.168.50.0/24");
    state = runOspfCommand(state, "ip prefix-list LabDeny seq 10 permit 0.0.0.0/0 le 32");
    const complete = runOspfCommand(state, "area 1 filter-list prefix LabDeny out");
    expect(chooseEvidence(complete, "stuck-adjacency")).toEqual(complete);
    expect(runOspfCommand(complete, "enable")).toEqual(complete);
    expect(resetOspfMission().status).toBe("not_started");
  });
});
