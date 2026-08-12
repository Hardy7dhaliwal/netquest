import { describe, expect, it } from "vitest";
import {
  chooseBenefit,
  chooseOmp,
  choosePlanes,
  chooseTlocs,
  resetSdwanMission,
  runSdwanCommand,
  SDWAN_PHASES,
  sdwanPromptFor,
  startSdwanMission,
  tlocsInspected,
} from "./sdwan-mission";

describe("SD-WAN: The WAN Overlay mission", () => {
  it("starts in the planes phase and records a mission-started event", () => {
    const state = startSdwanMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("planes");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("planes phase (1.2.a)", () => {
    it("identifies OMP as the control plane and advances", () => {
      const state = startSdwanMission();
      const correct = choosePlanes(state, "control-omp");
      expect(correct.selectedPlanes).toBe("control-omp");
      expect(correct.phase).toBe("omp");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("explains why vSmart is not the data plane", () => {
      const state = startSdwanMission();
      const wrong = choosePlanes(state, "data-vsmart");
      expect(wrong.phase).toBe("planes");
      expect(wrong.attempts).toBe(1);
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("omp phase (1.2.a)", () => {
    it("reads an OMP route as prefix + TLOC + attributes, not the full table", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      const correct = chooseOmp(state, "omp-tloc-attr");
      expect(correct.selectedOmp).toBe("omp-tloc-attr");
      expect(correct.phase).toBe("tlocs");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects the full-table misread", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      const wrong = chooseOmp(state, "full-table");
      expect(wrong.phase).toBe("omp");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("vEdge inspection (1.2.a data plane)", () => {
    it("walks the vEdge console: enable, TLOCs, BFD, control connections", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      state = chooseOmp(state, "omp-tloc-attr");
      expect(state.phase).toBe("tlocs");
      state = runSdwanCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runSdwanCommand(state, "show omp tlocs");
      expect(state.ompTlocsSeen).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("10.70.70.1");
      expect(state.cliHistory.at(-1)?.output).toContain("biz-internet");
      state = runSdwanCommand(state, "show bfd sessions");
      expect(state.bfdSeen).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("up");
      const inspected = runSdwanCommand(state, "show control connections");
      expect(inspected.controlSeen).toBe(true);
      expect(tlocsInspected(inspected)).toBe(true);
      expect(inspected.phase).toBe("tlocs-check");
      expect(inspected.cliMode).toBe("user");
      expect(inspected.cliHistory.at(-1)?.output).toContain("vsmart");
      expect(inspected.eventLog.at(-1)?.tone).toBe("success");
    });

    it("needs all three reads before the checkpoint unlocks", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      state = chooseOmp(state, "omp-tloc-attr");
      state = runSdwanCommand(state, "enable");
      state = runSdwanCommand(state, "show omp tlocs");
      state = runSdwanCommand(state, "show bfd sessions");
      expect(state.phase).toBe("tlocs");
      const attemptsBefore = state.attempts;
      const locked = chooseTlocs(state, "tlocs-forward");
      expect(locked.phase).toBe("tlocs");
      expect(locked.attempts).toBe(attemptsBefore);
    });

    it("guides show commands typed before enable", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      state = chooseOmp(state, "omp-tloc-attr");
      const early = runSdwanCommand(state, "show bfd sessions");
      expect(early.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(early.bfdSeen).toBe(false);
    });

    it("completes the checkpoint only after inspecting, then opens the benefit phase", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      state = chooseOmp(state, "omp-tloc-attr");
      state = runSdwanCommand(state, "enable");
      state = runSdwanCommand(state, "show omp tlocs");
      state = runSdwanCommand(state, "show bfd sessions");
      state = runSdwanCommand(state, "show control connections");
      const correct = chooseTlocs(state, "tlocs-forward");
      expect(correct.selectedTlocs).toBe("tlocs-forward");
      expect(correct.phase).toBe("benefit");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });
  });

  describe("benefit phase (1.2.b)", () => {
    it("completes the mission when transport independence is named the benefit", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      state = chooseOmp(state, "omp-tloc-attr");
      state = runSdwanCommand(state, "enable");
      state = runSdwanCommand(state, "show omp tlocs");
      state = runSdwanCommand(state, "show bfd sessions");
      state = runSdwanCommand(state, "show control connections");
      state = chooseTlocs(state, "tlocs-forward");
      const done = chooseBenefit(state, "benefit-transport");
      expect(done.status).toBe("complete");
      expect(done.phase).toBe("complete");
      expect(done.selectedBenefit).toBe("benefit-transport");
    });

    it("accepts that complexity is a real limitation, not a benefit", () => {
      let state = startSdwanMission();
      state = choosePlanes(state, "control-omp");
      state = chooseOmp(state, "omp-tloc-attr");
      state = runSdwanCommand(state, "enable");
      state = runSdwanCommand(state, "show omp tlocs");
      state = runSdwanCommand(state, "show bfd sessions");
      state = runSdwanCommand(state, "show control connections");
      state = chooseTlocs(state, "tlocs-forward");
      const wrong = chooseBenefit(state, "limit-complexity");
      expect(wrong.phase).toBe("benefit");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  it("guards every choice behind its own phase", () => {
    let state = startSdwanMission();
    expect(chooseOmp(state, "omp-tloc-attr").phase).toBe("planes");
    expect(chooseTlocs(state, "tlocs-forward").phase).toBe("planes");
    expect(chooseBenefit(state, "benefit-transport").phase).toBe("planes");
    expect(choosePlanes(state, "control-omp").phase).toBe("omp");
  });

  it("lists exactly the five in-progress phases", () => {
    expect(SDWAN_PHASES).toEqual(["planes", "omp", "tlocs", "tlocs-check", "benefit"]);
  });

  it("renders the vEdge prompts", () => {
    expect(sdwanPromptFor("user")).toBe("vEdge>");
    expect(sdwanPromptFor("privileged")).toBe("vEdge#");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startSdwanMission();
    const before = JSON.stringify(state);
    runSdwanCommand(state, "enable");
    choosePlanes(state, "control-omp");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resets to a clean slate", () => {
    const next = resetSdwanMission();
    expect(next).toEqual(resetSdwanMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
