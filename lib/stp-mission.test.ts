import { describe, expect, it } from "vitest";
import {
  chooseProtocol,
  chooseRoot,
  resetStpMission,
  runStpCommand,
  startStpMission,
  stpPromptFor,
} from "./stp-mission";

describe("The STP Storm mission", () => {
  it("starts with SW2 as the deterministic expected root", () => {
    const state = startStpMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("root_election");
    expect(state.expectedRoot).toBe("SW2");
    expect(state.selectedRoot).toBeNull();
  });

  it("gives feedback for a wrong prediction and advances on the correct one", () => {
    const wrong = chooseRoot(startStpMission(), "SW1");
    expect(wrong.status).toBe("in_progress");
    expect(wrong.phase).toBe("root_election");
    expect(wrong.attempts).toBe(1);
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseRoot(wrong, "SW2");
    expect(next.phase).toBe("bpdu_guard");
    expect(next.eventLog.at(-1)?.tone).toBe("success");
  });

  describe("BPDU Guard drill", () => {
    function atBpduGuard() {
      return chooseRoot(startStpMission(), "SW2");
    }

    it("walks the CLI modes: enable → configure terminal → interface gi0/5", () => {
      const state = atBpduGuard();
      expect(state.phase).toBe("bpdu_guard");
      expect(state.cliMode).toBe("user");
      const enabled = runStpCommand(state, "enable");
      expect(enabled.cliMode).toBe("privileged");
      const conf = runStpCommand(enabled, "configure terminal");
      expect(conf.cliMode).toBe("config");
      const intf = runStpCommand(conf, "interface gi0/5");
      expect(intf.cliMode).toBe("config-if");
    });

    it("enables BPDU Guard on Gi0/5 and verifies it to advance", () => {
      let state = atBpduGuard();
      state = runStpCommand(state, "enable");
      state = runStpCommand(state, "configure terminal");
      state = runStpCommand(state, "interface gi0/5");
      state = runStpCommand(state, "spanning-tree bpduguard enable");
      expect(state.bpduGuardSet).toBe(true);
      expect(state.phase).toBe("bpdu_guard");
      state = runStpCommand(state, "end");
      const verified = runStpCommand(state, "show spanning-tree interface gi0/5");
      expect(verified.bpduGuardVerified).toBe(true);
      expect(verified.phase).toBe("root_guard");
      expect(verified.cliMode).toBe("user");
      expect(verified.cliHistory.at(-1)?.output).toContain("Bpdu guard is enabled");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports 'Bpdu guard is disabled' until the command runs", () => {
      let state = atBpduGuard();
      state = runStpCommand(state, "enable");
      const early = runStpCommand(state, "show spanning-tree interface gi0/5");
      expect(early.cliHistory.at(-1)?.output).toContain("Bpdu guard is disabled");
      expect(early.phase).toBe("bpdu_guard");
    });

    it("guides spanning-tree commands typed outside interface mode", () => {
      let state = atBpduGuard();
      state = runStpCommand(state, "enable");
      state = runStpCommand(state, "configure terminal");
      const wrongMode = runStpCommand(state, "spanning-tree bpduguard enable");
      expect(wrongMode.cliHistory.at(-1)?.output).toContain("Enter the interface first");
      expect(wrongMode.phase).toBe("bpdu_guard");
    });
  });

  describe("Root Guard drill", () => {
    function atRootGuard() {
      let state = chooseRoot(startStpMission(), "SW2");
      state = runStpCommand(state, "enable");
      state = runStpCommand(state, "configure terminal");
      state = runStpCommand(state, "interface gi0/5");
      state = runStpCommand(state, "spanning-tree bpduguard enable");
      state = runStpCommand(state, "end");
      return runStpCommand(state, "show spanning-tree interface gi0/5");
    }

    it("enables Root Guard on Gi0/2 and verifies it to advance to MST", () => {
      let state = atRootGuard();
      expect(state.phase).toBe("root_guard");
      state = runStpCommand(state, "enable");
      state = runStpCommand(state, "configure terminal");
      state = runStpCommand(state, "interface gi0/2");
      state = runStpCommand(state, "spanning-tree guard root");
      expect(state.rootGuardSet).toBe(true);
      state = runStpCommand(state, "end");
      const verified = runStpCommand(state, "show spanning-tree interface gi0/2");
      expect(verified.rootGuardVerified).toBe(true);
      expect(verified.phase).toBe("mst_concept");
      expect(verified.cliHistory.at(-1)?.output).toContain("Root guard is enabled");
    });
  });

  it("completes only after MST is selected", () => {
    let state = chooseRoot(startStpMission(), "SW2");
    state = runStpCommand(state, "enable");
    state = runStpCommand(state, "configure terminal");
    state = runStpCommand(state, "interface gi0/5");
    state = runStpCommand(state, "spanning-tree bpduguard enable");
    state = runStpCommand(state, "end");
    state = runStpCommand(state, "show spanning-tree interface gi0/5");
    state = runStpCommand(state, "enable");
    state = runStpCommand(state, "configure terminal");
    state = runStpCommand(state, "interface gi0/2");
    state = runStpCommand(state, "spanning-tree guard root");
    state = runStpCommand(state, "end");
    state = runStpCommand(state, "show spanning-tree interface gi0/2");
    const wrong = chooseProtocol(state, "rstp");
    expect(wrong.status).toBe("in_progress");
    expect(wrong.phase).toBe("mst_concept");

    const complete = chooseProtocol(wrong, "mst");
    expect(complete.status).toBe("complete");
    expect(complete.phase).toBe("complete");
    expect(complete.blockedPort).toBe("SW1 Gi0/2");
    expect(complete.eventLog.at(-1)?.tone).toBe("success");
  });

  it("ignores commands when not in a CLI phase", () => {
    const next = runStpCommand(startStpMission(), "enable");
    expect(next.cliHistory).toHaveLength(0);
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startStpMission();
    const before = JSON.stringify(state);
    chooseRoot(state, "SW1");
    runStpCommand(state, "enable");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders device-scoped prompts", () => {
    expect(stpPromptFor("user")).toBe("SW1>");
    expect(stpPromptFor("privileged")).toBe("SW1#");
    expect(stpPromptFor("config")).toBe("SW1(config)#");
    expect(stpPromptFor("config-if")).toBe("SW1(config-if)#");
  });

  it("does not change a completed mission and resets cleanly", () => {
    let state = chooseRoot(startStpMission(), "SW2");
    state = runStpCommand(state, "enable");
    state = runStpCommand(state, "configure terminal");
    state = runStpCommand(state, "interface gi0/5");
    state = runStpCommand(state, "spanning-tree bpduguard enable");
    state = runStpCommand(state, "end");
    state = runStpCommand(state, "show spanning-tree interface gi0/5");
    state = runStpCommand(state, "enable");
    state = runStpCommand(state, "configure terminal");
    state = runStpCommand(state, "interface gi0/2");
    state = runStpCommand(state, "spanning-tree guard root");
    state = runStpCommand(state, "end");
    state = runStpCommand(state, "show spanning-tree interface gi0/2");
    const complete = chooseProtocol(state, "mst");
    expect(chooseRoot(complete, "SW1")).toEqual(complete);
    expect(runStpCommand(complete, "enable")).toEqual(complete);
    expect(resetStpMission().status).toBe("not_started");
  });
});
