import { describe, expect, it } from "vitest";
import {
  chooseCause,
  chooseEvidence,
  EC_EXPECTED,
  ecPromptFor,
  resetEcMission,
  runEcCommand,
  startEcMission,
} from "./etherchannel-mission";

function toConfig() {
  return chooseCause(chooseEvidence(startEcMission(), "missing-link"), "passive-passive");
}

function toVerify() {
  let state = toConfig();
  state = runEcCommand(state, "enable");
  state = runEcCommand(state, "configure terminal");
  state = runEcCommand(state, "interface gi0/2");
  return runEcCommand(state, "channel-group 1 mode active");
}

describe("The Bundled Bottleneck mission", () => {
  it("starts in the evidence phase expecting the missing-link reading", () => {
    const state = startEcMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("evidence");
    expect(EC_EXPECTED.evidence).toBe("missing-link");
    expect(state.selectedEvidence).toBeNull();
  });

  it("gives feedback for a wrong reading and advances on the correct one", () => {
    const wrong = chooseEvidence(startEcMission(), "healthy-bundle");
    expect(wrong.phase).toBe("evidence");
    expect(wrong.attempts).toBe(1);
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseEvidence(wrong, "missing-link");
    expect(next.phase).toBe("cause");
    expect(next.eventLog.at(-1)?.tone).toBe("success");
  });

  it("identifies LACP passive/passive as the cause", () => {
    const state = chooseEvidence(startEcMission(), "missing-link");
    const wrong = chooseCause(state, "group-mismatch");
    expect(wrong.phase).toBe("cause");
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseCause(wrong, "passive-passive");
    expect(next.phase).toBe("config");
    expect(next.selectedCause).toBe("passive-passive");
  });

  describe("config fix drill", () => {
    it("walks the CLI modes and applies the LACP fix", () => {
      let state = toConfig();
      expect(state.phase).toBe("config");
      expect(state.cliMode).toBe("user");
      state = runEcCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runEcCommand(state, "configure terminal");
      expect(state.cliMode).toBe("config");
      state = runEcCommand(state, "interface gi0/2");
      expect(state.cliMode).toBe("config-if");
      state = runEcCommand(state, "channel-group 1 mode active");
      expect(state.ecConfigured).toBe(true);
      expect(state.phase).toBe("verify");
      expect(state.cliMode).toBe("user");
      expect(state.cliHistory.at(-1)?.output).toContain("LACP negotiation started");
      expect(state.eventLog.at(-1)?.tone).toBe("success");
    });

    it("shows the summary with Gi0/2 still missing before the fix", () => {
      let state = toConfig();
      state = runEcCommand(state, "enable");
      const early = runEcCommand(state, "show etherchannel summary");
      expect(early.cliHistory.at(-1)?.output).toContain("Gi0/1(P)   Gi0/2");
      expect(early.phase).toBe("config");
    });

    it("guides channel-group commands typed outside interface mode", () => {
      let state = toConfig();
      state = runEcCommand(state, "enable");
      state = runEcCommand(state, "configure terminal");
      const wrongMode = runEcCommand(state, "channel-group 1 mode active");
      expect(wrongMode.cliHistory.at(-1)?.output).toContain("Enter the interface first");
      expect(wrongMode.phase).toBe("config");
    });
  });

  describe("verify drill", () => {
    it("completes only after show etherchannel summary proves both members", () => {
      let state = toVerify();
      expect(state.phase).toBe("verify");
      state = runEcCommand(state, "enable");
      const verified = runEcCommand(state, "show etherchannel summary");
      expect(verified.ecVerified).toBe(true);
      expect(verified.status).toBe("complete");
      expect(verified.phase).toBe("complete");
      expect(verified.cliHistory.at(-1)?.output).toContain("Gi0/1(P)   Gi0/2(P)");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("asks for enable before show etherchannel summary in user mode", () => {
      const state = toVerify();
      const guided = runEcCommand(state, "show etherchannel summary");
      expect(guided.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(guided.phase).toBe("verify");
    });
  });

  it("ignores commands when not in a CLI phase", () => {
    const next = runEcCommand(startEcMission(), "enable");
    expect(next.cliHistory).toHaveLength(0);
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startEcMission();
    const before = JSON.stringify(state);
    chooseEvidence(state, "healthy-bundle");
    runEcCommand(state, "enable");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders device-scoped prompts", () => {
    expect(ecPromptFor("user")).toBe("SW1>");
    expect(ecPromptFor("privileged")).toBe("SW1#");
    expect(ecPromptFor("config")).toBe("SW1(config)#");
    expect(ecPromptFor("config-if")).toBe("SW1(config-if)#");
  });

  it("does not change a completed mission and resets cleanly", () => {
    let state = toVerify();
    state = runEcCommand(state, "enable");
    const complete = runEcCommand(state, "show etherchannel summary");
    expect(chooseEvidence(complete, "missing-link")).toEqual(complete);
    expect(runEcCommand(complete, "enable")).toEqual(complete);
    expect(resetEcMission().status).toBe("not_started");
  });
});
